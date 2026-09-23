# PersonalCost

A single-user personal expense/income tracker with two front ends sharing one Firebase backend:

| Part | What it does |
|---|---|
| **`android/`** — companion app (Kotlin, sideloaded) | Listens to bank **notifications** and **SMS**, parses amount + income/expense with per-bank regex rules stored in Firestore, writes raw transactions to Firestore. Owns the daily "you have N untagged transactions" reminder. Minimal UI: sign-in + a status screen that makes every silent failure visible. |
| **`web/`** — PWA (React + Vite + TS, GitHub Pages) | Real-time daily list, inline tagging/notes, income/expense correction, manual entry, weekly/monthly/custom stats by tag, and Settings for banks, reminder time and tags. Installable via "Add to Home Screen", works offline from the Firestore cache. |

Both sign in with the **same Firebase Email/Password account**, so anything the phone captures shows up in the web app within seconds.

```
personalcost/
├── web/                     PWA (see web/src/{pages,components,hooks,lib})
├── android/                 Companion listener app (Gradle project)
├── .github/workflows/
│   ├── deploy-web.yml       build + test web on every push, deploy main to GitHub Pages
│   └── android.yml          build + unit-test the APK, upload it as an artifact
├── firestore.rules          locks everything to your UID
├── firestore.indexes.json   (no composite indexes needed)
└── firebase.json
```

---

## Decisions worth knowing

- **Money is stored in Rial, always.** That's what Iranian banks quote, so the parser stores exactly what the SMS says. The web UI divides by 10 and shows **Toman** everywhere (manual entry is typed in Toman and multiplied by 10). See `web/src/lib/format.ts`.
- **Bank rules live in Firestore (`banks`), not in the APK.** Add a 4th bank from web Settings and the phone picks it up on its next sync (opening the app, or every 6 h) — no rebuild.
- **Text normalization before matching:** Persian/Arabic digits → ASCII, `٬`/`،` → `,`, Arabic `ي`/`ك` → Persian `ی`/`ک`, ZWNJ → space. So the seeded regex `([\d,]+)\s*ريال` also matches `۲٬۵۰۰٬۰۰۰ ریال`. The same logic exists in Kotlin (`ParserEngine.kt`) and TypeScript (`web/src/lib/parser.ts`, used by the "test with a sample SMS" box in Settings) — keep them in sync.
- **Unclear type is flagged, not hidden.** If no expense/income keyword matches, the transaction is saved as `expense` with `typeUncertain: true` and `note: "auto: type unclear, please verify"`. The Dashboard highlights these in amber and Stats warns when they're in range.
- **Dedup** (Android, local): a capture is dropped if within 2 minutes we already saved one with the same bank + amount and either the identical raw text or the *other* channel (SMS vs notification — their texts usually differ).
- **Offline:** Android writes are fire-and-forget into Firestore's offline queue; bank rules are cached on disk; captures that arrive before the first rules sync or while signed out are queued locally and reprocessed after the next sync.
- **Reminder** is a self-rescheduling WorkManager job pinned to the configured clock time (a 24 h `PeriodicWorkRequest` drifts). Tapping it opens the PWA.
- Extra fields vs. the original spec: `transactions.typeUncertain` (bool) and `source: "manual"` for hand-entered ones (`bankId: "cash"` means cash).

### Firestore data model

```
transactions/{id}  amount (Rial), type, bankId, timestamp, rawText, source, tag, note, tagged, typeUncertain, createdAt
banks/{id}         name, matchPackages[], matchSenderIds[], regexAmount, incomeKeywords[], expenseKeywords[], enabled, isDefault
tags/{id}          label, color, order
settings/user      reminderHour, reminderMinute, reminderEnabled
```

---

## Setup

### 0. Check Firebase reachability from Iran first

Before investing in setup, open `https://firestore.googleapis.com` and the Firebase console from your phone's normal network (with and without VPN). If Firestore is unreliable, see [Fallback](#fallback-supabase).

### 1. Firebase project

1. Create a project in the [Firebase console](https://console.firebase.google.com) (e.g. `personalcost-<you>`).
2. **Firestore** → Create database → production mode → region e.g. `europe-west1`.
3. **Authentication** → Sign-in method → enable **Email/Password**. Users → **Add user** with your email. There is no sign-up flow on purpose.
4. Copy that user's **UID** into `firestore.rules` (replace `REPLACE_WITH_YOUR_FIREBASE_UID`) and deploy:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add            # pick your project
   firebase deploy --only firestore:rules,firestore:indexes
   ```
5. Project settings → General → **Add app → Web**. Keep the config values for step 2.
6. Project settings → General → **Add app → Android**, package name `com.personalcost.app`. Download **`google-services.json`**.
7. Authentication → Settings → **Authorized domains** → add `<your-github-username>.github.io`.

### 2. Web app → GitHub Pages

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions**, add:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
3. Push to `main`. The site is served at `https://<user>.github.io/PersonalCosts/`.
   - `base` in `web/vite.config.ts`, `start_url`/`scope` in `web/public/manifest.webmanifest` and the paths in `web/index.html` must match the repo name (`/PersonalCosts/`). Change all of them if you rename the repo.
4. Sign in, open **Settings** → "ایجاد داده‌های پیش‌فرض" seeds the 3 default banks (from `web/src/seed/banks.json`), some preset tags and the reminder settings.
5. On your Android phone, open the site in Chrome → menu → **Add to Home screen / Install app**.

Local development:
```bash
cd web
cp .env.example .env.local   # fill in the Firebase web config
npm install
npm run dev                  # http://localhost:5173/PersonalCosts/
npm test                     # parser unit tests
npm run build
```
Icons are generated from an inline SVG with `node scripts/make-icons.mjs` (needs `playwright-core` + a Chromium).

### 3. Android companion app

**Option A — build in GitHub Actions (no Android Studio needed):** add a repo secret `GOOGLE_SERVICES_JSON` containing the full contents of `google-services.json`, then push (or run the **Android APK** workflow manually). Download `personalcost-debug-apk` from the run's artifacts. Without the secret the workflow still builds, but with a dummy Firebase config that can't connect.

**Option B — local:** put `google-services.json` in `android/app/` (it's gitignored), then
```bash
cd android
./gradlew assembleDebug      # needs JDK 17 + Android SDK (ANDROID_HOME or local.properties sdk.dir)
./gradlew testDebugUnitTest  # ParserEngine tests
adb install app/build/outputs/apk/debug/app-debug.apk
```
The reminder notification opens `pwaUrl` from `android/gradle.properties` — change it if your Pages URL differs.

**On the phone, after installing:**
1. Sign in with the same email/password.
2. On the status screen, turn every ❌ into ✅:
   - **Notification access** (opens system settings — no runtime dialog exists for this).
   - **SMS** permission.
   - **Notifications** permission (Android 13+, for the reminder).
   - **Battery optimization exemption** — the most common real-world failure: without it Android kills the listener and transactions silently stop being captured. On Xiaomi/Samsung/Huawei also enable **Autostart** and lock the app in recents.

### 4. Verify the bank rules on your device (do not skip)

The seeded package names and SMS sender IDs are `VERIFY_ME_*` placeholders; the web and Android UIs both warn while they're present.

1. In the Android app, enable **"ثبت همه اعلان‌ها و پیامک‌ها"** (capture all) in the debug section.
2. Receive a real notification/SMS from each bank, then tap **نمایش لاگ**. Each entry shows the source package or SMS sender and the full text.
3. In web **Settings → بانک‌ها → ویرایش**, enter the real package name(s) and sender ID(s), paste a real message into **"تست با یک پیامک نمونه"** and adjust the regex/keywords until it shows the right amount and type. Save.
4. Back in the Android app tap **همگام‌سازی الان**, then turn capture-all off.
5. For the first week, glance at the log for `UNPARSED` entries — those are bank messages whose regex didn't match (a wrong regex drops transactions silently otherwise).

Sender IDs are compared after stripping spaces/`+` and the `0098`/`98`/`0` prefix, so `+98 999…`, `0098999…` and `0999…` are equivalent.

### 5. End-to-end check

Trigger a real bank transaction → within seconds it appears on the web Dashboard (highlighted as untagged) → tap a tag → it moves to the compact view and shows up in **Stats**.

---

## Fallback: Supabase

If Firestore is flaky from Iran, the same model maps directly to Postgres tables (`transactions`, `banks`, `tags`, `settings`) with row-level security replacing `firestore.rules` (`auth.uid() = '<your uid>'`) and Supabase Realtime replacing `onSnapshot`. The swap is contained: on the web side, `web/src/firebase.ts` and `web/src/hooks/*`; on Android, `FirestoreRepository.kt` and `FirebaseAuthManager.kt`. Parsing, dedup, queueing and all UI stay as they are.
