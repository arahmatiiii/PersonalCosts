import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { auth, firebaseConfigured } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError((err as { code?: string }).code ?? String(err));
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card stack" onSubmit={submit}>
        <h1>PersonalCost</h1>
        {!firebaseConfigured && (
          <p className="error small">پیکربندی Firebase پیدا نشد (متغیرهای VITE_FIREBASE_* هنگام build تنظیم نشده‌اند).</p>
        )}
        <label>
          ایمیل
          <input type="email" dir="ltr" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          رمز عبور
          <input
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error small" dir="ltr">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          ورود
        </button>
      </form>
    </main>
  );
}
