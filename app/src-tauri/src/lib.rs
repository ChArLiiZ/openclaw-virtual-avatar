use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

fn ensure_window(app: &tauri::AppHandle, label: &str, title: &str, hash: &str, visible: bool) {
    if app.get_webview_window(label).is_some() {
        return;
    }

    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(format!("/#{}", hash).into()))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label != "avatar" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
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
