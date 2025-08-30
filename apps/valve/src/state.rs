use anyhow::{Context, Result};
use directories::ProjectDirs;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::{Path, PathBuf}, sync::Arc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Codebase { pub id: String, pub path: PathBuf }

#[derive(Debug, Default, Serialize, Deserialize, Clone)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_registry_add_and_remove() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("HOME", temp_dir.path());
        
        let mut registry = Registry::load_or_default().expect("Failed to load registry");
        let initial_count = registry.codebases.len();
        
        // Add a codebase
        let test_path = temp_dir.path().join("test_project");
        std::fs::create_dir_all(&test_path).expect("Failed to create test directory");
        let codebase = registry.add(&test_path).expect("Failed to add codebase");
        
        assert_eq!(registry.codebases.len(), initial_count + 1);
        assert_eq!(codebase.path, test_path.canonicalize().unwrap());
        
        // Remove by ID
        let removed = registry.remove_by_id_or_path(&codebase.id).expect("Failed to remove codebase");
        assert!(removed.is_some());
        assert_eq!(registry.codebases.len(), initial_count);
    }
    
    #[test]
    fn test_shared_registry() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("HOME", temp_dir.path());
        
        let registry = Registry::load_or_default().expect("Failed to load registry");
        let shared_registry = SharedRegistry::new(registry);
        
        // Test that we can clone the shared registry
        let shared_registry_clone = shared_registry.clone();
        
        // Both should point to the same data
        assert!(std::ptr::eq(shared_registry.0.as_ref(), shared_registry_clone.0.as_ref()));
    }
    
    #[test]
    fn test_remove_nonexistent() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("HOME", temp_dir.path());
        
        let mut registry = Registry::load_or_default().expect("Failed to load registry");
        
        // Try to remove a non-existent codebase
        let removed = registry.remove_by_id_or_path("nonexistent").expect("Failed to remove codebase");
        assert!(removed.is_none());
    }
}