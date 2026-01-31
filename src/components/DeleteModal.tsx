import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface DeleteModalProps {
  isOpen: boolean;
  instanceName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteModal({ isOpen, instanceName, onClose, onConfirm }: DeleteModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* 弹窗主体 */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative w-full max-w-lg bg-[#18181b] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* 顶部标题栏 */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-red-500/5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                删除游戏实例
              </h3>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* 内容区 */}
            <div className="p-6 space-y-4">
              <div className="text-white/90 text-sm leading-relaxed">
                确定要删除游戏实例 <span className="font-bold text-red-400">“{instanceName}”</span> 吗？它将会从列表中移除！
                <br />
                <span className="text-white/50 text-xs mt-2 block">
                  (注意：这只会删除配置信息，不会删除您硬盘上的游戏源文件。)
                </span>
              </div>
            </div>

            {/* 按钮区 */}
            <div className="px-6 py-4 bg-black/20 flex justify-end gap-3 border-t border-white/5">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                className="px-6 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all"
              >
                确认删除
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}