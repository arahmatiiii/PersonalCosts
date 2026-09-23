import { useEffect } from "react";
import BottomNav from "./components/BottomNav";
import HomePage from "./components/HomePage";
import SettingsPage from "./components/SettingsPage";
import StatsPage from "./components/StatsPage";
import { startNativeBridge } from "./native/bridge";
import { isNative } from "./native/personalCost";
import { useStore } from "./store/useStore";

export default function App() {
  const activeTab = useStore((s) => s.activeTab);

  useEffect(() => {
    // Offline app shell for the PWA (not needed inside the APK, which bundles everything).
    if (!isNative && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  }, []);

  // Android only: syncs bank filters / reminder to native and pulls in captured SMS & notifications.
  useEffect(() => startNativeBridge(), []);

  return (
    <>
      <main className="content" key={activeTab}>
        {activeTab === "stats" ? <StatsPage /> : activeTab === "settings" ? <SettingsPage /> : <HomePage />}
      </main>
      <BottomNav />
    </>
  );
}
