import { useState } from "react";
import { Plus, Box, Save, Trash2, FolderOpen, Play, LayoutGrid, Settings, Image as ImageIcon } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { clsx } from "clsx";
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

interface InstancesPageProps {
  instances: GameInstance[];
  setInstances: (instances: GameInstance[]) => void; // 这里不仅仅是 set state，还需要触发保存
  onLaunch: (instance: GameInstance) => void;
}

export function InstancesPage({ instances, setInstances, onLaunch }: InstancesPageProps) {
  // selectedId 为 null 时显示“全部实例”概览页
  const { currentTheme, config } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [bottles, setBottles] = useState<string[]>([]);
  const [formData, setFormData] = useState<Partial<GameInstance>>({});
  
  // 删除弹窗状态
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; instance: GameInstance | null }>({
    isOpen: false,
    instance: null,
  });

  const { showToast } = useToast();
  const selectedInstance = instances.find(i => i.id === selectedId);

  // 加载容器列表
  const fetchBottles = async () => {
    try {
      const res = await invoke<string[]>("get_crossover_bottles", { path: config.bottlesPath });
      setBottles(res);
    } catch (e) {
      setBottles(["Default"]);
    }
  };

  const getHomePath = async () => {
    try { return await invoke<string>("get_home_dir"); } catch (e) { return undefined; }
  };

  const handleSelectFile = async () => {
    try {
      const home = await getHomePath();
      const selected = await open({
        multiple: false,
        directory: false,
        defaultPath: home,
        filters: [{ name: "Executable", extensions: ["exe", "bat", "lnk"] }]
      });
      if (selected) setFormData({ ...formData, executablePath: selected as string });
    } catch (err) { console.error(err); }
  };

  const handleSelectBgImage = async () => {
    try {
      const home = await getHomePath(); // 调用 Rust
      const selected = await open({
        multiple: false,
        directory: false,
        defaultPath: home,
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
      });
      if (selected) setFormData({ ...formData, backgroundImage: selected as string });
    } catch (err) { console.error(err); }
  };

  const handleStartCreate = () => {
    setSelectedId("NEW"); // 使用特殊 ID 标记新建状态
    setIsCreating(true);
    setFormData({ name: "", info: "", bottleName: "", executablePath: "" });
    fetchBottles();
  };

  const handleStartEdit = (instance: GameInstance) => {
    setSelectedId(instance.id);
    setIsCreating(false);
    setFormData({ ...instance });
    fetchBottles();
  };

  const handleSave = () => {
    if (!formData.name || !formData.executablePath) {
      showToast("请填写完整的游戏名称和路径", "error");
      return;
    }

    let newList = [...instances];
    if (isCreating) {
      const newInstance: GameInstance = {
        id: Date.now().toString(),
        name: formData.name!,
        info: formData.info || "自定义实例",
        bottleName: formData.bottleName || "Default",
        executablePath: formData.executablePath!,
        lastPlayed: 0,
        totalPlayTime: 0,
        playHistory: {},
      };
      newList.push(newInstance);
      setSelectedId(newInstance.id); // 保存后停留在当前页面
      setIsCreating(false);
    } else if (selectedId) {
      newList = instances.map(i => i.id === selectedId ? { ...i, ...formData } as GameInstance : i);
    }
    
    // 调用父组件传递的 update 方法（它负责 set state 和 持久化）
    setInstances(newList);
    showToast("保存成功", "success");
  };

  // 点击删除按钮 -> 打开弹窗
  const onClickDelete = () => {
    if (selectedInstance) {
      setDeleteModal({ isOpen: true, instance: selectedInstance });
    }
  };

  // 确认删除 -> 执行逻辑
  const confirmDelete = () => {
    if (!deleteModal.instance) return;

    const newList = instances.filter(i => i.id !== deleteModal.instance!.id);
    setInstances(newList); // 更新数据
    
    setDeleteModal({ isOpen: false, instance: null }); // 关闭弹窗
    setSelectedId(null); // 跳转回“全部实例”概览页
    
    showToast("实例已删除", "success");
  };

  const containerClass = clsx(
    "flex-1 backdrop-blur-xl border rounded-3xl p-8 shadow-2xl overflow-y-auto custom-scrollbar relative transition-colors",
    currentTheme === 'dark' 
      ? "bg-black/40 border-white/10" 
      : "bg-white/60 border-white/40 shadow-sm"
  );

  const sidebarButtonClass = (isActive: boolean) => clsx(
    "w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3",
    isActive
      ? (currentTheme === 'dark' ? "bg-white/10 border-white/20 shadow-lg text-white" : "bg-white border-black/5 shadow-md text-black")
      : (currentTheme === 'dark' ? "bg-black/20 border-transparent hover:bg-white/5 text-white/70" : "bg-white/40 border-transparent hover:bg-white/60 text-gray-600")
  );

  const inputClass = clsx(
    "w-full rounded-xl p-3 text-sm outline-none border transition-colors",
    currentTheme === 'dark' 
      ? "bg-black/30 border-white/10 text-white focus:border-indigo-500" 
      : "bg-white border-gray-200 text-gray-900 focus:border-indigo-500 shadow-sm"
  );

  const labelClass = clsx("text-sm font-medium", currentTheme === 'dark' ? "text-white/70" : "text-gray-600");

  return (
    <div className="flex h-full w-full gap-6 p-8 pt-24 animate-in fade-in zoom-in duration-300">
      
      {/* 侧边栏 */}
      <div className="w-48 flex flex-col gap-4 flex-shrink-0">
        <button 
          onClick={() => setSelectedId(null)}
          className={clsx(
            "flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all",
            selectedId === null 
              ? (currentTheme === 'dark' ? "bg-white text-black shadow-lg" : "bg-indigo-600 text-white shadow-lg")
              : (currentTheme === 'dark' ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-gray-600 hover:bg-black/5 hover:text-black")
          )}
        >
          <LayoutGrid size={18} /> 全部实例
        </button>

        <div className={clsx("h-px mx-2", currentTheme === 'dark' ? "bg-white/10" : "bg-black/10")} />
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {instances.map(inst => (
            <button
              key={inst.id}
              onClick={() => handleStartEdit(inst)}
              className={sidebarButtonClass(selectedId === inst.id)}
            >
              <Box size={18} className={selectedId === inst.id ? (currentTheme === 'dark'?"text-white":"text-indigo-600") : "opacity-50"} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{inst.name}</div>
              </div>
            </button>
          ))}
        </div>

        <button 
          onClick={handleStartCreate}
          className={clsx(
            "flex items-center justify-center gap-2 w-full py-3 rounded-xl border transition-all",
            currentTheme === 'dark' 
              ? "bg-indigo-600/20 hover:bg-indigo-600 border-indigo-500/30 text-indigo-200 hover:text-white" 
              : "bg-white hover:bg-indigo-50 border-gray-200 text-indigo-600 shadow-sm"
          )}
        >
          <Plus size={16} /> 添加新实例
        </button>
      </div>

      {/* 内容区域 */}
      <div className={containerClass}>
        
        {/* Case A: 全部实例概览视图 */}
        {selectedId === null && (
          <div className="space-y-6">
            <h1 className={clsx("text-3xl font-bold flex items-center gap-3", currentTheme === 'dark' ? "text-white" : "text-gray-900")}>
              <LayoutGrid className="text-indigo-400" /> 全部实例
              <span className={clsx("text-lg font-normal px-2 py-0.5 rounded-full", currentTheme === 'dark' ? "text-white/40 bg-white/5" : "text-gray-500 bg-black/5")}>{instances.length}</span>
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instances.map(inst => (
                <div key={inst.id} className={clsx("group relative border rounded-2xl p-5 transition-all", 
                    currentTheme === 'dark' ? "bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/20" : "bg-white hover:bg-gray-50 border-gray-200 shadow-sm hover:shadow-md"
                )}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                      <Box size={20} />
                    </div>
                    <button onClick={() => handleStartEdit(inst)} className={clsx("p-2 rounded-lg transition-colors", currentTheme==='dark'?"hover:bg-white/10 text-white/40 hover:text-white":"hover:bg-black/5 text-gray-400 hover:text-gray-900")}>
                      <Settings size={16} />
                    </button>
                  </div>
                  <h3 className={clsx("font-bold text-lg truncate mb-1", currentTheme==='dark'?"text-white":"text-gray-900")}>{inst.name}</h3>
                  <p className="text-xs truncate font-mono mb-4 opacity-50">{inst.bottleName}</p>
                  
                  <button 
                    onClick={() => onLaunch(inst)}
                    className={clsx("w-full py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2", 
                        currentTheme==='dark'?"bg-white/5 hover:bg-indigo-600 hover:text-white text-white/60":"bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-600"
                    )}
                  >
                    <Play size={14} fill="currentColor" /> 启动
                  </button>
                </div>
              ))}
              
              {/* 添加按钮卡片 */}
              <button 
                onClick={handleStartCreate}
                className={clsx("flex flex-col items-center justify-center gap-3 border border-dashed rounded-2xl p-5 transition-all h-48",
                    currentTheme === 'dark' ? "bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/30 text-white/30 hover:text-white/60" : "bg-gray-50 hover:bg-gray-100 border-gray-300 text-gray-400 hover:text-gray-600"
                )}
              >
                <Plus size={32} />
                <span className="font-medium">新建实例</span>
              </button>
            </div>
          </div>
        )}

        {/* Case B: 编辑/新建视图 */}
        {(selectedId !== null) && (
          <div className="space-y-8 max-w-2xl mx-auto animate-in slide-in-from-right-4 duration-300">
             <div className={clsx("flex justify-between items-start border-b pb-6", currentTheme==='dark'?"border-white/10":"border-black/5")}>
              <div>
                <h1 className={clsx("text-3xl font-bold", currentTheme==='dark'?"text-white":"text-gray-900")}>{isCreating ? "添加新实例" : formData.name}</h1>
                {/* 移除了 ID 显示，只显示描述 */}
                <p className={clsx("mt-1", currentTheme==='dark'?"text-white/50":"text-gray-500")}>
                  {isCreating ? "配置新的游戏启动项" : "编辑实例配置"}
                </p>
              </div>
              
              {!isCreating && (
                <div className="flex gap-2">
                  <button onClick={onClickDelete} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20" title="删除实例">
                    <Trash2 size={20} />
                  </button>
                  <button onClick={() => selectedInstance && onLaunch(selectedInstance)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all text-white">
                    <Play size={16} fill="currentColor" /> 启动
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <InputGroup label="实例名称" value={formData.name || ""} onChange={(v:any) => setFormData({...formData, name: v})} placeholder="例如: Love Plus" inputClass={inputClass} labelClass={labelClass} />
              <InputGroup label="版本备注" value={formData.info || ""} onChange={(v:any) => setFormData({...formData, info: v})} placeholder="例如: v1.0 汉化版" inputClass={inputClass} labelClass={labelClass} />

              <div className="space-y-2">
                <label className={labelClass}>运行容器 (Bottle)</label>
                <div className="relative">
                    <select 
                        value={formData.bottleName || ""}
                        onChange={e => setFormData({...formData, bottleName: e.target.value})}
                        className={clsx(inputClass, "appearance-none cursor-pointer")}
                    >
                    <option value="" disabled>请选择容器</option>
                    {bottles.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {/* 自定义下拉箭头 */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">▼</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>可执行文件 (EXE)</label>
                <div className="flex gap-2">
                  <input type="text" value={formData.executablePath || ""} onChange={e => setFormData({...formData, executablePath: e.target.value})} className={clsx(inputClass, "font-mono text-sm")} placeholder="C:/Game/start.exe" />
                  <button onClick={handleSelectFile} className={clsx("p-3 rounded-xl border transition-colors", currentTheme==='dark'?"bg-white/10 hover:bg-white/20 border-white/5":"bg-white hover:bg-gray-50 border-gray-200")}><FolderOpen size={20} /></button>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>实例背景图片 (可选)</label>
                <div className="flex gap-2">
                  <input type="text" value={formData.backgroundImage || ""} onChange={e => setFormData({...formData, backgroundImage: e.target.value})} className={clsx(inputClass, "font-mono text-sm")} placeholder="本地路径 或 HTTP 链接" />
                  <button onClick={handleSelectBgImage} className={clsx("p-3 rounded-xl border transition-colors", currentTheme==='dark'?"bg-white/10 hover:bg-white/20 border-white/5":"bg-white hover:bg-gray-50 border-gray-200")}><ImageIcon size={20} /></button>
                </div>
                {formData.backgroundImage && (
                    <div className={clsx("mt-2 w-full h-32 rounded-lg overflow-hidden border relative", currentTheme==='dark'?"border-white/10 bg-black/50":"border-gray-200 bg-gray-100")}>
                        <img 
                          src={formData.backgroundImage.startsWith('http') ? formData.backgroundImage : `file://${formData.backgroundImage}`} 
                          className="w-full h-full object-cover opacity-80" 
                          alt="Preview"
                        />
                    </div>
                )}
              </div>

              <div className="pt-6">
                <button onClick={handleSave} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                  <Save size={20} /> {isCreating ? "创建实例" : "保存修改"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DeleteModal 
        isOpen={deleteModal.isOpen} 
        instanceName={deleteModal.instance?.name || ""} 
        onClose={() => setDeleteModal({ isOpen: false, instance: null })}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder, inputClass, labelClass }: any) {
    return (
      <div className="space-y-2">
        <label className={labelClass}>{label}</label>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className={inputClass} placeholder={placeholder} />
      </div>
    )
}