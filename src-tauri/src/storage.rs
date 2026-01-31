use tauri::{AppHandle, command, Manager};
use tauri::path::BaseDirectory;
use std::fs;
use std::path::PathBuf;

// 定义文件名
const DATA_FILENAME: &str = "instances.json";

// 获取数据文件路径
fn get_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().resolve(DATA_FILENAME, BaseDirectory::AppLocalData)
        .map_err(|e| e.to_string())?;
    Ok(path)
}

#[command]
pub fn save_instances(app: AppHandle, data: String) -> Result<(), String> {
    let path = get_data_path(&app)?;
    
    // 确保目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(&path, data).map_err(|e| format!("无法写入文件: {}", e))?;
    println!("数据已保存到: {:?}", path);
    Ok(())
}

#[command]
pub fn load_instances(app: AppHandle) -> Result<String, String> {
    let path = get_data_path(&app)?;
    
    if !path.exists() {
        // 如果文件不存在，返回空数组 JSON
        return Ok("[]".to_string());
    }

    let data = fs::read_to_string(&path).map_err(|e| format!("无法读取文件: {}", e))?;
    Ok(data)
}