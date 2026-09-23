import { BarChart3, ListChecks, Settings } from "lucide-react";
import { useStore, type TabId } from "../store/useStore";

const tabs: { id: TabId; label: string; icon: typeof ListChecks }[] = [
  { id: "home", label: "امروز", icon: ListChecks },
  { id: "stats", label: "آمار", icon: BarChart3 },
  { id: "settings", label: "تنظیمات", icon: Settings },
];

export default function BottomNav() {
  const { activeTab, setActiveTab, transactions } = useStore();
  const untagged = transactions.filter((t) => !t.tagged).length;
  return (
    <nav className="tabbar">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
          <Icon size={22} />
          {label}
          {id === "home" && untagged > 0 && <span className="nav-badge">{untagged.toLocaleString("fa-IR")}</span>}
        </button>
      ))}
    </nav>
  );
}
