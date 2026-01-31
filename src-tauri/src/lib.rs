use tauri::{command, Manager};
// 引入磨砂效果库
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
use font_kit::source::SystemSource;

mod wine_runner;
mod storage;

#[command]
fn get_home_dir() -> String {
    // 使用 dirs crate 获取主目录，如果获取失败返回空字符串
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

#[command]
fn get_system_fonts() -> Vec<String> {
    let source = SystemSource::new();
    match source.all_families() {
        Ok(families) => {
            let mut fonts = families;
            fonts.sort(); // 排序
            fonts.dedup(); // 去重
            fonts
        },
        Err(_) => vec!["System Default".to_string()]
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            wine_runner::launch_game,
            wine_runner::get_crossover_bottles,
            storage::save_instances,
            storage::load_instances,
            get_home_dir,
            get_system_fonts
        ])
        .setup(|app| {
            // 获取主窗口
            let window = app.get_webview_window("main").unwrap();

            // 仅在 macOS 上应用磨砂效果
            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            // 初始化数据库 (预留位置)
            // database::init_db();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
