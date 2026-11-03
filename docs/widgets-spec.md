# Kharcha home-screen widgets (spec for native side)

All widgets: black background, white text, hairline border, Space Grotesk-style numbers (system sans-serif bold is fine), no colours except white/grey. Tapping the body opens the app. Every widget reads the same JSON that `KN.setWidget(w)` already stores; `w.stats` is new and optional (old fields amount/label/line still sent). Missing/null fields => show a dash or hide that part. Refresh whenever setWidget is called, plus on boot and midnight.

`w.stats`:
```
currency, todaySpent, monthSpent, spendable, budgetLeft (null if no income set), pctUsed (0-999 or null),
daysLeft, safeToday (null if no income; negative = over), week:[{d:'M',v:250} x7, oldest first, last = today],
weekTotal, goal:{name,emoji,saved,target,pct}|null, bill:{name,amt,left(days)}|null,
top:{name,emoji,amt}|null, streak (days)
```

| Widget | Size | Shows |
|---|---|---|
| Today (existing, upgrade) | 2x1 | Safe to spend today (or Over by), small "Spent X today" |
| Budget left | 2x2 | Big budgetLeft, bar of pctUsed, "N days left" |
| Week chart | 4x2 | 7 vertical bars, day letters, weekTotal, today's bar full white, others grey |
| Goal | 2x2 | emoji + name, progress bar pct, "saved / target" |
| Quick add | 1x1 and 4x1 | "+ Add" button opens add sheet (same intent as the quick-settings tile); 4x1 also a "Skipped it" button |
| Next bill | 2x1 | bill name, amt, "in N days" / "today" |
| Pulse | 2x1 | streak days + top category this month |

Rules: resizable (minWidth/minHeight, resizeMode horizontal|vertical), previewLayout for the picker, each its own AppWidgetProvider with a clear label in the picker ("Kharcha . Week chart"). Don't draw with images that need storage permission. No accessibility service, no new permissions.
