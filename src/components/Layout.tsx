import { ReactNode } from "react";
import { Search, Settings, RefreshCw, Play, Box } from "lucide-react";
import { convertFileSrc } from '@tauri-apps/api/core';
import { useTheme } from '../contexts/ThemeContext';
import { GameInstance } from "./InstancesPage";
import clsx from "clsx";

// 接收 activeTab 属性
interface LayoutProps {
  children?: ReactNode;
  bgImage?: string;
  activeTab: "home" | "instances" | "settings";
  setActiveTab: (tab: "home" | "instances" | "settings") => void;
  // 右下角动作栏插槽 (用于放置 LaunchControl)
  bottomAction?: ReactNode; 
  onRefresh?: () => void;
  currentInstance?: GameInstance;
}

export function Layout({ 
    children, 
    bgImage, 
    activeTab, 
    setActiveTab, 
    bottomAction, 
    onRefresh, 
    currentInstance 
}: LayoutProps) {
    const { config, currentTheme } = useTheme();

    // 计算最终背景图 URL
    const getBgImage = () => {
      // 优先级 1: 实例背景 (使用解构后的 currentInstance)
      if (config.useInstanceBg && currentInstance?.backgroundImage) {
          const bg = currentInstance.backgroundImage;
          return bg.startsWith('http') ? bg : convertFileSrc(bg);
      }
      // 优先级 2: 全局自定义背景
      if (config.customBgImage) {
          return config.customBgImage.startsWith('http') ? config.customBgImage : convertFileSrc(config.customBgImage);
      }
      // 优先级 3: 默认兜底图 (传入的 bgImage 或硬编码)
      return bgImage || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2568";
    };

    // 导航栏样式：浅色模式下使用白色半透明背景+深色文字
    const navBarClass = clsx(
        "flex items-center gap-1 backdrop-blur-md border rounded-full p-1 pl-4 pr-1 shadow-2xl whitespace-nowrap transition-colors",
        currentTheme === 'dark' 
            ? "bg-black/40 border-white/10 text-white" 
            : "bg-white/80 border-white/40 shadow-gray-200/50 text-gray-900"
    );

  return (
    <div className={clsx(
             "relative h-screen w-screen overflow-hidden font-sans transition-colors duration-300",
             currentTheme === 'dark' ? "text-white" : "text-gray-900" // 浅色模式下文字变黑
        )}>
      
      {/* 背景层 */}
      <div className="absolute inset-0 z-0">
        <img 
          src={getBgImage()} 
          className={`w-full h-full object-cover transition-all duration-500 ${activeTab !== 'home' ? 'opacity-30 blur-sm' : 'opacity-60'}`} 
          alt="bg" 
        />
        {/* 遮罩层：根据主题改变 */}
            <div className={clsx(
                "absolute inset-0 bg-gradient-to-t",
                currentTheme === 'dark' 
                   ? "from-black/90 via-black/40 to-black/20" 
                   : "" 
            )} />
            
            {/* 额外加一层纯色遮罩，增强文字可读性 */}
            <div className={clsx(
                "absolute inset-0 backdrop-blur-[2px]", //稍微加一点点模糊让背景不干扰文字
                currentTheme === 'dark' ? "bg-black/30" : "bg-white/20"
            )} />
      </div>

      {/* 顶部导航 */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 w-max">
            <div className={navBarClass}>
              <span className={clsx("font-bold text-lg mr-4 tracking-wider cursor-pointer", currentTheme==='dark'?"text-blue-400":"text-indigo-600")} onClick={()=>setActiveTab('home')}>MacGal</span>
              
              <NavBtn icon={<Play size={16} />} label="启动" active={activeTab === 'home'} onClick={() => setActiveTab('home')} isDark={currentTheme==='dark'} />
              <NavBtn icon={<Box size={16} />} label="实例" active={activeTab === 'instances'} onClick={() => setActiveTab('instances')} isDark={currentTheme==='dark'} />
              <NavBtn icon={<RefreshCw size={16} />} label="刷新" onClick={onRefresh} isDark={currentTheme==='dark'} />
              
              <div className={clsx("w-px h-4 mx-1", currentTheme==='dark'?"bg-white/20":"bg-black/10")} />
              
              <NavBtn icon={<Search size={16} />} label="搜索" isDark={currentTheme==='dark'} />
              <NavBtn icon={<Settings size={16} />} label="设置" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} isDark={currentTheme==='dark'} />
            </div>
          </div>

      {/* 主内容区域 */}
      <main className="relative z-10 w-full h-full">
        {children}
      </main>

      {activeTab === 'home' && bottomAction && (
        <div className="absolute inset-x-0 bottom-0 z-20 animate-in slide-in-from-bottom-10 fade-in duration-500">
          {bottomAction}
        </div>
      )}
    </div>
  );
}

function NavBtn({ icon, label, active, onClick, isDark }: { icon: any; label: string; active?: boolean, onClick?: () => void, isDark: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
        active 
          ? (isDark ? "bg-white text-black shadow-lg" : "bg-indigo-600 text-white shadow-lg")
          : (isDark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-gray-600 hover:bg-black/5 hover:text-black")
      )}
    >
      {icon}
      {label}
    </button>
  );
}