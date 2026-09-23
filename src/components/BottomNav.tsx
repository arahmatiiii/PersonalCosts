import { BarChart3, Home, Settings } from "lucide-react";
import { faNum } from "../lib/format";
import { useStore, type TabId } from "../store/useStore";

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "امروز", icon: Home },
  { id: "stats", label: "آمار", icon: BarChart3 },
  { id: "settings", label: "تنظیمات", icon: Settings },
];

export default function BottomNav() {
  const { activeTab, setActiveTab, transactions } = useStore();
  const untagged = transactions.filter((t) => !t.tagged).length;
  return (
    <nav className="nav">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className={activeTab === id ? "on" : ""} onClick={() => setActiveTab(id)}>
          <Icon size={20} />
          {activeTab === id && label}
          {id === "home" && untagged > 0 && activeTab !== "home" && <span className="badge">{faNum(untagged)}</span>}
        </button>
      ))}
    </nav>
  );
}
