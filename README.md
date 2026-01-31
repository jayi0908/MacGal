# MacGal

> “你的家族有精神病史吗？
>
> 我有个叔叔买 mac 打游戏。”

MacGal 是一款专为 macOS 设计的 galgame/视觉小说管理器，主要管理通过 CrossOver 运行的游戏实例，旨在补全 galgame 管理器在 macOS 平台的空白。

目前更新至 0.1.0 版本，实现了添加实例与启动游戏的基本功能，暂不支持搜索功能，未来会持续完善。

## 下载与安装

### 从 Releases 下载

前往 [Releases](https://github.com/jayi0908/MacGal/releases) 页面下载最新版本的安装包。

### 从源码编译

```bash
# 安装 xcode 命令行工具（如果尚未安装）
xcode-select --install

# 安装 Homebrew（如果尚未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Rust 依赖
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh # 安装过程中 Enter 选择默认选项，安装后重启终端或运行 source $HOME/.cargo/env

# 安装 node 和 pnpm
# node 可以使用 Homebrew 安装，也可以使用 nvm 安装
brew install node pnpm

# 克隆仓库
git clone https://github.com/jayi0908/MacGal.git
cd MacGal
# 安装前端依赖
pnpm install

# 开发模式运行
pnpm tauri dev

# 构建生产版本
pnpm tauri build
```

## 灵感来源 & 致谢

- [ReinaManager](https://github.com/huoshen80/ReinaManager) 与 [LunaBox](https://github.com/Saramanda9988/LunaBox) - Windows 平台的轻量化的 galgame 和视觉小说管理工具（看到这个才想搞的 macOS 版本）
- [Heroic](https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher) - 跨平台的游戏启动器，使用 Tauri2 开发，并且支持 mac 端启动 CrossOver 容器内游戏
- [SJMCL](https://github.com/UNIkeEN/SJMCL) - 跨平台的 Minecraft 启动器，同样使用 Tauri2 开发，借鉴了其布局（<s>真好看吧</s>）
- <s>[Gemini](https://gemini.google.com/) - 伟大的前后端开发者</s>

## License

本项目采用 [MIT](./LICENSE) 许可证。