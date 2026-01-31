import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { clsx } from "clsx";

// 定义通知类型
export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// 供组件使用的 Hook
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    // 3秒后自动消失
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast 容器：固定在右上角 */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// 单个 Toast 组件
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: <CheckCircle2 size={18} className="text-green-400" />,
    error: <AlertCircle size={18} className="text-red-400" />,
    info: <Info size={18} className="text-blue-400" />,
  };

  const bgStyles = {
    success: "bg-green-500/10 border-green-500/20",
    error: "bg-red-500/10 border-red-500/20",
    info: "bg-blue-500/10 border-blue-500/20",
  };

  return (
    <motion.div
      layout
      initial={{ x: 100, opacity: 0, scale: 0.9 }} // 初始位置：右侧偏移
      animate={{ x: 0, opacity: 1, scale: 1 }}     // 进场：滑入
      exit={{ x: 100, opacity: 0, scale: 0.9 }}    // 离场：向右滑出
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={clsx(
        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl min-w-[280px] max-w-sm",
        "bg-[#18181b]/90 border-white/10", // 基础深色背景
        // 如果你想让整个背景带点颜色，可以用 bgStyles[toast.type]，
        // 但为了保持 "Fine Popup" 的高级感，建议只改变图标颜色，保持背景深黑
      )}
    >
      {/* 左侧图标 */}
      <div className={clsx("p-1.5 rounded-full bg-white/5 border border-white/5", bgStyles[toast.type])}>
          {icons[toast.type]}
      </div>

      {/* 消息文本 */}
      <div className="flex-1 text-sm font-medium text-white/90">
        {toast.message}
      </div>

      {/* 关闭按钮 */}
      <button onClick={onClose} className="p-1 text-white/40 hover:text-white transition-colors">
        <X size={14} />
      </button>
    </motion.div>
  );
}