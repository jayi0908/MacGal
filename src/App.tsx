import { useState, useEffect, useRef } from "react";
import { Layout } from "./components/Layout";
import { LaunchControl } from "./components/LaunchControl";
import { InstancesPage, GameInstance } from "./components/InstancesPage";
import { DiscoveryPage } from "./components/DiscoveryPage";
import { SettingsPage } from "./components/SettingsPage";
import { invoke } from "@tauri-apps/api/core";
import { ToastProvider, useToast } from "./components/ToastProvider";
import { useTheme, ThemeProvider } from "./contexts/ThemeContext";
import { listen } from "@tauri-apps/api/event";

const INITIAL_INSTANCES: GameInstance[] = [];

function AppContent() {
  const [activeTab, setActiveTab] = useState<"home" | "instances" | "discovery" | "settings">("home");
  const [instances, setInstances] = useState<GameInstance[]>([]);
  const { config } = useTheme();
  const { showToast } = useToast();
  const isLoaded = useRef(false);

  // 辅助函数：对实例列表进行排序（最近启动的在最前，然后是新建的）
  const sortInstances = (list: GameInstance[]) => {
    return [...list].sort((a, b) => {
        // 如果有 lastPlayed，按时间倒序
        const timeA = a.lastPlayed || 0;
        const timeB = b.lastPlayed || 0;
        if (timeA !== timeB) return timeB - timeA;
        // 否则按 ID 倒序（通常意味着按创建时间）
        return b.id.localeCompare(a.id);
    });
  };

  // 核心数据加载函数
  const loadInstancesData = async (isManual = false) => {
    try {
      console.log("正在从后端读取实例数据...");
      const jsonString = await invoke<string>("load_instances");
      const loadedData = JSON.parse(jsonString);

      if (Array.isArray(loadedData)) {
        const sorted = sortInstances(loadedData);
        setInstances(sorted);
        if (isManual) {
          showToast("数据已刷新", "success");
        }
      } else {
        setInstances(INITIAL_INSTANCES);
      }
    } catch (e) {
      console.error("加载失败:", e);
      showToast("数据加载失败", "error");
    }
  };

  useEffect(() => {
    if (!isLoaded.current) {
      isLoaded.current = true;
      loadInstancesData(false);
    }
  }, []);

  const handleUpdateInstances = async (newInstances: GameInstance[]) => {
    const sorted = sortInstances(newInstances);
    setInstances(sorted);
    try {
      await invoke("save_instances", { data: JSON.stringify(sorted, null, 2) });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    // 定义一个解绑函数
    let unlisten: () => void;

    const setupListener = async () => {
      unlisten = await listen<{ instance_id: string; duration_sec: number }>("game-finished", (event) => {
        const { instance_id, duration_sec } = event.payload;
        console.log(`收到游戏结束事件: ID=${instance_id}, 时长=${duration_sec}s`);

        setInstances((prevInstances) => {
          const todayKey = new Date().toLocaleDateString("en-CA"); // 格式 YYYY-MM-DD
          
          const newInstances = prevInstances.map((inst) => {
            if (inst.id === instance_id) {
              const currentHistory = inst.playHistory || {};
              const todayTime = (currentHistory[todayKey] || 0) + duration_sec;
              
              return {
                ...inst,
                totalPlayTime: (inst.totalPlayTime || 0) + duration_sec,
                playHistory: { ...currentHistory, [todayKey]: todayTime },
              };
            }
            return inst;
          });
          
          // 自动保存到本地文件
          invoke("save_instances", { data: JSON.stringify(newInstances, null, 2) });
          return newInstances;
        });
      });
    };

    setupListener();

    // 组件卸载时取消监听
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleLaunch = async (instance: GameInstance) => {
    try {
      const response = await invoke("launch_game", {
        instanceId: instance.id,
        config: {
          bottle_path: `${config.bottlesPath}/${instance.bottleName}`,
          game_exe: instance.executablePath,
          crossover_app_path: config.crossoverPath
        }
      });
      showToast(`${instance.name} 启动成功 (PID: ${response})`, "success");

      const newInstances = instances.map(i => 
        i.id === instance.id ? { ...i, lastPlayed: Date.now() } : i
      );
      // 自动排序并保存
      const sorted = newInstances.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
      handleUpdateInstances(sorted);
    } catch (error) {
      console.error("启动异常:", error);
      showToast(`${error}`, "error");
    }
  };

  const currentDisplayInstance = instances.length > 0 ? instances[0] : undefined;

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      // 传递当前选中的实例（暂时默认第一个，或者你可以增加一个 selectedInstanceId 的 state）
      currentInstance={currentDisplayInstance} 
      bgImage="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2568&auto=format&fit=crop"
      onRefresh={() => loadInstancesData(true)} 
      bottomAction={
        <LaunchControl 
          instances={instances} 
          onLaunch={handleLaunch} 
          onGoToSettings={() => setActiveTab("instances")}
        />
      }
    >
      {/* Home 页内容 */}
      {activeTab === "home" && (
        <div className="max-w-2xl mt-40 px-10 animate-in slide-in-from-left-10 fade-in duration-500">
          <h3 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
            {/* {currentDisplayInstance?.name || */"Ciallo~ (∠・ω< )⌒★"}
          </h3>
          <p className="text-xl text-white/80 leading-relaxed max-w-lg drop-shadow-md">
            {/* currentDisplayInstance?.info || */"欢迎使用 MacGal"}
          </p>
        </div>
      )}

      {/* 实例管理页 */}
      {activeTab === "instances" && (
        <InstancesPage 
          instances={instances} 
          setInstances={handleUpdateInstances} 
          onLaunch={handleLaunch} 
        />
      )}

      {/* 发现页 */}
      {activeTab === 'discovery' && <DiscoveryPage />}
      
      {/* 设置页 */}
      {activeTab === "settings" && (
        <SettingsPage />
      )}

    </Layout>
  );
}

function App() {
  return (
    // --- 2. 关键修复：必须包裹 ThemeProvider，否则 useTheme 会报错导致白屏 ---
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;