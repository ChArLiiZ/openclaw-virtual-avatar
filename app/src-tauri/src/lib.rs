use std::process::{Child, Command};
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

// ==================== Child process state ====================

struct Services {
    python: Option<Child>,
    node: Option<Child>,
}

impl Services {
    fn kill_all(&mut self) {
        for (name, child) in [("Python", &mut self.python), ("Node", &mut self.node)] {
            if let Some(proc) = child.take() {
                let pid = proc.id();
                // On Windows, child processes spawned via conda/cmd may leave grandchildren.
                // Use `taskkill /T /F` to kill the entire process tree.
                #[cfg(target_os = "windows")]
                {
                    let _ = Command::new("taskkill")
                        .args(["/T", "/F", "/PID", &pid.to_string()])
                        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
                        .status();
                    println!("[Tray] Killed {name} tree (pid {pid})");
                }
                #[cfg(not(target_os = "windows"))]
                {
                    let mut proc = proc;
                    let _ = proc.kill();
                    let _ = proc.wait();
                    println!("[Tray] Killed {name} (pid {pid})");
                }
            }
        }
    }
}

impl Drop for Services {
    fn drop(&mut self) {
        self.kill_all();
    }
}

// ==================== Window helpers ====================

fn ensure_window(app: &tauri::AppHandle, label: &str, title: &str, hash: &str, visible: bool) {
    if app.get_webview_window(label).is_some() {
        return;
    }

    let mut builder =
        WebviewWindowBuilder::new(app, label, WebviewUrl::App(format!("/#{}", hash).into()))
            .title(title)
            .visible(visible);

    builder = match label {
        "avatar" => builder
            .inner_size(160.0, 160.0)
            .min_inner_size(100.0, 100.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .shadow(false)
            .skip_taskbar(false),
        "chat" => builder
            .inner_size(480.0, 720.0)
            .min_inner_size(380.0, 520.0)
            .resizable(true)
            .decorations(true),
        "record" => builder
            .inner_size(420.0, 520.0)
            .min_inner_size(360.0, 420.0)
            .resizable(false)
            .decorations(true),
        _ => builder
            .inner_size(1440.0, 960.0)
            .min_inner_size(1180.0, 760.0)
            .resizable(true)
            .decorations(true),
    };

    builder.build().expect("failed to build window");
}

fn show_window(app: &tauri::AppHandle, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

// ==================== Service spawning ====================

/// Resolve the `media-server/` directory relative to the Tauri project root.
/// In dev mode the manifest sits at `app/src-tauri/`, so ../../media-server.
fn find_media_server_dir() -> Option<std::path::PathBuf> {
    // Compile-time path (available in dev builds).
    if let Some(dir) = option_env!("CARGO_MANIFEST_DIR").map(std::path::PathBuf::from) {
        let candidate = dir.join("..").join("..").join("media-server");
        if candidate.join("src").join("index.js").exists() {
            return Some(std::fs::canonicalize(&candidate).unwrap_or(candidate));
        }
    }

    // Fallback: walk up from the executable.
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent().map(|p| p.to_path_buf());
        for _ in 0..8 {
            if let Some(ref d) = dir {
                let candidate = d.join("media-server");
                if candidate.join("src").join("index.js").exists() {
                    return Some(std::fs::canonicalize(&candidate).unwrap_or(candidate));
                }
                dir = d.parent().map(|p| p.to_path_buf());
            }
        }
    }

    None
}

/// Find the conda executable on this system.
fn find_conda() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("where")
            .arg("conda")
            .creation_flags(0x0800_0000)
            .output()
        {
            if output.status.success() {
                if let Some(line) = String::from_utf8_lossy(&output.stdout).lines().next() {
                    let trimmed = line.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
        }

        // Common install locations
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        for sub in [
            "miniforge3",
            "miniconda3",
            "anaconda3",
            "Miniforge3",
            "Miniconda3",
            "Anaconda3",
        ] {
            let exe = std::path::PathBuf::from(&home)
                .join(sub)
                .join("condabin")
                .join("conda.bat");
            if exe.exists() {
                return Some(exe.to_string_lossy().to_string());
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = Command::new("which").arg("conda").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }
    }

    None
}

fn spawn_services(media_server_dir: &std::path::Path) -> Services {
    let conda = find_conda();
    let env_name = "openclaw-virtual-avatar";

    // --- Python (port 8081) ---
    let python = if let Some(ref conda_exe) = conda {
        let mut cmd = Command::new(conda_exe);
        cmd.args([
            "run",
            "-n",
            env_name,
            "python",
            "-u",
            "python/server.py",
        ])
        .current_dir(media_server_dir);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

        match cmd.spawn() {
            Ok(child) => {
                println!("[Services] Python started (pid {})", child.id());
                Some(child)
            }
            Err(e) => {
                eprintln!("[Services] Failed to start Python: {e}");
                None
            }
        }
    } else {
        eprintln!("[Services] conda not found — skipping Python service");
        None
    };

    // Brief pause so Python starts binding its port before Node tries to proxy.
    std::thread::sleep(std::time::Duration::from_secs(2));

    // --- Node.js (port 8080) ---
    let node = {
        let mut cmd = Command::new("node");
        cmd.arg("src/index.js").current_dir(media_server_dir);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

        match cmd.spawn() {
            Ok(child) => {
                println!("[Services] Node started (pid {})", child.id());
                Some(child)
            }
            Err(e) => {
                eprintln!("[Services] Failed to start Node: {e}");
                None
            }
        }
    };

    Services { python, node }
}

// ==================== Tray ====================

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show_avatar = MenuItemBuilder::with_id("show_avatar", "顯示 Avatar").build(app)?;
    let show_chat = MenuItemBuilder::with_id("show_chat", "顯示 Chat").build(app)?;
    let show_settings = MenuItemBuilder::with_id("show_settings", "顯示 Settings").build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit_all", "退出全部").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_avatar)
        .item(&show_chat)
        .item(&show_settings)
        .item(&separator)
        .item(&quit)
        .build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().expect("no app icon"))
        .tooltip("Virtual Avatar")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_avatar" => show_window(app, "avatar"),
            "show_chat" => show_window(app, "chat"),
            "show_settings" => show_window(app, "settings"),
            "quit_all" => {
                if let Some(state) = app.try_state::<Mutex<Services>>() {
                    if let Ok(mut svc) = state.lock() {
                        svc.kill_all();
                    }
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                if button == tauri::tray::MouseButton::Left {
                    show_window(tray.app_handle(), "avatar");
                }
            }
        })
        .build(app)?;

    Ok(())
}

// ==================== Entry point ====================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .on_window_event(|window, event| {
            // All windows hide on close — only tray "退出全部" truly exits.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            // Spawn backend services
            let services = match find_media_server_dir() {
                Some(dir) => {
                    println!("[Setup] media-server dir: {}", dir.display());
                    spawn_services(&dir)
                }
                None => {
                    eprintln!("[Setup] media-server directory not found — services not started");
                    Services {
                        python: None,
                        node: None,
                    }
                }
            };
            app.manage(Mutex::new(services));

            // Build system tray
            build_tray(app)?;

            // Create windows
            let handle = app.handle().clone();
            ensure_window(&handle, "avatar", "Avatar", "avatar", true);
            ensure_window(&handle, "chat", "Chat", "chat", false);
            ensure_window(&handle, "record", "Record", "record", false);
            ensure_window(&handle, "settings", "Settings", "settings", false);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
