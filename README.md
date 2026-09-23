# PersonalCost — هزینه‌های شخصی

A personal expense/income tracker that runs **entirely on the device**, with no backend, no Firebase and no account. It follows the same setup as Lamoo_web:

- **One React + Vite app.** It's built into a single `index.html` and runs in two places:
  - **Android APK** (Capacitor): automatically captures bank **SMS** and **notifications** via a small native plugin.
  - **GitHub Pages (PWA)**: the same UI in the browser, with manual entry only.
- **Data lives in local storage** (zustand `persist`, key `personalcost-store`). Nothing leaves the phone.
- **CI on every push to `main`/`master`:**
  - builds a signed APK and publishes it to the rolling **`apk`** release: `https://github.com/<owner>/PersonalCosts/releases/download/apk/personalcost.apk`
  - deploys the PWA to `https://<owner>.github.io/PersonalCosts/`

```
├── src/
│   ├── store/useStore.ts        all state (transactions, banks, tags, settings, debug log), persisted locally
│   ├── lib/parser.ts            regex/keyword parsing + Persian text normalization (+ tests)
│   ├── lib/ingest.ts            raw capture → transaction, 2-minute SMS/notification dedup (+ tests)
│   ├── native/                  Capacitor bridge to the Android plugin (no-op on the web)
│   ├── components/              HomePage (today + tagging), StatsPage, SettingsPage, …
│   └── seed/                    the 3 default banks and starter tags
├── android/                     Capacitor Android project
│   └── app/src/main/java/com/personalcost/app/
│       ├── PersonalCostPlugin.java        JS ↔ native bridge
│       ├── BankNotificationListener.java  NotificationListenerService
│       ├── SmsReceiver.java               SMS_RECEIVED
│       ├── CaptureStore.java              native queue + filters + reminder settings
│       ├── ReminderReceiver.java          daily AlarmManager reminder
│       └── BootReceiver.java              re-arm after reboot/update
├── public/                      manifest.json, sw.js (offline), icons
└── .github/workflows/           apk.yml, deploy.yml
```

## How capture works

1. Whenever the bank list changes, JS sends the bank apps' package names and SMS sender IDs to native (`setFilters`).
2. `BankNotificationListener` / `SmsReceiver` save matching raw texts into a native queue (SharedPreferences). This works even when the app is closed.
3. When the app opens, comes to the foreground, or gets a live `capture` event, JS takes the queue, parses it with each bank's regex/keywords (`src/lib/parser.ts`), drops duplicates, stores the transactions, then acks the queue. Parsing happens only in JS, so the in-app "test with a sample SMS" box uses exactly the same code.
4. The daily reminder is a native AlarmManager alarm. It uses the untagged count JS last reported plus bank captures still in the queue, so it's accurate even if you haven't opened the app. Tapping it opens the app.

## Decisions worth knowing

- **Money is stored in Rial and shown in Toman** (÷10). Manual entry is typed in Toman.
- **Persian text is normalized before matching:** Persian/Arabic digits → ASCII, `٬`/`،` → `,`, Arabic `ي`/`ك` → Persian, ZWNJ → space. So `([\d,]+)\s*ريال` also matches `۲٬۵۰۰٬۰۰۰ ریال`.
- **Unclear type is flagged, not hidden.** When no keyword matches, the transaction is saved as an expense with `typeUncertain` set. It's highlighted in amber and Stats warns about it.
- **Dedup:** a capture is dropped if within 2 minutes there's already one with the same bank + amount and either the same text or from the other channel (SMS vs notification).
- **Phone and web don't share data**, because there's no server. Use **Settings → Backup** to export/import JSON if you want to move data between them.
- The APK is signed with a **test keystore committed to the repo** (`android/keystore/`), like Lamoo. That way every CI build installs over the previous one and your data is kept.

## First-time setup

1. **GitHub Pages:** the deploy workflow tries to turn Pages on by itself. If the first run's deploy fails, go to **Settings → Pages → Source: GitHub Actions** once and re-run it.
2. **Install the APK** from the `apk` release. Open **Settings → Automatic capture** and turn every ❌ into ✅:
   - Notification access (opens system settings)
   - SMS permission
   - Notification permission (for the reminder)
   - **Battery optimization exemption**: without it Android kills the listener and transactions stop being captured with no error. On Xiaomi/Samsung/Huawei also enable Autostart and lock the app in recents.
3. **Verify the bank rules.** The 3 default banks ship with `VERIFY_ME_*` placeholders:
   1. Turn on **"capture all notifications and SMS"**, receive a real message from each bank, and open the raw log to see the package name / sender and the full text.
   2. Edit each bank: enter the real package name / sender, paste a real message into the test box, and adjust the regex/keywords until the amount and type come out right.
   3. Turn capture-all off again.
   4. For the first week, glance at the log for `UNPARSED` entries (a wrong regex drops transactions without any error).

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # parser / ingest / dedup tests
npm run typecheck
npm run build        # dist/index.html (single file)

# Android (needs JDK 21 + Android SDK)
npx cap sync android
cd android && ./gradlew assembleRelease
```
