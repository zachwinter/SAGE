use crate::{config, persona::{self, ValveEvent}};
use anyhow::Result;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, EventKind};
use std::{fs, path::Path};
use tracing::{debug, info, warn};
use tokio::io::AsyncWriteExt;

pub async fn watch_codebase(cb: &crate::state::Codebase, chronicle: &Path) -> Result<()> {
    let repo = cb.path.clone();
    let cfg = match config::ValveConfig::load_from_repo(&repo) { 
        Ok(c) => c, 
        Err(e) => { 
            warn!(?e, "no valve.yml; watching anyway"); 
            config::ValveConfig { personas: Default::default() } 
        } 
    };
    let personas = config::compile(&cfg)?;

    // channel bridge
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let mut watcher: RecommendedWatcher = Watcher::new(move |res| { 
        let _ = tx.send(res); 
    }, notify::Config::default())?;
    watcher.watch(&repo, RecursiveMode::Recursive)?;

    info!(repo=%repo.display(), personas = personas.len(), "watching");

    // writer for chronicles
    let chron = fs::OpenOptions::new().create(true).append(true).open(chronicle)?;
    let mut chron = tokio::fs::File::from_std(chron);

    while let Some(res) = rx.recv().await {
        match res {
            Ok(event) => {
                if !matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)) { 
                    continue; 
                }
                for path in event.paths {
                    if let Some(rel) = path.strip_prefix(&repo).ok() {
                        // read content for triggers if file exists
                        let text = tokio::fs::read_to_string(&path).await.ok();
                        let hits: Vec<ValveEvent> = persona::match_personas(&personas, &repo, rel, text.as_deref());
                        for ev in hits {
                            let line = serde_json::to_string(&ev)? + "\n";
                            chron.write_all(line.as_bytes()).await?;
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