# 🔥 MyStreak

A simple weekday streak tracker that runs entirely in your browser — no
backend, no account, no build step.

## How it works

- Every weekday (Mon–Fri), open the page and click **✅ Win** or **❌ Lose**.
- Each win adds a day to your **cumulative streak count**.
- Clicking **Lose** resets your streak to **zero**.
- Missed days and weekends don't count and don't break your streak.
- Win all five days, Monday through Friday, and you earn a **🏅 Perfect Week
  badge** — badges are collected forever on the page.
- **Forgot to log a day?** Tap any past day tile to cycle it through
  unset → ✅ win → ❌ lose → unset, and use the ‹ › arrows to reach
  earlier weeks.

All data is stored in your browser's `localStorage`, so your streak lives on
the device/browser you use to track it.

## Hosting on GitHub Pages

1. Go to the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the branch and `/ (root)` folder, then save.
4. Your tracker will be live at `https://<username>.github.io/<repo>/`.

## Development

It's a single `index.html` file with inline CSS and JavaScript. Open it
directly in a browser to test locally.
