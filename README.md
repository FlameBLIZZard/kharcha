# Kharcha 🪙

Log an expense in two taps, and save before you spend.

Kharcha is a tiny installable web app (PWA) for your phone. It pops up after every UPI or card payment with the amount already filled in, you pick a category, add a note if you want, and tap Save. It also keeps you honest about saving: you decide how much to save on payday, and it tells you how much is safe to spend each day.

Everything stays on your phone. No account, no server, no bank login.

## Features

- **Quick-add popup**: big amount, category chips, note, UPI / Card / Cash, one-tap save. Shows how much you will have left today *before* you save.
- **Auto-popup from payment notifications** (Android, via MacroDroid) and **share a bank SMS** into the app. It reads the amount and merchant, and guesses the category (Zomato → Food, Uber → Travel, Blinkit → Groceries, ...).
- **Duplicate guard**: warns if the same amount was logged in the last 5 minutes (SMS and app notification for one payment).
- **Pay yourself first**: set a monthly savings target; the home screen reminds you until you have moved it.
- **Safe to spend today**: (income − savings target − spent so far) ÷ days left in the month. Month can start on your payday.
- **Skipped it 💪**: about to buy something and didn't? Log it as skipped and the money counts toward your goal.
- **Goals** with progress rings, deadlines and the monthly pace you need. Confetti at 25 / 50 / 75 / 100%.
- **Streaks**: days in a row under your daily budget (or days logged, if you haven't set an income).
- Category budgets, history with search, CSV export, JSON backup and restore, dark and light themes, works offline.

## Install on Android

**Easiest: the APK.** On your phone, open the repo's **Releases** page, download `Kharcha.apk`, tap it to install (allow *install unknown apps* if asked). Works fully offline. In the APK, turn on **Setup → Auto-popup** (Notification access) and Kharcha shows a popup with one-tap save buttons whenever a payment notification arrives (BHIM, GPay, PhonePe, Paytm, banks, SMS). No other app needed. The APK is built by `.github/workflows/apk.yml` (Actions → *Build Android APK* → Run workflow).

**Or as a web app:**

1. Open the app's URL in Chrome.
2. Menu (⋮) → **Install app** (or *Add to Home screen*).
3. Follow **Setup → Auto-popup on Android** inside the app. Short version is in [docs/android-auto-popup.md](docs/android-auto-popup.md).

## Deep link

Anything that can open a URL can open the quick-add popup:

```
<app-url>/#add?amount=250&merchant=Zomato&note=Dinner
<app-url>/#add?text=<raw bank SMS or notification text>
```

`text` must be the last parameter; it may contain spaces and symbols unencoded.

## Develop

No build step. Serve the folder and open it:

```
npm start        # python -m http.server 8080
npm test         # SMS parser tests
```

- `index.html` holds the UI, styles and app logic.
- `parse.js` turns SMS / notification text into amount, merchant and a category guess.
- `sw.js` caches the app so it opens offline.

Hosting: GitHub Pages via `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions).

## License

MIT
