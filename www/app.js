/* My Budget Spending Streak
 *
 * Vanilla JS, no bundler: Capacitor exposes native plugins on
 * window.Capacitor.Plugins at runtime, so the same file runs in a plain
 * browser (for development) and inside the native app.
 */
(function () {
  "use strict";

  var STORE_KEY = "mbss-data-v1";
  var THEME_KEY = "mbss-theme";
  var APP_VERSION = "0.1.0";
  var PRIVACY_URL = "https://daniel-shecco.github.io/my-budget-spending-streak/privacy.html";

  var DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];

  var DEFAULT_CURRENCY = "€";
  var DEFAULT_BUDGET = 60000;    // 600.00 per month
  var DEFAULT_DAY_LIMIT = 2000;  // 20.00 per day

  // ---------------------------------------------------------------- platform
  var Cap = window.Capacitor;
  var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var platform = (Cap && Cap.getPlatform && Cap.getPlatform()) || "web";
  var Plugins = (Cap && Cap.Plugins) || {};

  // Preferences (native key-value store) survives WebView storage eviction,
  // which localStorage on iOS does not reliably do. Fall back to localStorage
  // in the browser.
  var Store = {
    get: function (key) {
      if (Plugins.Preferences) {
        return Plugins.Preferences.get({ key: key }).then(function (r) { return r.value; });
      }
      try { return Promise.resolve(localStorage.getItem(key)); }
      catch (e) { return Promise.resolve(null); }
    },
    set: function (key, value) {
      if (Plugins.Preferences) return Plugins.Preferences.set({ key: key, value: value });
      try { localStorage.setItem(key, value); } catch (e) {}
      return Promise.resolve();
    }
  };

  // ---------------------------------------------------------------- data
  function blank() {
    return { version: 1, currency: null, budget: null, dayLimit: null, entries: {} };
  }
  var data = blank();

  function normalise(d) {
    if (!d || typeof d !== "object") d = blank();
    if (!d.entries || typeof d.entries !== "object") d.entries = {};
    if (typeof d.currency !== "string" || !d.currency) d.currency = null;
    if (typeof d.budget !== "number") d.budget = null;
    if (typeof d.dayLimit !== "number") d.dayLimit = null;
    return d;
  }
  function loadData() {
    return Store.get(STORE_KEY).then(function (raw) {
      try { data = normalise(raw ? JSON.parse(raw) : blank()); }
      catch (e) { data = blank(); }
      return data;
    });
  }
  var saveTimer = null;
  function saveData() {
    // Debounced: typing in a settings field shouldn't hit the disk per keystroke.
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      Store.set(STORE_KEY, JSON.stringify(data));
    }, 200);
  }

  function currency() { return data.currency || DEFAULT_CURRENCY; }
  function budgetLimit() { return data.budget == null ? DEFAULT_BUDGET : data.budget; }
  function dayLimit() { return data.dayLimit == null ? DEFAULT_DAY_LIMIT : data.dayLimit; }
  function isDayOver(cents) { return dayLimit() > 0 && cents > dayLimit(); }
  function isMonthOver(cents) { return budgetLimit() > 0 && cents > budgetLimit(); }

  // ---------------------------------------------------------------- money
  function parseAmount(str) {
    if (typeof str !== "string") return null;
    var s = str.trim().replace(/[^\d.,-]/g, "");
    if (!s) return null;
    if (s.indexOf(",") !== -1 && s.indexOf(".") === -1) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    var n = parseFloat(s);
    if (isNaN(n) || !isFinite(n)) return null;
    return Math.round(n * 100);
  }
  function money(cents) {
    var neg = cents < 0;
    return (neg ? "-" : "") + currency() + (Math.abs(cents) / 100).toFixed(2);
  }
  function compact(cents) {
    var v = cents / 100;
    return v % 1 === 0 ? String(v) : v.toFixed(2);
  }

  // ---------------------------------------------------------------- dates
  function dateKey(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  function keyToDate(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function mondayOf(d) {
    var m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  }
  function sameMonth(d, y, m) { return d.getFullYear() === y && d.getMonth() === m; }

  // ---------------------------------------------------------------- totals
  function entriesFor(key) { return data.entries[key] || []; }
  function dayTotal(key) {
    return entriesFor(key).reduce(function (s, e) { return s + e.cents; }, 0);
  }
  function monthDays(y, m) {
    var out = [], last = new Date(y, m + 1, 0).getDate();
    for (var i = 1; i <= last; i++) out.push(dateKey(new Date(y, m, i)));
    return out;
  }
  function monthTotal(y, m) {
    return monthDays(y, m).reduce(function (s, k) { return s + dayTotal(k); }, 0);
  }

  // Streak: consecutive days, ending today, whose total stayed within the
  // daily budget. A day with nothing logged counts as a day under budget.
  // Today only breaks the streak once it actually goes over.
  function computeStreak() {
    var limit = dayLimit();
    if (limit <= 0) return { current: 0, best: 0, enabled: false };

    // The streak only spans days you have actually been using the app, so a
    // brand-new install starts at zero rather than inheriting all of history.
    var keys = Object.keys(data.entries).filter(function (k) { return entriesFor(k).length; }).sort();
    if (!keys.length) return { current: 0, best: 0, enabled: true };

    var today = new Date();
    var end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var first = keyToDate(keys[0]);

    var current = 0;
    var d = end;
    while (d >= first) {
      if (dayTotal(dateKey(d)) > limit) break;
      current++;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    }

    var best = current, run = 0, cur = first;
    while (cur <= end) {
      if (dayTotal(dateKey(cur)) > limit) run = 0;
      else { run++; if (run > best) best = run; }
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
    return { current: current, best: best, enabled: true };
  }

  // ---------------------------------------------------------------- state
  var today = new Date();
  var viewYear = today.getFullYear();
  var viewMonth = today.getMonth();
  var selectedKey = dateKey(today);

  function $(id) { return document.getElementById(id); }

  function render() {
    renderStreak();
    renderSummary();
    renderCalendar();
    renderDay();
    renderHistory();
    renderSettings();
  }

  function renderStreak() {
    var s = computeStreak();
    var card = $("streakCard");
    var todayTotal = dayTotal(dateKey(new Date()));

    $("streakCount").textContent = s.current;
    $("streakBest").textContent = s.best;
    $("streakToday").textContent = money(todayTotal);
    $("streakLabel").textContent = s.current === 1 ? "day under budget" : "days under budget";

    card.classList.toggle("alive", s.enabled && s.current > 0);
    card.classList.toggle("broken", s.enabled && s.current === 0);
    $("streakFlame").textContent =
      !s.enabled ? "🎯" : s.current === 0 ? "💤" : s.current >= 30 ? "🌋" : s.current >= 7 ? "🔥🔥" : "🔥";

    if (!s.enabled) {
      $("streakNote").textContent = "Set a daily budget in Settings to start a streak.";
    } else if (isDayOver(todayTotal)) {
      $("streakNote").textContent = "Today went over " + money(dayLimit()) + " — the streak restarts tomorrow.";
    } else {
      $("streakNote").textContent = money(dayLimit() - todayTotal) + " left today to keep the streak.";
    }
  }

  function renderSummary() {
    $("monthName").textContent = MONTH_NAMES[viewMonth] + " " + viewYear;
    var total = monthTotal(viewYear, viewMonth);
    $("monthTotal").textContent = money(total);

    var keys = monthDays(viewYear, viewMonth);
    var spentDays = 0, biggest = 0;
    keys.forEach(function (k) {
      var t = dayTotal(k);
      if (t !== 0) spentDays++;
      if (t > biggest) biggest = t;
    });
    var elapsed = sameMonth(today, viewYear, viewMonth) ? today.getDate() : keys.length;
    $("statDays").textContent = spentDays;
    $("statAvg").textContent = money(elapsed ? Math.round(total / elapsed) : 0);
    $("statMax").textContent = money(biggest);

    var limit = budgetLimit();
    var over = isMonthOver(total);
    var wrap = $("budgetWrap");
    if (limit <= 0) {
      wrap.style.display = "none";
    } else {
      wrap.style.display = "";
      var pct = (total / limit) * 100;
      var fill = $("budgetFill");
      fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
      fill.classList.toggle("over", over);
      $("budgetFrom").textContent = money(0);
      $("budgetTo").textContent = money(limit);
      var left = limit - total;
      $("budgetText").textContent = left >= 0
        ? money(left) + " left · " + Math.round(pct) + "% of the monthly budget"
        : money(-left) + " over the monthly budget";
    }
    $("app").classList.toggle("month-over", over);
    $("monthFlag").textContent = "⚠️ Over the " + money(limit) + " monthly budget";
  }

  function renderCalendar() {
    var head = $("calHead");
    head.innerHTML = "";
    DAY_NAMES.forEach(function (n) {
      var c = document.createElement("div");
      c.className = "cal-head";
      c.textContent = n;
      head.appendChild(c);
    });

    var body = $("calBody");
    body.innerHTML = "";
    var todayKey = dateKey(today);
    var cursor = mondayOf(new Date(viewYear, viewMonth, 1));
    var lastDay = new Date(viewYear, viewMonth + 1, 0);

    while (cursor <= lastDay) {
      var row = document.createElement("div");
      row.className = "cal-row";
      var weekSum = 0, firstIn = null, lastIn = null;

      for (var i = 0; i < 7; i++) {
        var d = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i);
        var cell = document.createElement("div");
        if (!sameMonth(d, viewYear, viewMonth)) {
          cell.className = "cell blank";
        } else {
          var key = dateKey(d);
          var t = dayTotal(key);
          weekSum += t;
          if (firstIn === null) firstIn = d.getDate();
          lastIn = d.getDate();
          cell.className = "cell clickable" +
            (isDayOver(t) ? " over" : t !== 0 ? " spent" : "") +
            (key === todayKey ? " today" : "") +
            (key === selectedKey ? " selected" : "");
          cell.innerHTML =
            '<div class="dnum">' + d.getDate() + "</div>" +
            '<div class="amt' + (t === 0 ? " zero" : "") + '">' + (t === 0 ? "·" : compact(t)) + "</div>";
          cell.addEventListener("click", selectDay.bind(null, key));
        }
        row.appendChild(cell);
      }
      body.appendChild(row);

      var strip = document.createElement("div");
      strip.className = "week-strip" + (weekSum === 0 ? " empty" : "");
      var span = MONTH_NAMES[viewMonth].slice(0, 3) + " " + firstIn + (lastIn !== firstIn ? "–" + lastIn : "");
      strip.innerHTML =
        '<span class="w-label">Week of ' + span + "</span>" +
        '<span class="w-amt">' + money(weekSum) + "</span>";
      body.appendChild(strip);

      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
    }

    $("calFoot").textContent = "Tap any day to add or edit its expenses." +
      (dayLimit() > 0 ? " Days above " + money(dayLimit()) + " turn red." : "");
  }

  function renderDay() {
    var d = keyToDate(selectedKey);
    var label = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    if (selectedKey === dateKey(today)) label = "Today · " + label;
    $("dayDate").textContent = label;

    var dTotal = dayTotal(selectedKey);
    var totalEl = $("dayTotal");
    totalEl.textContent = money(dTotal);
    totalEl.style.color = isDayOver(dTotal) ? "var(--over)" : "";

    var area = $("entriesArea");
    var list = entriesFor(selectedKey);
    if (!list.length) {
      area.innerHTML = '<div class="entries-empty">Nothing logged for this day yet.</div>';
      return;
    }
    var wrap = document.createElement("div");
    wrap.className = "entries";
    list.forEach(function (e) {
      var row = document.createElement("div");
      row.className = "entry";
      var amt = document.createElement("div");
      amt.className = "e-amt";
      amt.textContent = money(e.cents);
      var note = document.createElement("div");
      note.className = "e-note";
      note.textContent = e.note || "";
      var del = document.createElement("button");
      del.className = "e-del";
      del.type = "button";
      del.textContent = "×";
      del.setAttribute("aria-label", "Delete expense");
      del.addEventListener("click", deleteEntry.bind(null, selectedKey, e.id));
      row.appendChild(amt);
      row.appendChild(note);
      row.appendChild(del);
      wrap.appendChild(row);
    });
    area.innerHTML = "";
    area.appendChild(wrap);
  }

  function historyMonths() {
    var keys = Object.keys(data.entries).filter(function (k) { return entriesFor(k).length; }).sort();
    var now = new Date();
    var startY = now.getFullYear(), startM = now.getMonth(), endY = startY, endM = startM;
    if (keys.length) {
      var f = keys[0].split("-"), l = keys[keys.length - 1].split("-");
      var fy = +f[0], fm = +f[1] - 1, ly = +l[0], lm = +l[1] - 1;
      if (fy * 12 + fm < startY * 12 + startM) { startY = fy; startM = fm; }
      if (ly * 12 + lm > endY * 12 + endM) { endY = ly; endM = lm; }
    }
    var out = [], y = startY, m = startM;
    while (y * 12 + m <= endY * 12 + endM) {
      out.push([y, m]);
      if (++m > 11) { m = 0; y++; }
    }
    return out.reverse();
  }

  function renderHistory() {
    var el = $("historyBody");
    var hasData = Object.keys(data.entries).some(function (k) { return entriesFor(k).length; });
    if (!hasData) {
      el.innerHTML = '<div class="hist-empty">Nothing logged yet — add an expense and your months will show up here.</div>';
      return;
    }

    var months = historyMonths();
    var limit = budgetLimit();
    var now = new Date();
    var curKey = now.getFullYear() * 12 + now.getMonth();
    var rows = "", totalSpent = 0, totalBudget = 0;

    months.forEach(function (ym) {
      var y = ym[0], m = ym[1];
      var spent = monthTotal(y, m);
      var isCurrent = y * 12 + m === curKey;
      totalSpent += spent;
      if (limit > 0) totalBudget += limit;

      var cells;
      if (limit > 0) {
        var over = spent > limit;
        var diff = Math.abs(limit - spent);
        cells =
          '<td class="val muted">' + money(limit) + "</td>" +
          '<td class="val ' + (over ? "bad" : "good") + '">' + money(spent) + "</td>" +
          '<td><span class="pill ' + (over ? "bad" : "good") + '">' +
            (over ? "+" + money(diff) + " over" : money(diff) + " left") + "</span></td>";
      } else {
        cells = '<td class="val muted">—</td><td class="val">' + money(spent) +
                '</td><td class="muted">no budget set</td>';
      }
      rows += '<tr class="' + (isCurrent ? "current" : "") + '" data-y="' + y + '" data-m="' + m + '">' +
        '<td class="m-name">' + MONTH_NAMES[m].slice(0, 3) + " " + y +
        (isCurrent ? "<small>this month</small>" : "") + "</td>" + cells + "</tr>";
    });

    var footer = limit > 0
      ? '<td class="muted">' + money(totalBudget) + "</td>" +
        '<td class="' + (totalSpent > totalBudget ? "bad" : "good") + '">' + money(totalSpent) + "</td><td></td>"
      : "<td></td><td>" + money(totalSpent) + "</td><td></td>";

    el.innerHTML =
      '<div class="hist-scroll"><table class="hist">' +
      "<thead><tr><th>Month</th><th>Budget</th><th>Spent</th><th>Result</th></tr></thead>" +
      "<tbody>" + rows + "</tbody>" +
      "<tfoot><tr><td>" + months.length + " month" + (months.length === 1 ? "" : "s") + "</td>" +
      footer + "</tr></tfoot></table></div>" +
      '<div class="hist-note">Tap a month to open it. Budget is your current monthly budget, so changing it re-scores every month.</div>';

    Array.prototype.forEach.call(el.querySelectorAll("tbody tr"), function (tr) {
      tr.addEventListener("click", function () {
        viewYear = +tr.getAttribute("data-y");
        viewMonth = +tr.getAttribute("data-m");
        showTab("tracker");
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function renderSettings() {
    var cur = $("currencyInput");
    if (document.activeElement !== cur) cur.value = currency();
    var bud = $("budgetInput");
    if (document.activeElement !== bud) bud.value = budgetLimit() > 0 ? (budgetLimit() / 100).toFixed(2) : "";
    var dl = $("dayLimitInput");
    if (document.activeElement !== dl) dl.value = dayLimit() > 0 ? (dayLimit() / 100).toFixed(2) : "";
    $("appVersion").textContent = APP_VERSION;
  }

  function showTab(tab) {
    ["tracker", "history", "settings"].forEach(function (t) {
      $(t + "View").hidden = t !== tab;
      $("tab" + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle("active", t === tab);
    });
  }

  // ---------------------------------------------------------------- actions
  function selectDay(key) {
    selectedKey = key;
    render();
    $("amountInput").focus();
  }
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function persist() { saveData(); render(); }

  function addEntry(cents, note) {
    if (!data.entries[selectedKey]) data.entries[selectedKey] = [];
    data.entries[selectedKey].push({ id: newId(), cents: cents, note: note });
    persist();
  }
  function deleteEntry(key, id) {
    var list = data.entries[key] || [];
    data.entries[key] = list.filter(function (e) { return e.id !== id; });
    if (!data.entries[key].length) delete data.entries[key];
    persist();
  }

  function wireEvents() {
    $("addForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var input = $("amountInput"), noteEl = $("noteInput"), err = $("formError");
      var cents = parseAmount(input.value);
      if (cents === null || cents === 0) {
        err.textContent = "Enter an amount, e.g. 12.50";
        return;
      }
      err.textContent = "";
      addEntry(cents, noteEl.value.trim());
      input.value = "";
      noteEl.value = "";
      input.focus();
    });

    $("tabTracker").addEventListener("click", function () { showTab("tracker"); });
    $("tabHistory").addEventListener("click", function () { renderHistory(); showTab("history"); });
    $("tabSettings").addEventListener("click", function () { renderSettings(); showTab("settings"); });

    $("prevMonth").addEventListener("click", function () {
      if (--viewMonth < 0) { viewMonth = 11; viewYear--; }
      render();
    });
    $("nextMonth").addEventListener("click", function () {
      if (++viewMonth > 11) { viewMonth = 0; viewYear++; }
      render();
    });

    $("currencyInput").addEventListener("input", function () {
      data.currency = this.value.trim() || null;
      saveData();
      render();
    });
    $("budgetInput").addEventListener("input", function () {
      var v = this.value.trim();
      data.budget = v === "" ? 0 : (parseAmount(v) || 0);
      saveData();
      renderSummary();
      renderHistory();
    });
    $("dayLimitInput").addEventListener("input", function () {
      var v = this.value.trim();
      data.dayLimit = v === "" ? 0 : (parseAmount(v) || 0);
      saveData();
      renderStreak();
      renderCalendar();
      renderDay();
    });

    $("resetAll").addEventListener("click", function () {
      if (confirm("Delete all spending data? This cannot be undone.")) {
        data = blank();
        Store.set(STORE_KEY, JSON.stringify(data));
        render();
      }
    });

    $("exportBtn").addEventListener("click", function () {
      var json = JSON.stringify(data, null, 2);
      if (Plugins.Share && isNative) {
        Plugins.Share.share({ title: "My spending data", text: json }).catch(function () {});
      } else {
        var blob = new Blob([json], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "budget-spending-streak.json";
        a.click();
        URL.revokeObjectURL(a.href);
      }
    });

    $("privacyBtn").addEventListener("click", function () { openUrl(PRIVACY_URL); });
    $("adPrefsBtn").addEventListener("click", function () { Ads.showPrivacyOptions(); });
  }

  function openUrl(url) {
    if (Plugins.Browser) Plugins.Browser.open({ url: url }).catch(function () { window.open(url, "_blank"); });
    else window.open(url, "_blank");
  }

  // ---------------------------------------------------------------- theme
  var THEMES = ["auto", "light", "dark"];
  var THEME_LABELS = { auto: "🖥️ Auto", light: "☀️ Light", dark: "🌙 Dark" };
  function currentTheme() {
    var t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    return THEMES.indexOf(t) === -1 ? "auto" : t;
  }
  function applyTheme(t) {
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var btn = $("themeToggle");
    btn.textContent = THEME_LABELS[t];
    btn.title = "Theme: " + t + " — tap to switch";
    if (Plugins.StatusBar && isNative) {
      var dark = t === "dark" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      Plugins.StatusBar.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(function () {});
    }
  }

  // ---------------------------------------------------------------- ads
  //
  // Ads only ever run inside the native app. On the web this whole module is
  // a no-op, so development in a browser is ad-free.
  //
  // The IDs below are Google's official *test* units. Replace them with your
  // own AdMob unit IDs before shipping — and never tap your own live ads,
  // that gets an AdMob account banned.
  var AD_UNITS = {
    android: "ca-app-pub-3940256099942544/6300978111", // test banner
    ios:     "ca-app-pub-3940256099942544/2934735716"  // test banner
  };
  var USE_TEST_ADS = true; // set false only once real unit IDs are in place

  var Ads = {
    plugin: function () { return Plugins.AdMob; },

    init: function () {
      var AdMob = this.plugin();
      if (!isNative || !AdMob) return Promise.resolve();

      return AdMob.initialize({ initializeForTesting: USE_TEST_ADS })
        .then(function () { return Ads.consent(); })
        .then(function () { return Ads.showBanner(); })
        .catch(function (e) {
          // An ad failing must never break the app the user came for.
          console.warn("Ads unavailable:", e && e.message);
        });
    },

    // Google's UMP consent flow. Required for users in the EEA/UK before any
    // personalised ad is requested.
    consent: function () {
      var AdMob = this.plugin();
      if (!AdMob || !AdMob.requestConsentInfo) return Promise.resolve();
      return AdMob.requestConsentInfo().then(function (info) {
        if (info && info.isConsentFormAvailable && info.status === "REQUIRED") {
          return AdMob.showConsentForm();
        }
      }).catch(function (e) { console.warn("Consent flow skipped:", e && e.message); });
    },

    showBanner: function () {
      var AdMob = this.plugin();
      if (!AdMob) return Promise.resolve();
      var adId = AD_UNITS[platform] || AD_UNITS.android;
      return AdMob.showBanner({
        adId: adId,
        adSize: "ADAPTIVE_BANNER",
        position: "BOTTOM_CENTER",
        margin: 0,
        isTesting: USE_TEST_ADS
      }).then(function () {
        // Reserve space so the banner never covers the Add button.
        document.documentElement.style.setProperty("--ad-space", "60px");
      });
    },

    showPrivacyOptions: function () {
      var AdMob = this.plugin();
      if (!isNative || !AdMob) {
        alert("Ad settings are only available in the installed app.");
        return;
      }
      if (AdMob.showPrivacyOptionsForm) {
        AdMob.showPrivacyOptionsForm().catch(function () {
          alert("No ad privacy options are available right now.");
        });
      } else if (AdMob.showConsentForm) {
        AdMob.showConsentForm().catch(function () {});
      }
    }
  };

  // ---------------------------------------------------------------- start
  function start() {
    wireEvents();
    applyTheme(currentTheme());
    $("themeToggle").addEventListener("click", function () {
      applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);
    });
    $("footNote").textContent = isNative ? "" : "Preview in browser — ads run in the installed app only.";

    loadData().then(function () {
      render();
      Ads.init();
    });

    // Coming back from the background on a new day should refresh "today".
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      var now = new Date();
      if (dateKey(now) !== dateKey(today)) {
        today = now;
        selectedKey = dateKey(now);
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
      }
      render();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  // Exposed for the test harness.
  window.__app = {
    parseAmount: parseAmount,
    computeStreak: computeStreak,
    getData: function () { return data; },
    setData: function (d) { data = normalise(d); render(); }
  };
})();
