import { useState, useEffect } from "react";
import { Plus, Box, Save, Trash2, FolderOpen, Play, Settings, Search, X, Loader2, ArrowLeft, Image as ImageIcon, ChevronDown, CheckCircle, AlertCircle } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./ToastProvider";
import { DeleteModal } from "./DeleteModal";
import { useTheme } from "../contexts/ThemeContext";

export interface GameInstance {
  id: string;
  name: string;
  info: string;
  bottleName: string;
  executablePath: string;
  backgroundImage?: string;
  lastPlayed?: number;
  totalPlayTime?: number;
  playHistory?: Record<string, number>;
}

interface SearchResult {
  id: string;
  title: string;
  cover: string;
  source: string;
  url: string;
}

interface BatchItem {
  id: string;
  selected: boolean;
  dirName: string;
  executables: string[];
  selectedExec: string;
  bottleName: string;
  status: 'pending' | 'matching' | 'matched' | 'unmatched';
  matchedResult: SearchResult | null;
  searchResults: SearchResult[];
  manualInfo: Partial<GameInstance>;
}

interface InstancesPageProps {
  instances: GameInstance[];
  setInstances: (instances: GameInstance[]) => void;
  onLaunch: (instance: GameInstance) => void;
}

type ImportState = 'none' | 'choice' | 'search_params' | 'search_results' | 'manual_form';

export function InstancesPage({ instances, setInstances, onLaunch }: InstancesPageProps) {
  const { config } = useTheme();
  const { showToast } = useToast();
  
  const [bottles, setBottles] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [importState, setImportState] = useState<ImportState>('none');
  const [formData, setFormData] = useState<Partial<GameInstance>>({});
  
  const [searchExecPath, setSearchExecPath] = useState('');
  const [searchBottleName, setSearchBottleName] = useState(config.defaultBottle || 'Default');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchMatching, setIsBatchMatching] = useState(false);
  const [editingBatchItemId, setEditingBatchItemId] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; instance: GameInstance | null }>({
    isOpen: false,
    instance: null,
  });

  useEffect(() => {
    fetchBottles();
  }, [config.bottlesPath]);

  const fetchBottles = async () => {
    try {
      const res = await invoke<string[]>("get_crossover_bottles", { path: config.bottlesPath });
      setBottles(res.length > 0 ? res : ["Default"]);
    } catch (e) {
      setBottles(["Default"]);
    }
  };

  const fetchGameResults = async (keywords: string[]): Promise<SearchResult[]> => {
    let allResults: SearchResult[] = [];
    const promises = keywords.flatMap(kw => [
      invoke<SearchResult[]>('search_game', { keyword: kw, source: 'touchgal' }).catch(() => []),
      invoke<SearchResult[]>('search_game', { keyword: kw, source: 'kungal' }).catch(() => [])
    ]);
    const resultsArrays = await Promise.all(promises);
    resultsArrays.forEach(arr => allResults.push(...arr));
    
    const uniqueMap = new Map();
    allResults.forEach(item => { uniqueMap.set(item.title + item.source, item); });
    return Array.from(uniqueMap.values());
  };

  const handleSearchGame = async () => {
    if (!searchExecPath) return;
    setIsSearching(true);
    try {
      const keywords = await invoke<string[]>('get_directory_keywords', { path: searchExecPath });
      if (keywords.length === 0) {
        showToast("未提取到有效关键字", "error");
        setIsSearching(false);
        return;
      }
      const uniqueResults = await fetchGameResults(keywords);
      setSearchResults(uniqueResults);
      setImportState('search_results');
    } catch (error) {
      console.error(error);
      showToast("检索失败，请检查网络", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.executablePath) {
      showToast("名称和可执行文件路径不能为空", "error");
      return;
    }
    const newInstance = formData as GameInstance;
    let newInstances = instances.find(i => i.id === newInstance.id) 
      ? instances.map(i => i.id === newInstance.id ? newInstance : i)
      : [...instances, newInstance];
      
    setInstances(newInstances);
    showToast("保存成功", "success");
    setImportState('none');
    setSelectedId(null);
  };

  const handleDelete = () => {
    if (!deleteModal.instance) return;
    setInstances(instances.filter(i => i.id !== deleteModal.instance!.id));
    setDeleteModal({ isOpen: false, instance: null });
    setSelectedId(null);
    setImportState('none');
    showToast("实例已删除", "success");
  };

  const handleBatchImportClick = async () => {
    setIsImportMenuOpen(false);
    const selected = await open({ directory: true });
    if (selected && typeof selected === 'string') {
      try {
        const dirs = await invoke<{ dir_name: string, executables: string[] }[]>('scan_game_directories', { path: selected });
        if (dirs.length === 0) {
          showToast("未在此目录下找到任何包含可执行文件的游戏", "error");
          return;
        }
        const items: BatchItem[] = dirs.map(d => ({
          id: crypto.randomUUID(),
          selected: true,
          dirName: d.dir_name,
          executables: d.executables,
          selectedExec: d.executables[0],
          bottleName: config.defaultBottle || bottles[0] || 'Default', // 继承全局默认容器
          status: 'pending',
          matchedResult: null,
          searchResults: [],
          manualInfo: {}
        }));
        setBatchItems(items);
        setIsBatchModalOpen(true);
      } catch (e) {
        showToast("扫描目录失败", "error");
      }
    }
  };

  const updateBatchItem = (id: string, updates: Partial<BatchItem>) => {
    setBatchItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const isAllSelected = batchItems.length > 0 && batchItems.every(i => i.selected);
  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setBatchItems(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const handleStartBatchMatching = async () => {
    setIsBatchMatching(true);
    const itemsToMatch = batchItems.filter(i => i.selected && (i.status === 'pending' || i.status === 'unmatched'));
    setBatchItems(prev => prev.map(item => itemsToMatch.find(i => i.id === item.id) ? { ...item, status: 'matching' } : item));

    for (const item of itemsToMatch) {
      try {
        const keywords = await invoke<string[]>('get_directory_keywords', { path: item.selectedExec });
        if (keywords.length === 0) {
          updateBatchItem(item.id, { status: 'unmatched', searchResults: [] });
          continue;
        }
        const results = await fetchGameResults(keywords);
        if (results.length > 0) {
          updateBatchItem(item.id, { status: 'matched', matchedResult: results[0], searchResults: results });
        } else {
          updateBatchItem(item.id, { status: 'unmatched', searchResults: [] });
        }
      } catch (e) {
        updateBatchItem(item.id, { status: 'unmatched', searchResults: [] });
      }
    }
    setIsBatchMatching(false);
  };

  const handleConfirmBatchImport = () => {
    const toImport = batchItems.filter(i => i.selected);
    if (toImport.length === 0) {
      showToast("请至少选择一个要导入的游戏", "error");
      return;
    }
    const newInstances: GameInstance[] = toImport.map(item => {
      const finalName = item.manualInfo.name || item.matchedResult?.title || item.dirName;
      const finalCover = item.manualInfo.backgroundImage || item.matchedResult?.cover;
      return {
        id: crypto.randomUUID(),
        name: finalName,
        bottleName: item.bottleName,
        executablePath: item.selectedExec,
        info: item.manualInfo.info || '',
        backgroundImage: finalCover,
      };
    });
    setInstances([...instances, ...newInstances]);
    setIsBatchModalOpen(false);
    setBatchItems([]);
    showToast(`成功批量导入 ${newInstances.length} 个游戏`, "success");
  };

  // 抽出下拉箭头的组件以复用
  const DropdownArrow = () => (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );

  const isEditing = selectedId !== null || importState === 'manual_form';

  return (
    <div className="h-full flex flex-col relative">
      {/* ===== 主视图区域 ===== */}
      {isEditing ? (
        <div className="h-full overflow-y-auto p-8 relative w-full custom-scrollbar">
          <button onClick={() => { setSelectedId(null); setImportState('none'); }} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            <ArrowLeft size={20} /> 返回
          </button>
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold mb-6">{selectedId ? "编辑实例" : "配置实例信息"}</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2">封面横幅 (Banner URL)</label>
              <div className="relative aspect-[21/9] w-full bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 overflow-hidden group">
                {formData.backgroundImage ? (
                  <img src={formData.backgroundImage} className="w-full h-full object-cover" alt="Banner" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                    <ImageIcon size={48} className="mb-2 opacity-50" />
                    <span>暂无封面</span>
                  </div>
                )}
              </div>
              <input type="text" placeholder="可粘贴图片 URL..." value={formData.backgroundImage || ''} onChange={e => setFormData({ ...formData, backgroundImage: e.target.value })} className="mt-3 w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">实例名称</label>
                <input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">选择容器</label>
                <div className="relative">
                  <select 
                    value={formData.bottleName || config.defaultBottle || 'Default'} 
                    onChange={e => setFormData({ ...formData, bottleName: e.target.value })}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 pr-8 outline-none appearance-none"
                  >
                    {bottles.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <DropdownArrow />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">可执行文件路径</label>
              <div className="flex gap-2">
                <input value={formData.executablePath || ''} readOnly className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 outline-none" />
                <button onClick={async () => {
                    const selected = await open({ filters: [{ name: 'Executable', extensions: ['exe'] }] });
                    if (selected && typeof selected === 'string') setFormData({ ...formData, executablePath: selected });
                  }} className="px-4 py-2 bg-black/5 dark:bg-white/10 rounded-lg hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
                  <FolderOpen size={20} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">版本备注 (Info)</label>
              <textarea rows={3} placeholder="填写一些备注信息..." value={formData.info || ''} onChange={e => setFormData({ ...formData, info: e.target.value })} className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 outline-none resize-none" />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-black/10 dark:border-white/10">
              {selectedId && (
                <button onClick={() => setDeleteModal({ isOpen: true, instance: instances.find(i => i.id === selectedId)! })} className="px-6 py-2 text-red-500 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2">
                  <Trash2 size={18} /> 删除实例
                </button>
              )}
              <button onClick={handleSave} className="px-8 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/30">
                <Save size={18} /> 保存
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="p-6 pb-2 flex justify-between items-center shrink-0">
            <h1 className="text-2xl font-bold tracking-tight">我的实例</h1>
            <div className="relative">
              <button onClick={() => setIsImportMenuOpen(!isImportMenuOpen)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md hover:shadow-blue-500/30 active:scale-95">
                <Plus size={18} /> 导入游戏 <ChevronDown size={16} />
              </button>
              <AnimatePresence>
                {isImportMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsImportMenuOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-[#252525] border border-black/10 dark:border-white/10 rounded-lg shadow-xl z-40 overflow-hidden">
                      <button onClick={() => { setIsImportMenuOpen(false); setSearchBottleName(config.defaultBottle || 'Default'); setImportState('choice'); }} className="w-full text-left px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium">单个导入</button>
                      <button onClick={handleBatchImportClick} className="w-full text-left px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium border-t border-black/5 dark:border-white/5">批量导入</button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar">
            {instances.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <Box size={64} className="mb-4 opacity-20" />
                <p>目前还没有任何实例，点击右上角导入吧！</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {instances.map(inst => (
                  <div key={inst.id} className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-xl bg-white dark:bg-[#252525] border border-black/5 dark:border-white/5 transition-all duration-300 hover:-translate-y-1">
                    <div className="aspect-[3/4] relative bg-black/5 dark:bg-black/50 overflow-hidden">
                      {inst.backgroundImage ? (
                        <img src={inst.backgroundImage} className="w-full h-full object-cover transition-all duration-300 group-hover:blur-sm group-hover:scale-105 group-hover:brightness-50" alt={inst.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center transition-all duration-300 group-hover:blur-sm group-hover:brightness-50"><Box size={48} className="text-gray-400 opacity-30" /></div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 gap-4">
                        <button onClick={(e) => { e.stopPropagation(); onLaunch(inst); }} className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 hover:scale-110 transition-all shadow-lg"><Play size={24} className="ml-1" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setFormData(inst); setSelectedId(inst.id); }} className="p-3 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg"><Settings size={24} /></button>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-[15px] truncate text-gray-800 dark:text-gray-200" title={inst.name}>{inst.name}</h3>
                      <p className="text-xs text-gray-500 truncate mt-1">容器: {inst.bottleName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 弹窗区域 ===== */}
      <AnimatePresence>
        {importState !== 'none' && importState !== 'manual_form' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/10">
              <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-black/5 dark:bg-white/5">
                <h2 className="text-lg font-semibold">{importState === 'choice' ? '选择导入方式' : importState === 'search_params' ? '指定检索信息' : '选择匹配的游戏'}</h2>
                <button onClick={() => setImportState('none')} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar">
                {importState === 'choice' && (
                  <div className="grid grid-cols-2 gap-6">
                    <button onClick={() => setImportState('search_params')} className="group flex flex-col items-center justify-center p-8 border-2 border-transparent bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/30 rounded-2xl transition-all">
                      <div className="p-4 bg-blue-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform"><Search size={40} className="text-blue-500" /></div>
                      <span className="font-semibold text-lg text-blue-500">搜索导入</span>
                    </button>
                    <button onClick={() => { setFormData({ id: crypto.randomUUID(), bottleName: config.defaultBottle || 'Default' }); setImportState('manual_form'); }} className="group flex flex-col items-center justify-center p-8 border-2 border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 hover:border-gray-500/30 rounded-2xl transition-all">
                      <div className="p-4 bg-black/5 dark:bg-white/10 rounded-full mb-4 group-hover:scale-110 transition-transform"><Box size={40} className="text-gray-500 dark:text-gray-400" /></div>
                      <span className="font-semibold text-lg">手动导入</span>
                    </button>
                  </div>
                )}
                {importState === 'search_params' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">选择可执行文件 (.exe)</label>
                      <div className="flex gap-2">
                        <input type="text" value={searchExecPath} readOnly className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-3 outline-none" />
                        <button onClick={async () => {
                            const selected = await open({ filters: [{ name: 'Executable', extensions: ['exe'] }] });
                            if (selected && typeof selected === 'string') setSearchExecPath(selected);
                          }} className="px-5 py-3 bg-black/5 dark:bg-white/10 rounded-lg hover:bg-black/10 dark:hover:bg-white/20 transition-colors flex items-center justify-center"><FolderOpen size={20} /></button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">指定运行容器</label>
                      <div className="relative">
                        <select value={searchBottleName} onChange={e => setSearchBottleName(e.target.value)} className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-3 pr-8 outline-none appearance-none">
                          {bottles.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <DropdownArrow />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-6 mt-4 border-t border-black/5 dark:border-white/5">
                      <button onClick={() => setImportState('choice')} className="text-gray-500 px-4 py-2">上一步</button>
                      <button disabled={!searchExecPath || isSearching} onClick={handleSearchGame} className="px-8 py-3 bg-blue-500 text-white rounded-lg flex items-center gap-2">
                        {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} 开始检索
                      </button>
                    </div>
                  </div>
                )}
                {importState === 'search_results' && (
                  <div className="space-y-4">
                    {searchResults.length === 0 ? (
                      <div className="text-center py-16 text-gray-500 bg-black/5 dark:bg-white/5 rounded-xl border border-dashed"><p className="text-lg">未检索到匹配结果</p></div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                        {searchResults.map(res => (
                          <button key={res.id + res.source} onClick={() => { setFormData({ id: crypto.randomUUID(), name: res.title, backgroundImage: res.cover, executablePath: searchExecPath, bottleName: searchBottleName, info: '' }); setImportState('manual_form'); }} className="group flex flex-col bg-black/5 dark:bg-[#2a2a2a] rounded-xl overflow-hidden hover:ring-2 hover:ring-blue-500 border border-transparent dark:border-white/5 text-left">
                            <div className="aspect-[16/9] w-full relative"><img src={res.cover} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="cover" /><div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold uppercase bg-black/70 text-white rounded">{res.source}</div></div>
                            <div className="p-3"><div className="font-semibold text-sm truncate" title={res.title}>{res.title}</div></div>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-6 mt-4 border-t border-black/10 dark:border-white/10">
                      <button onClick={() => setImportState('search_params')} className="text-gray-500 px-4 py-2">重新选择</button>
                      <button onClick={() => { setFormData({ id: crypto.randomUUID(), executablePath: searchExecPath, bottleName: searchBottleName }); setImportState('manual_form'); }} className="px-6 py-2 bg-black/5 dark:bg-white/10 rounded-lg">手动填写</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBatchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh] border border-white/10">
              <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-black/5 dark:bg-white/5 shrink-0">
                <h2 className="text-lg font-semibold flex items-center gap-2"><FolderOpen size={20} className="text-blue-500" /> 批量导入游戏</h2>
                <button onClick={() => setIsBatchModalOpen(false)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
              </div>

              {/* 此处赋予明确的 flex-1 与 overflow，触发滚动条 */}
              <div className="flex-1 overflow-hidden relative flex flex-col bg-white dark:bg-[#1e1e1e]">
                {editingBatchItemId ? (() => {
                  const item = batchItems.find(i => i.id === editingBatchItemId)!;
                  return (
                    <div className="absolute inset-0 z-10 p-6 flex flex-col overflow-y-auto custom-scrollbar bg-white dark:bg-[#1e1e1e]">
                      <button onClick={() => setEditingBatchItemId(null)} className="mb-4 flex items-center gap-2 text-gray-500 self-start"><ArrowLeft size={18} /> 返回</button>
                      <h3 className="text-xl font-bold mb-4">编辑条目: {item.dirName}</h3>
                      <div className="mb-6">
                        {item.searchResults.length === 0 ? (
                          <div className="text-sm text-gray-400 bg-black/5 p-4 rounded-lg">暂无匹配项</div>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 max-h-48 overflow-y-auto custom-scrollbar">
                             {item.searchResults.map(res => (
                               <button key={res.id + res.source} onClick={() => { updateBatchItem(item.id, { matchedResult: res }); setEditingBatchItemId(null); }} className={`flex flex-col rounded-xl overflow-hidden text-left border-2 ${item.matchedResult?.id === res.id ? 'border-blue-500' : 'border-transparent bg-black/5'}`}>
                                 <div className="aspect-[16/9] w-full"><img src={res.cover} className="w-full h-full object-cover" alt="cover" /></div>
                                 <div className="p-2 text-xs truncate">{res.title}</div>
                               </button>
                             ))}
                          </div>
                        )}
                      </div>
                      <div className="border-t border-black/10 pt-6">
                         <div className="space-y-4 max-w-2xl">
                           <div><label className="block text-xs mb-1">游戏名称</label><input className="w-full bg-black/5 rounded px-3 py-2 outline-none text-sm" value={item.manualInfo.name || ''} onChange={e => updateBatchItem(item.id, { manualInfo: { ...item.manualInfo, name: e.target.value }})} placeholder={`默认为: ${item.matchedResult?.title || item.dirName}`} /></div>
                           <div><label className="block text-xs mb-1">封面 URL</label><input className="w-full bg-black/5 rounded px-3 py-2 outline-none text-sm" value={item.manualInfo.backgroundImage || ''} onChange={e => updateBatchItem(item.id, { manualInfo: { ...item.manualInfo, backgroundImage: e.target.value }})} /></div>
                           <button onClick={() => setEditingBatchItemId(null)} className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm">确认返回</button>
                         </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="sticky top-0 bg-gray-100 dark:bg-[#2a2a2a] z-10 shadow-sm">
                        <tr>
                          {/* 全选框 */}
                          <th className="p-4 w-12 text-center">
                            <input type="checkbox" className="w-4 h-4 rounded text-blue-500" checked={isAllSelected} onChange={toggleSelectAll} />
                          </th>
                          <th className="p-4 font-semibold">识别目录名</th>
                          <th className="p-4 font-semibold">执行程序 (Exe)</th>
                          <th className="p-4 w-40 font-semibold">运行容器</th>
                          <th className="p-4 w-32 font-semibold">匹配状态</th>
                          <th className="p-4 w-24 font-semibold text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {batchItems.map(item => (
                          <tr key={item.id} className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${!item.selected ? 'opacity-50' : ''}`}>
                            <td className="p-4 text-center">
                              <input type="checkbox" className="w-4 h-4 rounded text-blue-500" checked={item.selected} onChange={e => updateBatchItem(item.id, {selected: e.target.checked})} />
                            </td>
                            <td className="p-4 font-medium max-w-[150px] truncate" title={item.dirName}>
                              {item.manualInfo.name || item.matchedResult?.title || item.dirName}
                            </td>
                            <td className="p-4 max-w-[200px]">
                              {/* 美化的下拉条 */}
                              <div className="relative">
                                <select 
                                  value={item.selectedExec} 
                                  onChange={e => updateBatchItem(item.id, {selectedExec: e.target.value})} 
                                  className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded px-2 py-1.5 pr-8 outline-none truncate appearance-none"
                                >
                                  {item.executables.map((exe, i) => <option key={i} title={exe} value={exe}>{exe.split(/[/\\]/).slice(-2).join('/')}</option>)}
                                </select>
                                <DropdownArrow />
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="relative">
                                <select 
                                  value={item.bottleName} 
                                  onChange={e => updateBatchItem(item.id, {bottleName: e.target.value})} 
                                  className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded px-2 py-1.5 pr-8 outline-none appearance-none"
                                >
                                  {bottles.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <DropdownArrow />
                              </div>
                            </td>
                            <td className="p-4">
                              {item.status === 'pending' && <span className="text-gray-400 flex items-center gap-1"><AlertCircle size={14}/> 待匹配</span>}
                              {item.status === 'matching' && <span className="text-blue-500 flex items-center gap-1"><Loader2 size={14} className="animate-spin"/> 匹配中</span>}
                              {item.status === 'matched' && <span className="text-green-500 flex items-center gap-1"><CheckCircle size={14}/> 已匹配</span>}
                              {item.status === 'unmatched' && <span className="text-red-400 flex items-center gap-1"><AlertCircle size={14}/> 未匹配</span>}
                            </td>
                            <td className="p-4 text-right">
                              <button onClick={() => setEditingBatchItemId(item.id)} className="text-blue-500 px-2 py-1 rounded hover:bg-blue-500/10">编辑</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-black/10 dark:border-white/10 flex justify-between items-center bg-black/5 dark:bg-white/5 shrink-0">
                <div className="text-sm text-gray-500">共 {batchItems.length} 个游戏，已选 {batchItems.filter(i => i.selected).length} 个</div>
                <div className="flex gap-4">
                  <button disabled={isBatchMatching || batchItems.filter(i => i.selected).length === 0} onClick={handleStartBatchMatching} className="px-6 py-2 bg-indigo-500 text-white rounded-lg flex items-center gap-2">
                    {isBatchMatching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} 匹配
                  </button>
                  <button disabled={isBatchMatching} onClick={handleConfirmBatchImport} className="px-6 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2"><Save size={16} /> 导入</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteModal isOpen={deleteModal.isOpen} instanceName={deleteModal.instance?.name || ''} onClose={() => setDeleteModal({ isOpen: false, instance: null })} onConfirm={handleDelete} />
    </div>
  );
}
