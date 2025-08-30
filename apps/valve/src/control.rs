use crate::state::{Registry, SharedRegistry};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{net::SocketAddr};
use tokio::{io::{AsyncBufReadExt, AsyncWriteExt, BufReader}, net::{TcpListener, TcpStream}};
use tracing::{info, warn};

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum Command { 
    Register { path: String }, 
    Unregister { target: String }, 
    List 
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum Reply { 
    Ok, 
    Error { message: String }, 
    List { items: Vec<(String,String)> } 
}

pub async fn server(port: u16, reg: std::sync::Arc<Registry>, _chron: std::path::PathBuf) -> Result<()> {
    let addr = SocketAddr::from(([127,0,0,1], port));
    let listener = TcpListener::bind(addr).await?;
    info!(%addr, "control listening");

    let shared = SharedRegistry::new(reg.as_ref().clone());

    loop {
        let (sock, _) = listener.accept().await?;
        let sreg = shared.clone();
        tokio::spawn(async move {
            if let Err(e) = handle(sock, sreg).await { 
                warn!(?e, "control session"); 
            }
        });
    }
}

async fn handle(sock: TcpStream, shared: SharedRegistry) -> Result<()> {
    let (r, mut w) = sock.into_split();
    let mut br = BufReader::new(r);
    let mut line = String::new();
    while br.read_line(&mut line).await? > 0 {
        let cmd: Command = match serde_json::from_str(line.trim()) { 
            Ok(c) => c, 
            Err(e) => { 
                let error_response = json!(Reply::Error{ message: e.to_string() }).to_string();
                w.write_all(error_response.as_bytes()).await?; 
                w.write_all(b"\n").await?; 
                line.clear(); 
                continue; 
            } 
        };
        
        // Process the command and generate response
        let response = match cmd {
            Command::Register { path } => {
                let mut reg = shared.0.write();
                match reg.add(path) { 
                    Ok(_cb) => { 
                        json!(Reply::Ok).to_string()
                    }, 
                    Err(e) => { 
                        json!(Reply::Error{ message: e.to_string() }).to_string()
                    } 
                }
            }
            Command::Unregister { target } => {
                let mut reg = shared.0.write();
                match reg.remove_by_id_or_path(&target) { 
                    Ok(Some(_)) => {
                        json!(Reply::Ok).to_string()
                    },
                    Ok(None) => {
                        json!(Reply::Error{ message: "not found".into() }).to_string()
                    },
                    Err(e) => {
                        json!(Reply::Error{ message: e.to_string() }).to_string()
                    },
                }
            }
            Command::List => {
                let reg = shared.0.read();
                let items: Vec<_> = reg.codebases.values().map(|c| (c.id.clone(), c.path.to_string_lossy().to_string())).collect();
                json!(Reply::List{ items }).to_string()
            }
        };
        
        // Send the response
        w.write_all(response.as_bytes()).await?;
        w.write_all(b"\n").await?;
        line.clear();
    }
    Ok(())
}

// Small client helpers for the CLI
pub async fn client_register(port: u16, path: String) -> Result<()> { 
    client_send(port, serde_json::json!({"type":"Register","path":path})).await 
}

pub async fn client_unregister(port: u16, target: String) -> Result<()> { 
    client_send(port, serde_json::json!({"type":"Unregister","target":target})).await 
}

pub async fn client_list(port: u16) -> Result<()> { 
    client_send(port, serde_json::json!({"type":"List"})).await 
}

async fn client_send(port: u16, msg: serde_json::Value) -> Result<()> {
    let addr = format!("127.0.0.1:{}", port);
    let mut s = TcpStream::connect(addr).await.context("connect control")?;
    s.write_all(msg.to_string().as_bytes()).await?; 
    s.write_all(b"\n").await?;
    let mut br = BufReader::new(s);
    let mut line = String::new();
    if br.read_line(&mut line).await? > 0 { 
        println!("{}", line.trim()); 
    }
    Ok(())
}