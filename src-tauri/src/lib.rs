use tauri::{command, Manager};
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
use font_kit::source::SystemSource;
use serde::{Deserialize, Serialize};
use serde_json::json;

mod wine_runner;
mod storage;

// --- 统一的搜索结果结构 ---
#[derive(Debug, Serialize, Deserialize)]
struct SearchResult {
    id: String,
    title: String,
    cover: String,
    source: String,
    url: String,
    date: Option<String>,
}

// --- TouchGal 辅助结构 ---
#[derive(Serialize)]
struct TouchGalSearchOption {
    searchInIntroduction: bool,
    searchInAlias: bool,
    searchInTag: bool,
}

#[derive(Serialize)]
struct TouchGalRequestBody {
    queryString: String,
    limit: i32,
    searchOption: TouchGalSearchOption,
    page: i32,
    selectedType: String,
    selectedLanguage: String,
    selectedPlatform: String,
    sortField: String,
    sortOrder: String,
    selectedYears: Vec<String>,
    selectedMonths: Vec<String>,
}

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

#[command]
async fn fetch_ymgal_news(page: u32) -> Result<serde_json::Value, String> {
    println!("Backend fetching Ymgal news page: {}", page); // 后端日志，方便调试
    
    let client = reqwest::Client::new();
    let url = format!("https://www.ymgal.games/co/topic/list?type=NEWS&page={}", page);

    let res = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Request Error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Server returned status: {}", res.status()));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| format!("Parse Error: {}", e))?;
    Ok(data)
}

#[command]
async fn search_game(keyword: String, source: String) -> Result<Vec<SearchResult>, String> {
    println!("\n=== 开始搜索 [{}] 关键词: {} ===", source, keyword);
    let client = reqwest::Client::new();
    let mut results = Vec::new();

    match source.as_str() {
        "touchgal" => {
            let url = "https://www.touchgal.top/api/search";
            // 构造 queryString 内部 JSON
            let query_string_json = json!([
                { "type": "keyword", "name": keyword }
            ]).to_string();

            let body = TouchGalRequestBody {
                queryString: query_string_json,
                limit: 12,
                searchOption: TouchGalSearchOption {
                    searchInIntroduction: false,
                    searchInAlias: true,
                    searchInTag: false,
                },
                page: 1,
                selectedType: "all".to_string(),
                selectedLanguage: "all".to_string(),
                selectedPlatform: "all".to_string(),
                sortField: "resource_update_time".to_string(),
                sortOrder: "desc".to_string(),
                selectedYears: vec!["all".to_string()],
                selectedMonths: vec!["all".to_string()],
            };

            // 发送请求
            let res = client.post(url)
                // 必须完全模拟浏览器的 Headers
                .header("Host", "www.touchgal.top")
                .header("Accept", "*/*")
                .header("Accept-Language", "zh-CN,zh;q=0.9")
                .header("Content-Type", "application/json") // 这里还是建议用 application/json
                .header("Origin", "https://www.touchgal.top")
                .header("Referer", "https://www.touchgal.top/search")
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request Failed: {}", e))?;

            // 1. 获取原始文本 (关键调试步骤)
            let raw_text = res.text().await.map_err(|e| format!("Read Text Failed: {}", e))?;
            println!("[TouchGal] 原始响应: {}", raw_text); // <--- 请在终端查看这行输出

            // 2. 解析 JSON
            let json_val: serde_json::Value = serde_json::from_str(&raw_text)
                .map_err(|e| format!("JSON Parse Failed: {}", e))?;

            if let Some(games) = json_val["galgames"].as_array() {
                for g in games {
                    // 健壮性解析：如果是数字转字符串，如果是字符串直接用，如果是null给默认值
                    let unique_id = g["unique_id"].as_str().unwrap_or("").to_string();
                    let name = g["name"].as_str().unwrap_or("未知标题").to_string();
                    let banner = g["banner"].as_str().unwrap_or("").to_string();
                    
                    results.push(SearchResult {
                        id: unique_id.clone(),
                        title: name,
                        cover: banner,
                        source: "TouchGal".to_string(),
                        url: format!("https://www.touchgal.top/{}", unique_id),
                        date: None
                    });
                }
            } else {
                println!("[TouchGal] 警告: 未找到 'galgames' 数组，可能是搜索无结果或结构变更");
            }
        },
        "kungal" => {
            // KunGal 需要 URL 编码
            let encoded_keyword = urlencoding::encode(&keyword);
            let url = format!("https://www.kungal.com/api/search?keywords={}&type=galgame&page=1&limit=12", encoded_keyword);
            
            println!("[KunGal] Request URL: {}", url);

            let res = client.get(&url)
                .header("Host", "www.kungal.com")
                .header("Referer", "https://www.kungal.com/search")
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .send()
                .await
                .map_err(|e| format!("Request Failed: {}", e))?;

            // 1. 获取原始文本
            let raw_text = res.text().await.map_err(|e| format!("Read Text Failed: {}", e))?;
            println!("[KunGal] 原始响应: {}", raw_text); // 调试用输出

            // 2. 解析 JSON
            let json_val: serde_json::Value = serde_json::from_str(&raw_text)
                .map_err(|e| format!("JSON Parse Failed: {}", e))?;

            if let Some(games) = json_val.as_array() {
                for g in games {
                    // id 有时是数字有时是字符串，统一处理
                    let id = if let Some(n) = g["id"].as_i64() {
                        n.to_string()
                    } else {
                        g["id"].as_str().unwrap_or("").to_string()
                    };

                    // 名字多语言回退逻辑
                    let name = if let Some(name_obj) = g["name"].as_object() {
                        let cn = name_obj.get("zh-cn").and_then(|v| v.as_str()).unwrap_or("");
                        let tw = name_obj.get("zh-tw").and_then(|v| v.as_str()).unwrap_or("");
                        let jp = name_obj.get("ja-jp").and_then(|v| v.as_str()).unwrap_or("");
                        let en = name_obj.get("en-us").and_then(|v| v.as_str()).unwrap_or("");
                        
                        if !cn.is_empty() { cn.to_string() }
                        else if !tw.is_empty() { tw.to_string() }
                        else if !jp.is_empty() { jp.to_string() }
                        else { en.to_string() }
                    } else {
                        g["name"].as_str().unwrap_or("未知标题").to_string()
                    };

                    let banner = g["banner"].as_str().unwrap_or("").to_string();
                    let update_time = g["resourceUpdateTime"].as_str()
                        .map(|s| s.split('T').next().unwrap_or("").to_string());

                    results.push(SearchResult {
                        id: id.clone(),
                        title: name,
                        cover: banner,
                        source: "KunGal".to_string(),
                        url: format!("https://www.kungal.com/galgame/{}", id),
                        date: update_time,
                    });
                }
            } else {
                println!("[KunGal] 警告: 根节点不是数组，可能出错");
            }
        },
        _ => return Err("未知的搜索源".to_string()),
    }

    println!("=== 搜索结束，找到 {} 条结果 ===\n", results.len());
    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            wine_runner::launch_game,
            wine_runner::get_crossover_bottles,
            storage::save_instances,
            storage::load_instances,
            get_home_dir,
            get_system_fonts,
            fetch_ymgal_news,
            search_game
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
