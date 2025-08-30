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

#[cfg(test)]
mod tests {
    use std::fs;
    use tempfile::TempDir;
    use super::*; // Import everything from the parent module

    #[test]
    fn test_load_config_from_file() {
        let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.txt"]
    triggers: ["test"]
    response: "test-response"
    severity: "low"
"#;
        
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let sage_dir = temp_dir.path().join(".sage");
        std::fs::create_dir_all(&sage_dir).expect("Failed to create .sage directory");
        let config_file = sage_dir.join("valve.yml");
        fs::write(&config_file, config_str).expect("Failed to write config file");
        
        let config = ValveConfig::load_from_repo(temp_dir.path()).expect("Failed to load config");
        
        assert_eq!(config.personas.len(), 1);
        let persona = config.personas.get("TestWatcher").expect("TestWatcher not found");
        assert_eq!(persona.filters.as_ref().unwrap().len(), 1);
        assert_eq!(persona.triggers.as_ref().unwrap().len(), 1);
        assert_eq!(persona.response.as_ref().unwrap(), "test-response");
        assert_eq!(persona.severity.as_ref().unwrap(), "low");
    }

    #[test]
    fn test_compile_personas() {
        let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.txt"]
    triggers: ["test"]
    response: "test-response"
    severity: "low"
  AnotherWatcher:
    filters: ["**/*.rs", "**/*.toml"]
    triggers: ["fn\\s+main", "println!"]
    response: "rust-code-detected"
"#;
        
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let sage_dir = temp_dir.path().join(".sage");
        std::fs::create_dir_all(&sage_dir).expect("Failed to create .sage directory");
        let config_file = sage_dir.join("valve.yml");
        fs::write(&config_file, config_str).expect("Failed to write config file");
        
        let config = ValveConfig::load_from_repo(temp_dir.path()).expect("Failed to load config");
        let compiled = compile(&config).expect("Failed to compile personas");
        
        assert_eq!(compiled.len(), 2);
        
        // Find the TestWatcher persona
        let test_watcher = compiled.iter().find(|p| p.name == "TestWatcher").expect("TestWatcher not found");
        assert_eq!(test_watcher.globset.len(), 1);
        assert_eq!(test_watcher.triggers.len(), 1);
        assert_eq!(test_watcher.response.as_ref().unwrap(), "test-response");
        assert_eq!(test_watcher.severity.as_ref().unwrap(), "low");
        
        // Find the AnotherWatcher persona
        let another_watcher = compiled.iter().find(|p| p.name == "AnotherWatcher").expect("AnotherWatcher not found");
        assert_eq!(another_watcher.globset.len(), 2);
        assert_eq!(another_watcher.triggers.len(), 2);
        assert_eq!(another_watcher.response.as_ref().unwrap(), "rust-code-detected");
    }

    #[test]
    fn test_glob_matching() {
        let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.txt", "**/*.md"]
    triggers: ["test"]
"#;
        
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let sage_dir = temp_dir.path().join(".sage");
        std::fs::create_dir_all(&sage_dir).expect("Failed to create .sage directory");
        let config_file = sage_dir.join("valve.yml");
        fs::write(&config_file, config_str).expect("Failed to write config file");
        
        let config = ValveConfig::load_from_repo(temp_dir.path()).expect("Failed to load config");
        let compiled = compile(&config).expect("Failed to compile personas");
        
        let persona = compiled.iter().find(|p| p.name == "TestWatcher").expect("TestWatcher not found");
        assert!(persona.globset.is_match("test.txt"));
        assert!(persona.globset.is_match("docs/readme.md"));
        assert!(!persona.globset.is_match("src/main.rs"));
    }

    #[test]
    fn test_trigger_matching() {
        let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.rs"]
    triggers: ["fn\\s+main", "println!"]
"#;
        
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let sage_dir = temp_dir.path().join(".sage");
        std::fs::create_dir_all(&sage_dir).expect("Failed to create .sage directory");
        let config_file = sage_dir.join("valve.yml");
        fs::write(&config_file, config_str).expect("Failed to write config file");
        
        let config = ValveConfig::load_from_repo(temp_dir.path()).expect("Failed to load config");
        let compiled = compile(&config).expect("Failed to compile personas");
        
        let persona = compiled.iter().find(|p| p.name == "TestWatcher").expect("TestWatcher not found");
        assert!(persona.triggers[0].is_match("fn main() {"));
        assert!(persona.triggers[1].is_match("println!(\"Hello, world!\");"));
        assert!(!persona.triggers[0].is_match("fn test() {"));
    }
}