use std::fs;
use std::io::Write;
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

struct Server(Mutex<Option<Child>>);

fn random_hex(bytes: usize) -> Result<String, String> {
    let mut buffer = vec![0u8; bytes];
    getrandom::fill(&mut buffer).map_err(|error| error.to_string())?;
    Ok(buffer.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn app_secret(data_dir: &Path) -> Result<String, String> {
    let file = data_dir.join("app-secret");
    if let Ok(existing) = fs::read_to_string(&file) {
        let trimmed = existing.trim().to_string();
        if trimmed.len() >= 32 {
            return Ok(trimmed);
        }
    }
    let secret = random_hex(48)?;
    fs::write(&file, &secret).map_err(|error| error.to_string())?;
    Ok(secret)
}

fn plain(path: PathBuf) -> PathBuf {
    let text = path.to_string_lossy();
    match text.strip_prefix(r"\\?\") {
        Some(rest) => PathBuf::from(rest),
        None => path,
    }
}

fn free_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    Ok(port)
}

fn node_binary() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    let dir = exe.parent().ok_or("The app folder could not be found.")?;
    Ok(dir.join(format!("node{}", std::env::consts::EXE_SUFFIX)))
}

fn wait_for(port: u16, timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(200));
    }
    false
}

fn start_server(app: &tauri::AppHandle) -> Result<String, String> {
    let data_dir = plain(app.path().app_data_dir().map_err(|error| error.to_string())?);
    let log_dir = data_dir.join("logs");
    fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;
    let server_dir = plain(app.path().resource_dir().map_err(|error| error.to_string())?).join("app");
    let port = free_port()?;
    let token = random_hex(32)?;
    let secret = app_secret(&data_dir)?;
    let url = format!("http://127.0.0.1:{port}");
    let log = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("server.log"))
        .map_err(|error| error.to_string())?;
    let errors = log.try_clone().map_err(|error| error.to_string())?;

    let mut command = Command::new(node_binary()?);
    command
        .arg(server_dir.join("start.mjs"))
        .current_dir(&server_dir)
        .env("NODE_ENV", "production")
        .env("HOLDALL_TARGET", "desktop")
        .env("HOLDALL_LAUNCH_TOKEN", &token)
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("APP_URL", &url)
        .env("APP_SECRET", &secret)
        .env("DATA_DIR", &data_dir)
        .env("NEXT_TELEMETRY_DISABLED", "1")
        .env("HOLDALL_PARENT_PID", std::process::id().to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(errors));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let child = command.spawn().map_err(|error| format!("The Holdall server could not start: {error}"))?;
    app.state::<Server>().0.lock().map_err(|error| error.to_string())?.replace(child);

    if !wait_for(port, Duration::from_secs(60)) {
        return Err(format!("The Holdall server did not answer. See {}", log_dir.join("server.log").display()));
    }
    Ok(format!("{url}/api/desktop/start?launch={token}"))
}

fn open_window(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    let target = url.parse().map_err(|_| "Invalid server address.".to_string())?;
    let handle = app.clone();
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(target))
        .on_navigation(move |next| {
            let web = next.scheme() == "http" || next.scheme() == "https";
            let local = matches!(next.host_str(), Some("127.0.0.1") | Some("localhost"));
            if !web || local {
                return true;
            }
            let _ = handle.opener().open_url(next.as_str(), None::<&str>);
            false
        })
        .title("Holdall")
        .inner_size(1280.0, 800.0)
        .min_inner_size(375.0, 600.0)
        .build()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn log_line(app: &tauri::AppHandle, message: &str) {
    if let Ok(dir) = app.path().app_data_dir() {
        let _ = fs::create_dir_all(dir.join("logs"));
        if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(dir.join("logs").join("desktop.log")) {
            let _ = writeln!(file, "{message}");
        }
    }
}

fn stop_server(app: &tauri::AppHandle) {
    if let Ok(mut server) = app.state::<Server>().0.lock() {
        if let Some(mut child) = server.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

async fn offer_update(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(update) = app.updater().map_err(|error| error.to_string())?.check().await.map_err(|error| error.to_string())? else {
        return Ok(());
    };
    let accepted = app
        .dialog()
        .message(format!(
            "Holdall {} is available. You have version {}.\n\nUpdate now? Holdall downloads it, installs it and restarts. Your data is kept.",
            update.version, update.current_version
        ))
        .title("Update available")
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom("Update now".to_string(), "Later".to_string()))
        .blocking_show();
    if !accepted {
        return Ok(());
    }
    let bytes = update.download(|_, _| {}, || {}).await.map_err(|error| error.to_string())?;
    stop_server(app);
    update.install(bytes).map_err(|error| error.to_string())?;
    app.restart();
}

fn report(app: &tauri::AppHandle, message: &str) {
    log_line(app, message);
    let page = format!(
        "data:text/html,<body style=\"font-family:sans-serif;padding:24px\"><h1>Holdall could not start</h1><p>{}</p></body>",
        message.replace('<', "&lt;").replace('#', "%23")
    );
    let _ = open_window(app, &page);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Server(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            thread::spawn(move || {
                let result = if cfg!(debug_assertions) {
                    Ok("http://localhost:3000".to_string())
                } else {
                    start_server(&handle)
                };
                match result {
                    Ok(url) => {
                        if let Err(error) = open_window(&handle, &url) {
                            report(&handle, &error);
                        } else if !cfg!(debug_assertions) {
                            if let Err(error) = tauri::async_runtime::block_on(offer_update(&handle)) {
                                log_line(&handle, &format!("Update check failed: {error}"));
                            }
                        }
                    }
                    Err(error) => report(&handle, &error),
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Holdall could not start its window. Reinstall the app, then report the issue if it persists.");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            stop_server(handle);
        }
    });
}
