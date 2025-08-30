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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{ValveConfig, compile};
    use std::fs;
    use tempfile::TempDir;
    
    #[test]
    fn test_match_personas_with_glob_only() {
        let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.txt"]
"#;
        
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let sage_dir = temp_dir.path().join(".sage");
        std::fs::create_dir_all(&sage_dir).expect("Failed to create .sage directory");
        let config_file = sage_dir.join("valve.yml");
        fs::write(&config_file, config_str).expect("Failed to write config file");
        
        let config = ValveConfig::load_from_repo(temp_dir.path()).expect("Failed to load config");
        let compiled = compile(&config).expect("Failed to compile personas");
        
        let repo = temp_dir.path();
        let rel = Path::new("test.txt");
        
        let events = match_personas(&compiled, repo, rel, None);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].persona, "TestWatcher");
        assert_eq!(events[0].reason, "glob");
    }
    
    #[test]
    fn test_match_personas_with_glob_and_trigger() {
        let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.rs"]
    triggers: ["fn\\s+main"]
"#;
        
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let sage_dir = temp_dir.path().join(".sage");
        std::fs::create_dir_all(&sage_dir).expect("Failed to create .sage directory");
        let config_file = sage_dir.join("valve.yml");
        fs::write(&config_file, config_str).expect("Failed to write config file");
        
        let config = ValveConfig::load_from_repo(temp_dir.path()).expect("Failed to load config");
        let compiled = compile(&config).expect("Failed to compile personas");
        
        let repo = temp_dir.path();
        let rel = Path::new("main.rs");
        let content = Some("fn main() { println!(\"Hello, world!\"); }");
        
        let events = match_personas(&compiled, repo, rel, content);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].persona, "TestWatcher");
        assert_eq!(events[0].reason, "glob+trigger");
    }
    
    #[test]
    fn test_no_match_when_glob_does_not_match() {
        let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.txt"]
    triggers: ["fn\\s+main"]
"#;
        
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let sage_dir = temp_dir.path().join(".sage");
        std::fs::create_dir_all(&sage_dir).expect("Failed to create .sage directory");
        let config_file = sage_dir.join("valve.yml");
        fs::write(&config_file, config_str).expect("Failed to write config file");
        
        let config = ValveConfig::load_from_repo(temp_dir.path()).expect("Failed to load config");
        let compiled = compile(&config).expect("Failed to compile personas");
        
        let repo = temp_dir.path();
        let rel = Path::new("main.rs"); // This doesn't match the glob
        let content = Some("fn main() { println!(\"Hello, world!\"); }");
        
        let events = match_personas(&compiled, repo, rel, content);
        assert_eq!(events.len(), 0);
    }
    
    #[test]
    fn test_no_match_when_trigger_does_not_match() {
        let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.rs"]
    triggers: ["fn\\s+main"]
"#;
        
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let sage_dir = temp_dir.path().join(".sage");
        std::fs::create_dir_all(&sage_dir).expect("Failed to create .sage directory");
        let config_file = sage_dir.join("valve.yml");
        fs::write(&config_file, config_str).expect("Failed to write config file");
        
        let config = ValveConfig::load_from_repo(temp_dir.path()).expect("Failed to load config");
        let compiled = compile(&config).expect("Failed to compile personas");
        
        let repo = temp_dir.path();
        let rel = Path::new("main.rs");
        let content = Some("fn test() { println!(\"Hello, world!\"); }"); // This doesn't match the trigger
        
        let events = match_personas(&compiled, repo, rel, content);
        assert_eq!(events.len(), 0);
    }
}