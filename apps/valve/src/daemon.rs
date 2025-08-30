use crate::{state::Registry, control, supervisor::Supervisor};
use anyhow::{Context, Result};
use directories::ProjectDirs;
use fd_lock::RwLock;
use std::{fs::File, path::PathBuf, sync::Arc};
use tokio::signal;
use tracing::{error, info};

fn dirs() -> Result<ProjectDirs> { 
    ProjectDirs::from("dev","sage","valve").context("dirs") 
}

fn lockfile_path() -> Result<PathBuf> { 
    Ok(dirs()?.runtime_dir().unwrap_or(dirs()?.data_dir()).join("valve.lock")) 
}

pub async fn run_foreground(port: u16) -> Result<()> {
    // Single-instance lock
    let lock_path = lockfile_path()?;
    std::fs::create_dir_all(lock_path.parent().unwrap())?;
    let file = File::create(&lock_path)?;
    let mut lock = RwLock::new(file);
    let _lock_guard = lock.try_write().context("valve already running?")?;

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
        if let Err(e) = control::server(port, reg_cp, chron_cp).await { 
            error!(?e, "control plane exit"); 
        }
    });

    // Start supervisor over all codebases in registry
    let mut sup = Supervisor::new(chron_file);
    sup.reconcile(reg.clone()).await?; // spawn watchers for existing codebases

    info!("valve running on port {}", port);

    // Handle reload signals (SIGHUP => reload registry)
    let mut hup = signal::unix::signal(signal::unix::SignalKind::hangup()).ok();
    let mut term = signal::unix::signal(signal::unix::SignalKind::terminate()).ok();

    loop {
        tokio::select! {
            _ = tokio::signal::ctrl_c() => { break; }
            _ = async { 
                if let Some(s) = &mut hup { 
                    s.recv().await 
                } else { 
                    std::future::pending().await 
                } 
            } => {
                if let Err(e) = sup.reconcile(reg.clone()).await { 
                    error!(?e, "reconcile"); 
                }
            }
            _ = async { 
                if let Some(s) = &mut term { 
                    s.recv().await 
                } else { 
                    std::future::pending().await 
                } 
            } => { 
                break; 
            }
        }
    }

    // graceful shutdown
    sup.shutdown().await;
    ctrl.abort();
    info!("valve stopped");
    Ok(())
}