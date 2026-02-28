use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{command, AppHandle, Emitter};
use std::time::Instant;
use std::thread;

#[derive(serde::Deserialize)]
pub struct WineConfig {
    pub bottle_path: String,
    pub game_exe: String,
    pub crossover_app_path: String,
}

#[derive(serde::Serialize, Clone)]
struct GameFinishedPayload {
    instance_id: String,
    duration_sec: u64,
}

// 如果字符串以 ~/ 开头，则将其替换为真实的系统家目录
fn expand_tilde(path_str: &str) -> PathBuf {
    if path_str.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            // 去掉前缀 "~/"，把剩下的部分拼接到 home 目录后面
            return home.join(path_str.trim_start_matches("~/"));
        }
    }
    // 如果没有 ~，或者获取 Home 目录失败，直接返回原路径
    PathBuf::from(path_str)
}

#[command]
pub async fn launch_game(app: AppHandle, instance_id: String, config: WineConfig) -> Result<String, String> {
    println!("正在启动实例 ID: {}, 路径: {}", instance_id, config.game_exe);

    let game_path = expand_tilde(&config.game_exe);
    if !game_path.exists() {
        return Err(format!("找不到可执行文件，可能位于外接硬盘但未连接，请检查磁盘连接情况: {:?}", config.game_exe));
    }

    // 1. 定位 CrossOver
    let crossover_app_dir = expand_tilde(&config.crossover_app_path);
    let crossover_bin = crossover_app_dir.join("Contents/SharedSupport/CrossOver/bin/wine");

    if !crossover_bin.exists() {
        return Err(format!("未找到 CrossOver 核心文件，请检查设置路径: {:?}", crossover_bin));
    }

    // 2. 解析容器名
    let bottle_path_buf = expand_tilde(&config.bottle_path);
    let bottle_name = bottle_path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("无法解析容器名称")?;

    // 3. 构建命令
    let mut cmd = Command::new(&crossover_bin);
    cmd.env("CX_BOTTLE", bottle_name);
    cmd.env("WINEPREFIX", &bottle_path_buf);
    cmd.env("LC_ALL", "zh_CN.UTF-8");
    cmd.env("WINEDEBUG", "-all");
    cmd.arg(&game_path);

    // 4. 启动子进程
    let mut child = cmd.spawn().map_err(|e| format!("启动失败: {}", e))?;
    let pid = child.id();
    
    // 5. 开启后台线程等待游戏结束，计算时长
    let app_handle = app.clone();
    let i_id = instance_id.clone();
    
    thread::spawn(move || {
        let start_time = Instant::now();
        match child.wait() {
            Ok(status) => {
                let duration = start_time.elapsed().as_secs();
                println!("游戏 {} 已退出，状态: {}, 时长: {}秒", i_id, status, duration);
                let _ = app_handle.emit("game-finished", GameFinishedPayload {
                    instance_id: i_id,
                    duration_sec: duration
                });
            }
            Err(e) => println!("等待进程失败: {}", e),
        }
    });

    Ok(format!("{}", pid))
}

#[command]
pub fn get_crossover_bottles(path: String) -> Result<Vec<String>, String> {
    let bottles_path = expand_tilde(&path);

    if !bottles_path.exists() {
        return Err(format!("未找到容器目录: {:?}", bottles_path));
    }

    let mut bottles = Vec::new();

    let entries = fs::read_dir(bottles_path).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                bottles.push(name.to_string());
            }
        }
    }

    Ok(bottles)
}
