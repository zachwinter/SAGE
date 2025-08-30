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
    pub fn new(chronicle: PathBuf) -> Self { 
        Self { 
            chronicle, 
            tasks: HashMap::new() 
        } 
    }

    pub async fn reconcile(&mut self, reg: std::sync::Arc<Registry>) -> Result<()> {
        let current: std::collections::HashSet<_> = reg.codebases.keys().cloned().collect();
        // stop tasks that no longer exist
        self.tasks.retain(|id, handle| { 
            if !current.contains(id) { 
                handle.abort(); 
                false 
            } else { 
                true 
            } 
        });
        // start missing
        for (id, cb) in reg.codebases.iter() { 
            if !self.tasks.contains_key(id) { 
                self.spawn_watcher(id.clone(), cb.clone()); 
            } 
        }
        Ok(())
    }

    fn spawn_watcher(&mut self, id: String, cb: Codebase) {
        let chron = self.chronicle.clone();
        let id_clone = id.clone(); // Clone the id for use in the async block
        let handle = tokio::spawn(async move {
            let mut backoff = 1u64;
            loop {
                match watch_codebase(&cb, &chron).await {
                    Ok(_) => { 
                        info!(%id_clone, "watcher finished normally"); 
                        break; 
                    }
                    Err(e) => {
                        warn!(%id_clone, ?e, "watcher crashed, restarting");
                        sleep(Duration::from_secs(backoff.min(60))).await;
                        backoff = (backoff * 2).min(60);
                    }
                }
            }
        });
        self.tasks.insert(id, handle);
    }

    pub async fn shutdown(&mut self) { 
        for (_, h) in self.tasks.drain() { 
            h.abort(); 
        } 
    }
}