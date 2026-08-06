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
- A **progression bar** under the streak counter tracks your climb toward
  the next milestone (10, 25, 50, 100, 250, 500, 1000 days), with ⭐ chips
  for every milestone you've already reached.

## Where your data lives

By default all data is stored in your browser's `localStorage`. This survives
page refreshes and browser restarts, but it is tied to one browser on one
device, and clearing site data (or using private/incognito mode) wipes it.

### ☁️ Cloud sync (recommended)

GitHub Pages is static hosting — there is no server to run a database like
SQLite on. Instead, MyStreak can use **this repository itself as the
database**: it commits your data to a `streak.json` file on a dedicated
`streak-data` branch via the GitHub API. Your streak then survives anything
and syncs across all your devices.

To enable it:

1. Create a **fine-grained personal access token**: GitHub → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token.
2. Under **Repository access** select **Only select repositories** and pick
   this repo.
3. Under **Permissions → Repository permissions** set **Contents** to
   **Read and write**. Nothing else is needed.
4. Paste the token into the **Cloud sync** card on the page and hit
   **Connect**.

The token is stored only in your browser's localStorage and sent only to
`api.github.com`. Changes are saved automatically a moment after each click;
opening the page on another device (and connecting with the same token) pulls
your data down and merges it.

## Hosting on GitHub Pages

1. Go to the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the branch and `/ (root)` folder, then save.
4. Your tracker will be live at `https://<username>.github.io/<repo>/`.

## Development

It's a single `index.html` file with inline CSS and JavaScript. Open it
directly in a browser to test locally.
