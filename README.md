# 💸 Spending Tracker

A simple monthly spending tracker that runs entirely in your browser — no
backend, no account, no build step.

## How it works

- Tap any day in the month grid, then add what you spent. You can add **as
  many amounts per day as you like** (with an optional note like "groceries"),
  not just one figure per day.
- Each day cell shows that **day's total**.
- A strip under each calendar row shows that **week's total**.
- The big number at the top is the **month's total**, alongside the number of
  days with spending, the average per day, and your biggest day.
- Use the ‹ › arrows to move between months.

## Red flags

Amounts are in **euros (€)** by default.

- Any day totalling **above €20** is highlighted **red** in the grid.
- If the **month totals above €600**, the whole month view turns red — the
  total, the month name, and both cards — with a warning under the budget bar.

Both thresholds are "strictly above", so a day of exactly €20.00 and a month
of exactly €600.00 stay normal. Both are editable in **Settings** (clear a
field to switch that rule off), and the currency symbol is configurable too.

## Theme

The button in the top-right corner cycles **🖥️ Auto → ☀️ Light → 🌙 Dark**.
Auto follows your device's appearance setting; picking Light or Dark forces
that theme and is remembered on the device (it is deliberately not synced, so
each device keeps its own preference).

Amounts are stored as whole cents internally, so the daily, weekly, and
monthly sums always add up exactly.

> Weekly totals cover only the days of the displayed month, so the week
> totals always sum to the month total even when a calendar week straddles
> two months.

## Where your data lives

By default all data is stored in your browser's `localStorage`. This survives
page refreshes and browser restarts, but it is tied to one browser on one
device, and clearing site data (or using private/incognito mode) wipes it.

### ☁️ Cloud sync (recommended)

GitHub Pages is static hosting — there is no server to run a database like
SQLite on. Instead, this app can use **the repository itself as the
database**: it commits your data to a `spending.json` file on a dedicated
`spending-data` branch via the GitHub API. Your history then survives
anything and syncs across all your devices.

To enable it:

1. Create a **fine-grained personal access token**: GitHub → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token.
2. Under **Repository access** select **Only select repositories** and pick
   this repo.
3. Under **Permissions → Repository permissions** set **Contents** to
   **Read and write**. Nothing else is needed.
4. Paste the token into the **Cloud sync** box on the page and hit
   **Connect**.

The token is stored only in your browser's localStorage and sent only to
`api.github.com`. Changes save automatically a moment after each edit;
opening the page on another device (and connecting with the same token)
merges both sides — expenses are matched by id, and anything you delete stays
deleted.

## Hosting on GitHub Pages

1. Go to the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the branch and `/ (root)` folder, then save.
4. Your tracker will be live at `https://<username>.github.io/<repo>/`.

## Development

`index.html` holds the whole app — inline CSS and JavaScript, no build step.
Open it directly in a browser to test locally.

The icon lives in `favicon.svg`, where the euro sign is drawn as geometry
rather than text so it never depends on an installed font. `favicon-32.png`
and `favicon-180.png` (the iOS home-screen icon) are rasters of that same
file; regenerate them from the SVG if you change it.
