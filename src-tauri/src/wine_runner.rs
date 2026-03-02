use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{command, AppHandle, Emitter};
use std::time::Instant;
use std::thread;

#[derive(serde::Deserialize)]
pub struct WineConfig {
    pub bottle_path: String,
    pub game_exe: String,
    pub crossover_app_path: String,
    pub run_mode: Option<String>,
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

fn extract_vm_name(path: &str) -> Option<String> {
    let path_obj = Path::new(path);
    if let Some(file_name) = path_obj.file_name().and_then(|n| n.to_str()) {
        if let Some(idx) = file_name.find(" Applications.localized") {
            return Some(file_name[..idx].to_string());
        }
        if let Some(idx) = file_name.find(" Applications") {
            return Some(file_name[..idx].to_string());
        }
    }
    None
}

#[command]
pub async fn launch_game(app: AppHandle, instance_id: String, config: WineConfig) -> Result<u32, String> {
    println!("正在启动实例 ID: {}, 路径: {}", instance_id, config.game_exe);
    let mode = config.run_mode.as_deref().unwrap_or("crossover");

    if mode == "parallels" {
        let vm_app_path = expand_tilde(&config.bottle_path).join("文件资源管理器.app");
        if !vm_app_path.exists() {
            return Err(format!("找不到 Parallels 虚拟机路径: {:?}", vm_app_path));
        }

        let exe_path = expand_tilde(&config.game_exe);
        if !exe_path.exists() {
            return Err(format!("找不到可执行文件，可能位于外接硬盘但未连接，请检查磁盘连接情况: {:?}", config.game_exe));
        }

        // 获取要轮询的虚拟机名字和进程名
        let exe_name = exe_path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        let vm_name = extract_vm_name(&config.bottle_path).unwrap_or_else(|| "".to_string());

        // 使用 open 启动，这里不再需要 -W，因为它无论如何都会闪退，我们改用手动轮询
        let mut child = Command::new("open")
            .arg("-a")
            .arg(&vm_app_path)
            .arg(&exe_path)
            .spawn()
            .map_err(|e| format!("无法启动 Parallels Desktop 实例: {}", e))?;

        let pid = child.id();
        let app_handle = app.clone();
        let i_id = instance_id.clone();

        thread::spawn(move || {
            let start_time = Instant::now();
            
            // 给 Parallels Desktop 启动虚拟机、挂载网络磁盘、以及 Windows 拉起游戏预留 15 秒的缓冲时间
            thread::sleep(std::time::Duration::from_secs(15));
            
            if !vm_name.is_empty() && !exe_name.is_empty() {
                let mut miss_count = 0;
                let exe_name_lower = exe_name.to_lowercase();
                
                // Windows 的 tasklist 命令最多只显示进程名的前 25 个字符，如果太长会被截断
                let search_name = if exe_name_lower.len() > 25 {
                    &exe_name_lower[..25]
                } else {
                    &exe_name_lower
                };

                loop {
                    // 尝试通过 prlctl (Parallels 命令行工具) 直接查看虚拟机内部的进程表
                    let output = Command::new("/usr/local/bin/prlctl")
                        .arg("exec")
                        .arg(&vm_name)
                        .arg("tasklist")
                        .output()
                        .or_else(|_| {
                            // 降级：如果 /usr/local/bin 里没有，尝试通过全局 PATH 查找
                            Command::new("prlctl").arg("exec").arg(&vm_name).arg("tasklist").output()
                        });

                    match output {
                        Ok(out) => {
                            let stdout = String::from_utf8_lossy(&out.stdout).to_lowercase();
                            if stdout.contains(search_name) {
                                miss_count = 0; // 找到了游戏进程，重置丢失计数
                            } else {
                                miss_count += 1; // 没找到该游戏
                            }
                        },
                        Err(_) => {
                            // 执行出错 (可能是虚拟机正处于未唤醒状态/挂起状态)
                            miss_count += 1;
                        }
                    }

                    // 如果连续 3 次（15 秒）在 Windows 后台都没看到这个 exe，证明游戏被玩家关闭了
                    if miss_count >= 3 {
                        break;
                    }
                    
                    thread::sleep(std::time::Duration::from_secs(5));
                }
            } else {
                // 如果出异常解析不出名字，退化为旧式的 wait（立刻结束）
                let _ = child.wait();
            }

            let duration = start_time.elapsed().as_secs();
            println!("游戏 {} 已退出，总时长: {}秒", i_id, duration);
            let _ = app_handle.emit("game-finished", GameFinishedPayload {
                instance_id: i_id,
                duration_sec: duration
            });
        });

        return Ok(pid);
    }

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

    Ok(pid)
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
