# SAGE Valve — Greenfield Rust Scaffold (MVP)

A minimal, cross‑platform Rust daemon that:

- Runs as a single global process (pid/lock file)
- Self‑recovers (supervisor with exponential backoff)
- Registers codebases (`valve register <path>`) and watches their files
- Filters changes through configurable personas (`.sage/valve.yml`)
- Emits structured events (NDJSON) to a local "Chronicles" log
- Exposes a simple local control plane (TCP localhost) for register/list/unregister

This is intentionally small and opinionated so a focused engineer can extend it fast.

---

## Layout

```
valve/
├─ Cargo.toml
└─ src/
   ├─ main.rs
   ├─ daemon.rs
   ├─ supervisor.rs
   ├─ state.rs
   ├─ config.rs
   ├─ persona.rs
   ├─ watch.rs
   ├─ control.rs
   └─ service.rs
```

---

## Cargo.toml

```toml
[package]
name = "sage-valve"
version = "0.1.0"
edition = "2021"

[dependencies]
anyhow = "1"
thiserror = "1"
# async runtime
tokio = { version = "1", features = ["rt-multi-thread", "macros", "signal", "sync", "fs", "time", "net"] }
# file watching
notify = "6"
# path filtering
globset = "0.4"
ignore = "0.4"
# config / serde
serde = { version = "1", features = ["derive"] }
serde_yaml = "0.9"
serde_json = "1"
# cli
clap = { version = "4", features = ["derive"] }
# logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["fmt", "env-filter"] }
# dirs & locking
directories = "5"
fd-lock = "4"
parking_lot = "0.12"
uuid = { version = "1", features = ["v4", "serde"] }
regex = "1"
```

---

## src/main.rs

```rust
use clap::{Parser, Subcommand};
use tracing_subscriber::{fmt, EnvFilter};
use anyhow::Result;

mod daemon;
mod supervisor;
mod state;
mod config;
mod persona;
mod watch;
mod control;
mod service;

#[derive(Parser)]
#[command(name = "sage-valve", version, about = "SAGE perceptual valve daemon")]
struct Cli {
    #[command(subcommand)]
    cmd: Command,
    /// Override control-plane port (localhost)
    #[arg(long, global = true, default_value_t = 5576)]
    port: u16,
}

#[derive(Subcommand)]
enum Command {
    /// Run the valve in the foreground (supervised)
    Run,
    /// Register a codebase to watch
    Register { path: String },
    /// Unregister a codebase by ID or path
    Unregister { target: String },
    /// List registered codebases
    List,
    /// Install as OS service/agent (prints what it did)
    Install,
    /// Uninstall OS service/agent
    Uninstall,
    /// Start service (if installed)
    Start,
    /// Stop service (if installed)
    Stop,
}

#[tokio::main]
async fn main() -> Result<()> {
    // logging
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    fmt().with_env_filter(filter).init();

    let cli = Cli::parse();

    match cli.cmd {
        Command::Run => daemon::run_foreground(cli.port).await?,
        Command::Register { path } => control::client_register(cli.port, path).await?,
        Command::Unregister { target } => control::client_unregister(cli.port, target).await?,
        Command::List => control::client_list(cli.port).await?,
        Command::Install => service::install_service()?,
        Command::Uninstall => service::uninstall_service()?,
        Command::Start => service::start_service()?,
        Command::Stop => service::stop_service()?,
    }

    Ok(())
}
```

---

## src/daemon.rs

```rust
use crate::{state::Registry, control, supervisor::Supervisor};
use anyhow::{Context, Result};
use directories::ProjectDirs;
use fd_lock::RwLock;
use std::{fs::File, path::PathBuf, sync::Arc};
use tokio::signal;
use tracing::{error, info};

fn dirs() -> Result<ProjectDirs> { ProjectDirs::from("dev","sage","valve").context("dirs") }

fn lockfile_path() -> Result<PathBuf> { Ok(dirs()?.runtime_dir().unwrap_or(dirs()?.data_dir()).join("valve.lock")) }

pub async fn run_foreground(port: u16) -> Result<()> {
    // Single-instance lock
    let lock_path = lockfile_path()?;
    std::fs::create_dir_all(lock_path.parent().unwrap())?;
    let file = File::create(&lock_path)?;
    let _lock = RwLock::new(file).try_write().context("valve already running?")?;

    // Load or init registry
    let reg = Arc::new(Registry::load_or_default()?);

    // Event sink: Chronicle NDJSON file
    let chron_path = dirs()?.data_dir().join("chronicles");
    std::fs::create_dir_all(&chron_path)?;
    let chron_file = chron_path.join("valve.ndjson");

    // Start control-plane server
    let reg_cp = reg.clone();
    let chron_cp = chron_file.clone();
    let ctrl = tokio::spawn(async move {
        if let Err(e) = control::server(port, reg_cp, chron_cp).await { error!(?e, "control plane exit"); }
    });

    // Start supervisor over all codebases in registry
    let mut sup = Supervisor::new(chron_file);
    sup.reconcile(reg.clone()).await?; // spawn watchers for existing codebases

    info!("valve running", port);

    // Handle reload signals (SIGHUP => reload registry)
    let mut hup = signal::unix::signal(signal::unix::SignalKind::hangup()).ok();
    let mut term = signal::unix::signal(signal::unix::SignalKind::terminate()).ok();

    loop {
        tokio::select! {
            _ = tokio::signal::ctrl_c() => { break; }
            _ = async { if let Some(s) = &mut hup { s.recv().await } else { std::future::pending().await } } => {
                if let Err(e) = sup.reconcile(reg.clone()).await { error!(?e, "reconcile"); }
            }
            _ = async { if let Some(s) = &mut term { s.recv().await } else { std::future::pending().await } } => { break; }
        }
    }

    // graceful shutdown
    sup.shutdown().await;
    ctrl.abort();
    info!("valve stopped");
    Ok(())
}
```

---

## src/supervisor.rs

```rust
use crate::{state::{Registry, Codebase}, watch::watch_codebase};
use anyhow::Result;
use std::{collections::HashMap, path::PathBuf};
use tokio::{task::JoinHandle, time::{sleep, Duration}};
use tracing::{info, warn};

pub struct Supervisor {
    chronicle: PathBuf,
    tasks: HashMap<String, JoinHandle<()>>, // key: codebase id
}

impl Supervisor {
    pub fn new(chronicle: PathBuf) -> Self { Self { chronicle, tasks: HashMap::new() } }

    pub async fn reconcile(&mut self, reg: std::sync::Arc<Registry>) -> Result<()> {
        let current: std::collections::HashSet<_> = reg.codebases.keys().cloned().collect();
        // stop tasks that no longer exist
        self.tasks.retain(|id, handle| { if !current.contains(id) { handle.abort(); false } else { true } });
        // start missing
        for (id, cb) in reg.codebases.iter() { if !self.tasks.contains_key(id) { self.spawn_watcher(id.clone(), cb.clone()); } }
        Ok(())
    }

    fn spawn_watcher(&mut self, id: String, cb: Codebase) {
        let chron = self.chronicle.clone();
        let handle = tokio::spawn(async move {
            let mut backoff = 1u64;
            loop {
                match watch_codebase(&cb, &chron).await {
                    Ok(_) => { info!(%id, "watcher finished normally"); break; }
                    Err(e) => {
                        warn!(%id, ?e, "watcher crashed, restarting");
                        sleep(Duration::from_secs(backoff.min(60))).await;
                        backoff = (backoff * 2).min(60);
                    }
                }
            }
        });
        self.tasks.insert(id, handle);
    }

    pub async fn shutdown(&mut self) { for (_, h) in self.tasks.drain() { h.abort(); } }
}
```

---

## src/state.rs

```rust
use anyhow::{Context, Result};
use directories::ProjectDirs;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::{Path, PathBuf}, sync::Arc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Codebase { pub id: String, pub path: PathBuf }

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Registry { pub codebases: BTreeMap<String, Codebase> }

fn reg_path() -> Result<PathBuf> {
    let d = ProjectDirs::from("dev","sage","valve").context("dirs")?;
    let p = d.data_dir().join("registry.json");
    std::fs::create_dir_all(d.data_dir())?; Ok(p)
}

impl Registry {
    pub fn load_or_default() -> Result<Self> {
        let p = reg_path()?;
        if p.exists() { Ok(serde_json::from_str(&fs::read_to_string(p)?)?) } else { Ok(Self::default()) }
    }
    fn persist(&self) -> Result<()> { fs::write(reg_path()?, serde_json::to_vec_pretty(self)?)?; Ok(()) }
    pub fn add(&mut self, path: impl AsRef<Path>) -> Result<Codebase> {
        let p = path.as_ref().canonicalize().context("invalid path")?;
        let id = Uuid::new_v4().to_string();
        let cb = Codebase { id: id.clone(), path: p }; self.codebases.insert(id.clone(), cb.clone()); self.persist()?; Ok(cb)
    }
    pub fn remove_by_id_or_path(&mut self, t: &str) -> Result<Option<Codebase>> {
        if let Some(cb) = self.codebases.remove(t) { self.persist()?; return Ok(Some(cb)); }
        let mut found: Option<String> = None;
        for (id, cb) in &self.codebases { if cb.path.to_string_lossy() == t { found = Some(id.clone()); break; } }
        if let Some(id) = found { let cb = self.codebases.remove(&id); self.persist()?; Ok(cb) } else { Ok(None) }
    }
}

// Shared, thread-safe registry for the control-plane
#[derive(Clone)]
pub struct SharedRegistry(pub Arc<RwLock<Registry>>);
impl SharedRegistry { pub fn new(reg: Registry) -> Self { Self(Arc::new(RwLock::new(reg))) } }
```

---

## src/config.rs

```rust
use globset::{Glob, GlobSetBuilder};
use serde::Deserialize;
use anyhow::{Context, Result};
use std::{collections::HashMap, path::Path};

#[derive(Debug, Deserialize, Clone)]
pub struct ValveConfig { pub personas: HashMap<String, PersonaConfig> }

#[derive(Debug, Deserialize, Clone)]
pub struct PersonaConfig {
    pub filters: Option<Vec<String>>,      // globs
    pub triggers: Option<Vec<String>>,     // regex
    pub response: Option<String>,          // label
    pub severity: Option<String>,          // e.g., HALT_EVERYTHING
    pub schedule: Option<String>,          // future use
}

impl ValveConfig {
    pub fn load_from_repo(repo: &Path) -> Result<Self> {
        let path = repo.join(".sage/valve.yml");
        let raw = std::fs::read_to_string(&path).with_context(|| format!("missing config at {}", path.display()))?;
        let cfg: ValveConfig = serde_yaml::from_str(&raw)?; Ok(cfg)
    }
}

#[derive(Clone)]
pub struct CompiledPersona { pub name: String, pub globset: globset::GlobSet, pub triggers: Vec<regex::Regex>, pub response: Option<String>, pub severity: Option<String> }

pub fn compile(cfg: &ValveConfig) -> Result<Vec<CompiledPersona>> {
    let mut v = Vec::new();
    for (name, p) in &cfg.personas {
        let mut b = GlobSetBuilder::new();
        for g in p.filters.clone().unwrap_or_default() { b.add(Glob::new(&g)?); }
        let gs = b.build()?;
        let mut trigs = Vec::new();
        for r in p.triggers.clone().unwrap_or_default() { trigs.push(regex::Regex::new(&r)?); }
        v.push(CompiledPersona { name: name.clone(), globset: gs, triggers: trigs, response: p.response.clone(), severity: p.severity.clone() });
    }
    Ok(v)
}
```

---

## src/persona.rs

```rust
use crate::config::CompiledPersona;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize, Clone)]
pub struct ValveEvent {
    pub persona: String,
    pub repo: String,
    pub file: String,
    pub reason: String,
    pub timestamp: i64,
}

pub fn match_personas<'a>(personas: &'a [CompiledPersona], repo: &Path, rel: &Path, content: Option<&str>) -> Vec<ValveEvent> {
    let mut events = vec![];
    for p in personas {
        if !p.globset.is_empty() && !p.globset.is_match(rel) { continue; }
        let mut reasons = vec!["glob".to_string()];
        if !p.triggers.is_empty() {
            if let Some(text) = content { if p.triggers.iter().any(|re| re.is_match(text)) { reasons.push("trigger".into()); } else { continue; } }
        }
        events.push(ValveEvent {
            persona: p.name.clone(),
            repo: repo.display().to_string(),
            file: rel.display().to_string(),
            reason: reasons.join("+"),
            timestamp: chrono::Utc::now().timestamp_millis(),
        });
    }
    events
}
```

---

## src/watch.rs

```rust
use crate::{config, persona::{self, ValveEvent}};
use anyhow::{Context, Result};
use notify::{RecommendedWatcher, RecursiveMode, Watcher, EventKind};
use std::{fs, path::{Path, PathBuf}};
use tracing::{debug, info, warn};

pub async fn watch_codebase(cb: &crate::state::Codebase, chronicle: &Path) -> Result<()> {
    let repo = cb.path.clone();
    let cfg = match config::ValveConfig::load_from_repo(&repo) { Ok(c) => c, Err(e) => { warn!(?e, "no valve.yml; watching anyway"); config::ValveConfig { personas: Default::default() } } };
    let personas = config::compile(&cfg)?;

    // channel bridge
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let mut watcher: RecommendedWatcher = Watcher::new(move |res| { let _ = tx.send(res); }, notify::Config::default())?;
    watcher.watch(&repo, RecursiveMode::Recursive)?;

    info!(repo=%repo.display(), personas = personas.len(), "watching");

    // writer for chronicles
    let chron = fs::OpenOptions::new().create(true).append(true).open(chronicle)?;
    let mut chron = tokio::fs::File::from_std(chron);

    while let Some(res) = rx.recv().await {
        match res {
            Ok(event) => {
                if !matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)) { continue; }
                for path in event.paths {
                    if let Some(rel) = path.strip_prefix(&repo).ok() {
                        // read content for triggers if file exists
                        let text = tokio::fs::read_to_string(&path).await.ok();
                        let hits: Vec<ValveEvent> = persona::match_personas(&personas, &repo, rel, text.as_deref());
                        for ev in hits {
                            let line = serde_json::to_string(&ev)? + "\n";
                            tokio::io::AsyncWriteExt::write_all(&mut chron, line.as_bytes()).await?;
                            debug!(?ev, "valve event");
                        }
                    }
                }
            }
            Err(e) => warn!(?e, "watch error"),
        }
    }

    Ok(())
}
```

---

## src/control.rs

```rust
use crate::state::{Registry, SharedRegistry};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use tokio::{io::{AsyncBufReadExt, AsyncWriteExt, BufReader}, net::{TcpListener, TcpStream}};
use tracing::{info, warn};

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum Command { Register { path: String }, Unregister { target: String }, List }

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum Reply { Ok, Error { message: String }, List { items: Vec<(String,String)> } }

pub async fn server(port: u16, reg: std::sync::Arc<Registry>, _chron: std::path::PathBuf) -> Result<()> {
    let addr = SocketAddr::from(([127,0,0,1], port));
    let listener = TcpListener::bind(addr).await?;
    info!(%addr, "control listening");

    let shared = SharedRegistry::new((*reg).clone());

    loop {
        let (sock, _) = listener.accept().await?;
        let sreg = shared.clone();
        tokio::spawn(async move {
            if let Err(e) = handle(sock, sreg).await { warn!(?e, "control session"); }
        });
    }
}

async fn handle(sock: TcpStream, shared: SharedRegistry) -> Result<()> {
    let (r, mut w) = sock.into_split();
    let mut br = BufReader::new(r);
    let mut line = String::new();
    while br.read_line(&mut line).await? > 0 {
        let cmd: Command = match serde_json::from_str(line.trim()) { Ok(c) => c, Err(e) => { w.write_all(json!(Reply::Error{ message: e.to_string() }).to_string().as_bytes()).await?; w.write_all(b"\n").await?; line.clear(); continue; } };
        match cmd {
            Command::Register { path } => {
                let mut reg = shared.0.write();
                match reg.add(path) { Ok(cb) => { w.write_all(json!(Reply::Ok).to_string().as_bytes()).await?; }, Err(e) => { w.write_all(json!(Reply::Error{ message: e.to_string() }).to_string().as_bytes()).await?; } }
                w.write_all(b"\n").await?;
            }
            Command::Unregister { target } => {
                let mut reg = shared.0.write();
                match reg.remove_by_id_or_path(&target) { Ok(Some(_)) => w.write_all(json!(Reply::Ok).to_string().as_bytes()).await?, Ok(None) => w.write_all(json!(Reply::Error{ message: "not found".into() }).to_string().as_bytes()).await?, Err(e) => w.write_all(json!(Reply::Error{ message: e.to_string() }).to_string().as_bytes()).await?, };
                w.write_all(b"\n").await?;
            }
            Command::List => {
                let reg = shared.0.read();
                let items: Vec<_> = reg.codebases.values().map(|c| (c.id.clone(), c.path.to_string_lossy().to_string())).collect();
                w.write_all(json!(Reply::List{ items }).to_string().as_bytes()).await?; w.write_all(b"\n").await?;
            }
        }
        line.clear();
    }
    Ok(())
}

// Small client helpers for the CLI
pub async fn client_register(port: u16, path: String) -> Result<()> { client_send(port, serde_json::json!({"type":"Register","path":path})).await }
pub async fn client_unregister(port: u16, target: String) -> Result<()> { client_send(port, serde_json::json!({"type":"Unregister","target":target})).await }
pub async fn client_list(port: u16) -> Result<()> { client_send(port, serde_json::json!({"type":"List"})).await }

async fn client_send(port: u16, msg: serde_json::Value) -> Result<()> {
    let addr = format!("127.0.0.1:{}", port);
    let mut s = TcpStream::connect(addr).await.context("connect control")?;
    s.write_all(msg.to_string().as_bytes()).await?; s.write_all(b"\n").await?;
    let mut br = BufReader::new(s);
    let mut line = String::new();
    if br.read_line(&mut line).await? > 0 { println!("{}", line.trim()); }
    Ok(())
}
```

---

## src/service.rs

```rust
use anyhow::{anyhow, Result};
#[cfg(target_os = "linux")]
use std::path::PathBuf;

pub fn install_service() -> Result<()> {
    #[cfg(target_os = "linux")] {
        let unit = r#"[Unit]\nDescription=SAGE Valve\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=/usr/local/bin/sage-valve run\nRestart=always\nRestartSec=3\n\n[Install]\nWantedBy=multi-user.target\n"#;
        std::fs::write("/etc/systemd/system/sage-valve.service", unit)?;
        std::process::Command::new("systemctl").args(["daemon-reload"]).status()?;
        std::process::Command::new("systemctl").args(["enable","sage-valve"]).status()?;
        println!("installed systemd service");
        return Ok(());
    }
    #[cfg(target_os = "macos")] {
        let plist = r#"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\"><dict>\n<key>Label</key><string>dev.sage.valve</string>\n<key>ProgramArguments</key><array><string>/usr/local/bin/sage-valve</string><string>run</string></array>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><true/>\n</dict></plist>\n"#;
        let path = format!("{}/Library/LaunchAgents/dev.sage.valve.plist", std::env::var("HOME")?);
        std::fs::write(&path, plist)?;
        println!("installed launchd plist at {}", path);
        return Ok(());
    }
    #[cfg(target_os = "windows")] {
        println!("Please register as a Windows service (stub). For dev: use Task Scheduler or run foreground.");
        return Ok(());
    }
    Err(anyhow!("service install not supported on this OS"))
}

pub fn uninstall_service() -> Result<()> { println!("uninstall stub"); Ok(()) }
pub fn start_service() -> Result<()> { println!("start stub"); Ok(()) }
pub fn stop_service() -> Result<()> { println!("stop stub"); Ok(()) }
```

---

## .sage/valve.yml (example)

```yaml
personas:
  Guardian:
    filters: ["**/*secret*", "**/auth/**", "**/.env*"]
    response: "security-paranoid"
    severity: "HALT_EVERYTHING"
  TestMaster:
    filters: ["**/*.test.ts", "**/__tests__/**"]
    triggers: ["\\bdescribe\\(", "\\bit\\(", "\\btest\\("]
    response: "ensure-coverage-and-quality"
  TypeNazi:
    filters: ["**/*.ts", "**/*.tsx"]
    triggers: ["\\bas any\\b", "@ts-ignore"]
    response: "strict-type-enforcement"
```

---

## Event Format (NDJSON)

Each line appended to `~/.local/share/sage/valve/chronicles/valve.ndjson`:

```json
{
  "persona": "Guardian",
  "repo": "/path/to/repo",
  "file": "src/auth/token.ts",
  "reason": "glob+trigger",
  "timestamp": 1700000000000
}
```

---

## Running It

```bash
# dev
cargo run -- run

# register a repo (in another terminal)
cargo run -- register --path /path/to/repo

# list
cargo run -- list

# uninstall/install service (Linux/macOS stubs included)
cargo run -- install
```

---

## Notes / Next Steps

- Replace TCP control plane with Unix socket / Windows named pipe if desired
- Add hot-reload of persona config on change
- Add backpressure / debounce on watch events
- Plug event sink into your Chronicles system (instead of NDJSON file)
- Add healthcheck endpoint and metrics (Prometheus via `metrics` crate)
- Harden service install (privilege checks, Windows service implementation)
- Add ignore rules via `.gitignore` (`ignore` crate) for noise reduction
- Extend `severity` to gate CI hooks or editor notifications

```

```
