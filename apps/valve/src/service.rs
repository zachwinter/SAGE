use anyhow::Result;

pub fn install_service() -> Result<()> {
    #[cfg(target_os = "linux")]
    {
        let unit = r#"[Unit]
Description=SAGE Valve
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/sage-valve run
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"#;
        std::fs::write("/etc/systemd/system/sage-valve.service", unit)?;
        std::process::Command::new("systemctl").args(["daemon-reload"]).status()?;
        std::process::Command::new("systemctl").args(["enable", "sage-valve"]).status()?;
        println!("installed systemd service");
        return Ok(());
    }
    
    #[cfg(target_os = "macos")]
    {
        let plist = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>dev.sage.valve</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/sage-valve</string>
        <string>run</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
"#;
        let path = format!("{}/Library/LaunchAgents/dev.sage.valve.plist", std::env::var("HOME")?);
        std::fs::write(&path, plist)?;
        println!("installed launchd plist at {}", path);
        return Ok(());
    }
    
    #[cfg(target_os = "windows")]
    {
        println!("Please register as a Windows service (stub). For dev: use Task Scheduler or run foreground.");
        return Ok(());
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        use anyhow::anyhow;
        Err(anyhow!("service install not supported on this OS"))
    }
}

pub fn uninstall_service() -> Result<()> { 
    println!("uninstall stub"); 
    Ok(()) 
}

pub fn start_service() -> Result<()> { 
    println!("start stub"); 
    Ok(()) 
}

pub fn stop_service() -> Result<()> { 
    println!("stop stub"); 
    Ok(()) 
}