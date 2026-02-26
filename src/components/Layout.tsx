// src/components/Layout.tsx
import { ReactNode, useEffect, useState } from "react";
import { Search, Settings, RefreshCw, Play, Box, Compass } from "lucide-react";
import { convertFileSrc } from '@tauri-apps/api/core';
import { useTheme } from '../contexts/ThemeContext';
import { GameInstance } from "./InstancesPage";
import { SearchModal } from "./SearchModal";
import clsx from "clsx";

interface LayoutProps {
  children?: ReactNode;
  bgImage?: string;
  activeTab: "home" | "instances" | "discovery" | "settings";
  setActiveTab: (tab: "home" | "instances" | "discovery" | "settings") => void;
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
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // 计算背景图
    const getBgImage = () => {
      if (config.useInstanceBg && currentInstance?.backgroundImage) {
          const bg = currentInstance.backgroundImage;
          return bg.startsWith('http') ? bg : convertFileSrc(bg);
      }
      if (config.customBgImage) {
          return config.customBgImage.startsWith('http') ? config.customBgImage : convertFileSrc(config.customBgImage);
      }
      return bgImage || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2568";
    };

    const isDark = currentTheme === 'dark';

    // 导航栏样式
    const navBarClass = clsx(
        "flex items-center gap-1 backdrop-blur-md border rounded-full p-1 pl-4 pr-1 shadow-2xl whitespace-nowrap transition-colors",
        isDark 
            ? "bg-black/40 border-white/10 text-white" 
            : "bg-white/80 border-white/40 shadow-gray-200/50 text-gray-900"
    );

    // 快捷键监听
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          setIsSearchOpen(true);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

  return (
    <div className={clsx(
             "relative h-screen w-screen overflow-hidden font-sans transition-colors duration-300",
             isDark ? "text-white" : "text-gray-900"
        )}>
      
      {/* 背景层 */}
      <div className="absolute inset-0 z-0">
        <img 
          src={getBgImage()} 
          className={`w-full h-full object-cover transition-all duration-500 ${activeTab !== 'home' ? 'opacity-30 blur-sm' : 'opacity-60'}`} 
          alt="bg" 
        />
        <div className={clsx(
            "absolute inset-0 bg-gradient-to-t",
            isDark ? "from-black/90 via-black/40 to-black/20" : "" 
        )} />
        <div className={clsx(
            "absolute inset-0 backdrop-blur-[2px]",
            isDark ? "bg-black/30" : "bg-white/20"
        )} />
      </div>

      {/* 搜索模态框 */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* 顶部导航 */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 w-max">
        <div className={navBarClass}>
          <span className={clsx("font-bold text-lg mr-4 tracking-wider cursor-pointer", isDark?"text-blue-400":"text-indigo-600")} onClick={()=>setActiveTab('home')}>MacGal</span>
          
          <NavBtn icon={<Play size={16} />} label="启动" active={activeTab === 'home'} onClick={() => setActiveTab('home')} isDark={isDark} />
          <NavBtn icon={<Box size={16} />} label="实例" active={activeTab === 'instances'} onClick={() => setActiveTab('instances')} isDark={isDark} />
          <NavBtn icon={<RefreshCw size={16} />} label="刷新" onClick={onRefresh} isDark={isDark} />
          
          {/* 分割线 */}
          <div className={clsx("w-px h-4 mx-1", isDark?"bg-white/20":"bg-black/10")} />
          
          {/* 搜索按钮：只在配置开启时显示 */}
          {config.enableDiscovery ? (
            // 模式 A: 发现按钮 -> 切换到发现页
            <NavBtn 
                icon={<Compass size={16} />} 
                label="发现" 
                active={activeTab === 'discovery'}
                onClick={() => setActiveTab('discovery')} 
                isDark={isDark} 
            />
          ) : (
            // 模式 B: 搜索按钮 -> 打开搜索弹窗
            <NavBtn 
                icon={<Search size={16} />} 
                label="搜索" 
                onClick={() => setIsSearchOpen(true)} // 点击打开弹窗
                isDark={isDark} 
            />
          )}
          
          <NavBtn icon={<Settings size={16} />} label="设置" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} isDark={isDark} />
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