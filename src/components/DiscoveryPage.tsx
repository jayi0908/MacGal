// src/components/DiscoveryPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Calendar, User, Eye, AlertCircle } from 'lucide-react';
// import { fetch } from '@tauri-apps/plugin-http'; // 删掉这个
import { invoke } from '@tauri-apps/api/core';    // 改用 invoke
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';
import { open as openUrl } from "@tauri-apps/plugin-shell";

// --- 类型定义 (保持不变) ---
interface Topic {
  topicId: string;
  author: number;
  mainImg: string;
  title: string;
  introduction: string;
  views: number;
  replyNum: number;
  likesNum: number;
  favoritesNum: number;
  publishTime: string;
  createAt: string;
  topicCategory: string;
  publishTimeText: string;
}

interface YmgalResponse {
  success: boolean;
  code: number;
  data: Topic[];
}

export function DiscoveryPage() {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const [articles, setArticles] = useState<Topic[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const [loadingState, setLoadingState] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);

  // --- 调用 Rust 后端指令 ---
  const fetchArticles = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setLoadingState(true);
    setError(null);

    try {
      console.log(`[Discovery] Calling Rust backend for page ${pageNum}...`);
      
      // 使用 invoke 调用 Rust 函数 'fetch_ymgal_news'
      const data = await invoke<YmgalResponse>('fetch_ymgal_news', { page: pageNum });
      
      console.log("[Discovery] Rust response:", data);

      if (data.success && data.data && data.data.length > 0) {
        setArticles(prev => {
          if (pageNum === 1) return data.data;
          const existingIds = new Set(prev.map(a => a.topicId));
          const newArticles = data.data.filter(a => !existingIds.has(a.topicId));
          return [...prev, ...newArticles];
        });

        pageRef.current = pageNum;

        if (data.data.length < 10) {
            setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("[Discovery] Rust Error:", err);
      // invoke 返回的错误通常是字符串
      setError(String(err));
    } finally {
      loadingRef.current = false;
      setLoadingState(false);
    }
  }, []);

  // --- 初始加载 ---
  useEffect(() => {
    if (pageRef.current === 1 && articles.length === 0) {
        fetchArticles(1);
    }
  }, []);

  // --- 无限滚动 ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loadingRef.current) {
          const nextPage = pageRef.current + 1;
          fetchArticles(nextPage);
        }
      },
      { threshold: 0.1, rootMargin: '100px' } 
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, fetchArticles]);

  const handleCardClick = async (topicId: string) => {
    const url = `https://www.ymgal.games/co/article/${topicId}`;
    try {
        await openUrl(url);
    } catch (e) {
        console.error("Failed to open url:", e);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar pt-20 px-8 pb-8 animate-in fade-in zoom-in duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className={clsx("text-3xl font-bold tracking-tight", isDark ? "text-white" : "text-gray-900")}>发现</h1>
            </div>
        </div>

        {/* 错误提示 */}
        {error && (
            <div className="p-4 rounded-lg bg-red-500/10 text-red-500 flex items-center gap-2 mb-4">
                <AlertCircle size={20} />
                <span>{error}</span>
                <button onClick={() => fetchArticles(pageRef.current)} className="ml-auto underline hover:text-red-600 font-medium">重试</button>
            </div>
        )}

        {/* 文章网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <article 
                key={article.topicId} 
                className={clsx(
                    "group flex flex-col rounded-xl overflow-hidden border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer h-full", 
                    isDark ? "border-white/10 bg-[#1a1a1c]" : "border-gray-200 bg-white"
                )}
                onClick={() => handleCardClick(article.topicId)}
            >
              <div className="aspect-video w-full overflow-hidden bg-gray-200 dark:bg-gray-800 relative">
                 <img 
                    src={article.mainImg} 
                    alt={article.title}
                    loading="lazy" 
                    referrerPolicy="no-referrer" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                 />
                 <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-bold rounded">
                    {article.topicCategory}
                 </div>
              </div>
              
              <div className="p-5 flex flex-col flex-1">
                <h3 className={clsx("font-bold text-lg leading-snug mb-3 line-clamp-2 group-hover:text-indigo-500 transition-colors", isDark ? "text-white" : "text-gray-900")}>
                  {article.title}
                </h3>
                <p className={clsx("text-sm line-clamp-3 mb-4 flex-1", isDark ? "text-white/60" : "text-gray-500")}>
                  {article.introduction}
                </p>
                <div className={clsx("flex items-center justify-between text-xs mt-auto pt-4 border-t", isDark ? "border-white/5 text-white/40" : "border-gray-100 text-gray-400")}>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <User size={12} />
                            <span className="max-w-[80px] truncate">{article.createAt}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{article.publishTimeText}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Eye size={12} />
                        <span>{article.views}</span>
                    </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* 底部加载 */}
        <div ref={observerTarget} className="py-8 flex justify-center items-center w-full min-h-[60px]">
            {loadingState && (
                <div className={clsx("flex items-center gap-2 animate-pulse", isDark ? "text-white/50" : "text-gray-500")}>
                    <Loader2 className="animate-spin" size={20} />
                    <span>正在加载更多...</span>
                </div>
            )}
            {!hasMore && articles.length > 0 && (
                <div className={clsx("text-sm", isDark ? "text-white/20" : "text-gray-300")}>
                    - 已经到底啦 -
                </div>
            )}
        </div>

      </div>
    </div>
  );
}