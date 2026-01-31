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

#[command]
pub async fn launch_game(app: AppHandle, instance_id: String, config: WineConfig) -> Result<String, String> {
    println!("正在启动实例 ID: {}, 路径: {}", instance_id, config.game_exe);

    let game_path = PathBuf::from(&config.game_exe);
    if !game_path.exists() {
        // 如果文件不存在，直接返回错误
        // 这会导致前端 invoke 抛出异常，进入 catch 块
        return Err(format!("找不到可执行文件，可能位于外接硬盘但未连接，请检查磁盘连接情况: {:?}", config.game_exe));
    }

    // 1. 定位 CrossOver
    let crossover_bin = PathBuf::from(&config.crossover_app_path)
        .join("Contents/SharedSupport/CrossOver/bin/wine");

    if !crossover_bin.exists() {
        return Err(format!("未找到 CrossOver 核心文件，请检查设置路径: {:?}", crossover_bin));
    }

    // 2. 解析容器名
    let bottle_path_buf = PathBuf::from(&config.bottle_path);
    let bottle_name = bottle_path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("无法解析容器名称")?;

    // 3. 构建命令
    let mut cmd = Command::new(&crossover_bin);
    cmd.env("CX_BOTTLE", bottle_name);
    cmd.env("WINEPREFIX", &config.bottle_path);
    cmd.env("LC_ALL", "zh_CN.UTF-8");
    cmd.env("WINEDEBUG", "-all");
    cmd.arg(&config.game_exe);

    // 4. 启动子进程
    let mut child = cmd.spawn().map_err(|e| format!("启动失败: {}", e))?;
    let pid = child.id();
    
    // 5. 关键修改：开启后台线程等待游戏结束，计算时长
    let app_handle = app.clone();
    let i_id = instance_id.clone();
    
    thread::spawn(move || {
        let start_time = Instant::now();

        match child.wait() {
            Ok(status) => {
                let duration = start_time.elapsed().as_secs();
                println!("游戏 {} 已退出，状态: {}, 时长: {}秒", i_id, status, duration);
                
                // 发送事件通知前端
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
    let bottles_path = PathBuf::from(path);

    if !bottles_path.exists() {
        // 如果路径不存在，返回空列表而不是报错，避免前端崩溃，或者返回明确错误
        return Err(format!("未找到容器目录: {:?}", bottles_path));
    }

    let mut bottles = Vec::new();

    // 遍历目录
    let entries = fs::read_dir(bottles_path).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // 只保留目录作为容器名
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                bottles.push(name.to_string());
            }
        }
    }

    Ok(bottles)
}
