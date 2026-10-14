# PersonalCost — هزینه‌های شخصی

**راهنمای فارسی استفاده پس از نصب:** [معرفی محصول، آموزش تمام بخش‌ها و اسکرین‌شات با دادهٔ نمونه](how%20to%20use.md).

A personal expense/income tracker that runs **entirely on the device**, with no backend, no Firebase and no account. It follows the same setup as Lamoo_web:

- **One React + Vite app.** It's built into a single `index.html` and runs in two places:
  - **Android APK** (Capacitor): automatically reads bank **SMS** through a small native plugin.
  - **GitHub Pages (PWA)**: the same UI in the browser, with manual entry only.
- **Data lives in local storage** (zustand `persist`, key `personalcost-store`). Nothing leaves the phone.
- **CI on every push to `main`/`master`:**
  - builds a signed APK and publishes it to the rolling **`apk`** release: `https://github.com/<owner>/PersonalCosts/releases/download/apk/personalcost.apk`
  - deploys the PWA to `https://<owner>.github.io/PersonalCosts/`

## How it works

- **A bank is just a name + its SMS sender number** (Settings → Banks). Only SMS from those numbers are read.
- `SmsReceiver.java` queues matching SMS natively (works with the app closed). When the app opens or resumes, it takes the queue and runs the **generic parser** (`src/lib/parser.ts`):
  - **amount:** the number next to «مبلغ», before «ریال/تومان», or carrying a +/− sign. Balances («مانده/موجودی»), dates, times, card numbers and OTP messages are ignored.
  - **type:** the sign wins (+ income, − expense), then keywords (واریز / برداشت / خرید …). If it can't tell, the transaction is marked with an amber dot for review.
- **Teaching a bank's SMS format** (`src/lib/smsRules.ts`): when the generic parser can't read a bank, SMS from that bank are kept as «پیامک‌های نامفهوم» instead of being dropped. Tap one (or Settings → Banks → «آموزش پیامک» with a pasted sample, or «اشتباه خوانده شده؟» on an SMS transaction), point at the amount and pick expense/income and Rial/Toman. The app stores a small rule for that bank — the words right around the amount plus the word that tells the type (e.g. «کسر») — tries it before the generic parser, and re-reads the other unread SMS with it.
- **Money is stored in Rial and shown in Toman.** Toman amounts in an SMS are converted.
- **Tags vs. «پول‌ها»:** Settings keeps two lists — expense tags (what an expense was) and «پول» tags for incomes. Every tagged income is a pot; each expense can say which pot paid for it (the review card, the add sheet and the transaction sheet all offer the pot chips).
- **Stats:** pick a month or any custom range, then switch between «آمار کلی» (summary, tag donut, spending calendar for a month, filterable list) and «آمار پول‌ها» (for that range: what came into and was paid from each pot — tap one for its expenses by tag, running balance and pace — plus a «بدون پول» view for unassigned expenses).
- **Home-screen widget (Android):** this month's and today's spending, what's left in the pots and how many transactions wait for a tag. The app pushes pre-formatted texts to `SpendWidget.java` whenever data changes.
- **Daily reminder:** a native AlarmManager alarm that shows how many transactions are still untagged.
- **Permissions:** one button in Settings (SMS + notifications, then the battery-optimization exemption).
- **Moving data:** phone and web don't share data, because there's no server. Use Settings → Backup to move it.
- The APK is signed with a **test keystore committed to the repo** (`android/keystore/`), like Lamoo, so every build installs over the previous one and keeps your data.

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
