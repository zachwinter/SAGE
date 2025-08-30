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