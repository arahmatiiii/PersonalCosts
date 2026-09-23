import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Stats from "./pages/Stats";

// HashRouter: GitHub Pages has no SPA rewrites, so deep links like /PersonalCosts/stats would 404.
export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="splash">…</div>;
  if (!user) return <Login />;

  return (
    <HashRouter>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>
          <span>📋</span>امروز
        </NavLink>
        <NavLink to="/stats">
          <span>📊</span>آمار
        </NavLink>
        <NavLink to="/settings">
          <span>⚙️</span>تنظیمات
        </NavLink>
      </nav>
    </HashRouter>
  );
}
