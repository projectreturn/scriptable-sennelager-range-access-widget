// Sennelager Range Access widget for Scriptable
// A tap on the widget opens an in-app overview instead of the source website.

const SOURCE_URL = "https://bfgnet.de/sennelager-range-access"
const COLORS = {
  background: "000000",
  card: "161618",
  text: "F5F5F7",
  muted: "98989F",
  accent: "5EB4FF",
  warning: "FFAD45"
}
const rows = await loadRangeAccess()
const listView = !config.runsInWidget && typeof args !== "undefined" &&
  args.queryParameters && args.queryParameters.view === "list"

if (listView) {
  await presentOverview(rows)
} else {
  const widget = createWidget(rows)
  widget.url = listViewURL()
  Script.setWidget(widget)

  // Beim Start in Scriptable wird nur die Widget-Vorschau angezeigt.
  if (!config.runsInWidget) {
    if (config.widgetFamily === "small") await widget.presentSmall()
    else if (config.widgetFamily === "large") await widget.presentLarge()
    else await widget.presentMedium()
  }
}

Script.complete()

function listViewURL() {
  const scriptURL = URLScheme.forRunningScript()
  return scriptURL + (scriptURL.includes("?") ? "&" : "?") + "view=list"
}

async function loadRangeAccess() {
  // Der Abruf entspricht dem Original-Widget: Die BFGnet-Seite wird in einer
  // WebView geladen und die Tabellenzellen werden direkt aus dem Artikel gelesen.
  const webView = new WebView()

  try {
    await webView.loadURL(SOURCE_URL)
    const extractedRows = await webView.evaluateJavaScript(`
      let data = [];
      let rows = [...document.querySelectorAll('.com-content-article__body tr')];
      for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        let rowData = [...row.querySelectorAll('td')].map(cell => cell.innerText).slice(1);
        if (rowData.length >= 2) data.push(rowData);
      }
      data;
    `)

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    return extractedRows
      .map(row => ({
        date: String(row[0]).trim(),
        status: row.slice(1).join(" · ").trim(),
        parsedDate: parseSourceDate(String(row[0]).trim())
      }))
      .filter(row => row.parsedDate && row.parsedDate >= startOfToday)
      .sort((a, b) => a.parsedDate - b.parsedDate)
  } catch (error) {
    console.error(`Range data could not be loaded: ${error}`)
    return []
  }
}

function parseSourceDate(value) {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(value)
  if (!match) return null

  const months = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  }
  const month = months[match[2]]
  if (month === undefined) return null

  let year = Number(match[3])
  if (year < 100) year += 2000
  return new Date(year, month, Number(match[1]))
}

function createWidget(allRows) {
  const widget = new ListWidget()
  widget.setPadding(0, 8, 8, 5)
  widget.refreshAfterDate = new Date(Date.now() + 30 * 60000)

  const title = widget.addText("Sennelager Range Access\n")
  title.font = Font.boldSystemFont(10)
  title.centerAlignText()
  title.textColor = Color.gray()

  if (allRows.length === 0) {
    const message = widget.addText("Keine aktuellen Daten verfügbar")
    message.font = Font.semiboldSystemFont(14)
    message.centerAlignText()
    message.textColor = Color.orange()
    return widget
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const visibleRows = allRows.filter(row =>
    sameDay(row.parsedDate, today) || sameDay(row.parsedDate, tomorrow))

  visibleRows.forEach(row => {
    addOriginalWidgetText(widget, getRelativeDate(row.parsedDate))
    addOriginalWidgetText(widget, row.status)
    widget.addSpacer(10)
  })
  return widget
}

function addOriginalWidgetText(widget, value) {
  const text = widget.addText(value)
  text.centerAlignText()

  let fontSize = 16
  if (value.length > 20) fontSize = 14
  if (value.length > 30) fontSize = 12
  text.font = Font.semiboldSystemFont(fontSize)
  text.textColor = statusColor(value)
}

async function presentOverview(allRows) {
  const detailView = new WebView()
  await detailView.loadHTML(buildOverviewHTML(allRows))
  await detailView.present(true)
}

function buildOverviewHTML(allRows) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const firstMonday = startOfWeek(today)
  const rowsByDate = {}
  allRows.forEach(row => { rowsByDate[dateKey(row.parsedDate)] = row })

  const weeks = []
  for (let weekIndex = 0; weekIndex < 5; weekIndex++) {
    const monday = new Date(firstMonday)
    monday.setDate(monday.getDate() + weekIndex * 7)
    const days = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const date = new Date(monday)
      date.setDate(date.getDate() + dayIndex)
      days.push(date)
    }
    weeks.push({ number: isoWeek(monday), days })
  }

  const weekdayHeaders = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
    .map(day => `<th>${day}</th>`).join("")

  const calendarRows = weeks.map((week, weekIndex) => {
    const days = week.days.map(date => {
      const row = rowsByDate[dateKey(date)]
      const color = row ? statusHex(row.status) : "transparent"
      const classes = ["day"]
      if (date < today) classes.push("past")
      if (sameDay(date, today)) classes.push("today")
      const weekday = date.getDay()
      if (weekday === 0 || weekday === 6) classes.push("weekend")
      if (row) classes.push("has-data")
      const target = row ? ` data-target="entry-${dateKey(date)}"` : ""
      return `<td class="${classes.join(" ")}"${target}><span style="border-bottom-color:${color}">${date.getDate()}</span></td>`
    }).join("")

    return `<tr><th class="kw${weekIndex === 0 ? " current-kw" : ""}">${String(week.number).padStart(2, "0")}</th>${days}</tr>`
  }).join("")

  const calendar = `<table class="calendar">
    <thead><tr><th>KW</th>${weekdayHeaders}</tr></thead>
    <tbody>${calendarRows}</tbody>
  </table>`

  const listRows = allRows.map(row => `<div class="list-row" id="entry-${dateKey(row.parsedDate)}">
    <div class="list-day">${escapeHTML(formatDate(row.parsedDate, "EEE"))}</div>
    <div class="list-date">${escapeHTML(formatDate(row.parsedDate, "dd.MM.yyyy"))}</div>
    <div class="list-value"><span class="dot" style="background:${statusHex(row.status)}"></span>${escapeHTML(row.status)}</div>
  </div>`)

  return `<!doctype html>
  <html lang="de">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
      <style>
        :root { color-scheme: dark; --bg:#000000; --panel:#161618; --text:#f5f5f7; --muted:#98989f; }
        * { box-sizing:border-box; }
        html,body { height:100%; overflow:hidden; }
        body { margin:0; color:var(--text); background:var(--bg);
          font-family:-apple-system, BlinkMacSystemFont, sans-serif; }
        .page { height:100%; display:flex; flex-direction:column; overflow:hidden; }
        .fixed { flex:0 0 auto; padding:calc(env(safe-area-inset-top) + 14px) 12px 0; background:var(--bg); }
        header { padding:0 4px 10px; }
        h1 { margin:0; font-size:20px; }
        .calendar { width:100%; max-width:390px; margin:0 auto; table-layout:fixed; border-collapse:separate;
          border-spacing:3px; padding:7px; border-radius:11px; background:var(--panel); text-align:center; }
        .calendar th { height:18px; color:var(--muted); font-size:10px; font-weight:600; }
        .calendar th,.calendar td { width:12.5%; padding:0; }
        .calendar tbody th { height:29px; }
        .calendar td { height:29px; color:#fff; font-size:11px; font-weight:650; }
        .calendar td span { display:inline-block; min-width:16px; padding-bottom:3px; border-bottom:3px solid transparent; }
        .calendar .kw { background:transparent; color:var(--muted); font-size:11px; font-weight:600; }
        .calendar .current-kw { color:var(--text); font-weight:800; }
        .calendar .today { color:#fff; font-weight:800; border-radius:6px;
          outline:2px solid #5eb4ff; outline-offset:-2px; }
        .calendar .past { opacity:.3; }
        .calendar .weekend { color:#d1d1d6; }
        .calendar .has-data { cursor:pointer; }
        .legend { display:flex; flex-wrap:wrap; justify-content:center; gap:10px; padding:8px 3px 7px;
          color:var(--muted); font-size:10px; }
        .legend span { display:flex; align-items:center; gap:5px; }
        .legend i,.dot { width:8px; height:8px; flex:0 0 8px; border-radius:50%; }
        .source { display:block; max-width:390px; margin:0 auto 9px; padding:8px 11px; border-radius:9px;
          color:#5eb4ff; background:var(--panel); font-size:12px; font-weight:600; text-decoration:none; }
        .list-section { min-height:0; flex:1; display:flex; flex-direction:column; padding:0 12px; }
        h2 { flex:0 0 auto; margin:2px 3px 8px; font-size:17px; }
        .list-scroll { min-height:0; flex:1; overflow-y:auto; padding-bottom:calc(env(safe-area-inset-bottom) + 20px);
          -webkit-overflow-scrolling:touch; }
        .list { overflow:hidden; }
        .list-head,.list-row { display:grid; grid-template-columns:42px 83px minmax(0,1fr); gap:7px; padding:10px 12px; }
        .list-head { color:var(--muted); font-size:10px; font-weight:700; text-transform:uppercase; }
        .list-row { align-items:start; font-size:12px; }
        .list-row.selected { background:#2c2c2e; }
        .list-day { color:var(--text); font-weight:650; }
        .list-date { color:var(--muted); }
        .list-value { display:flex; align-items:flex-start; gap:7px; line-height:1.3; }
        .list-value .dot { margin-top:3px; }
        @media (min-width:700px) { .fixed,.list-section { width:760px; margin-left:auto; margin-right:auto; } }
      </style>
    </head>
    <body><div class="page">
      <div class="fixed">
        <header>
          <h1>Sennelager Range Access</h1>
        </header>
        ${calendar}
        <div class="legend">
          <span><i style="background:#30d158"></i>Offen</span>
          <span><i style="background:#ff9f0a"></i>Zeitlich begrenzt</span>
          <span><i style="background:#ff453a"></i>Geschlossen</span>
          <span><i style="background:#636366"></i>Keine Daten</span>
        </div>
        <a class="source" href="${SOURCE_URL}">Offizielle Website öffnen&nbsp;&nbsp;›</a>
      </div>
      <section class="list-section">
        <h2>Übersicht</h2>
        <div class="list-scroll">
          <div class="list">
            <div class="list-head"><div>Tag</div><div>Datum</div><div>Wert</div></div>
            ${listRows.length ? listRows.join("") : '<div class="list-row"><div>–</div><div>–</div><div>Keine Einträge gefunden</div></div>'}
          </div>
        </div>
      </section>
    </div>
    <script>
      const listScroller = document.querySelector('.list-scroll');
      document.querySelectorAll('.calendar td[data-target]').forEach(cell => {
        cell.addEventListener('click', () => {
          const target = document.getElementById(cell.dataset.target);
          if (!target || !listScroller) return;
          const top = target.getBoundingClientRect().top - listScroller.getBoundingClientRect().top + listScroller.scrollTop;
          listScroller.scrollTo({ top, behavior: 'smooth' });
          document.querySelectorAll('.list-row.selected').forEach(row => row.classList.remove('selected'));
          target.classList.add('selected');
          setTimeout(() => target.classList.remove('selected'), 1400);
        });
      });
    </script>
    </body>
  </html>`
}

function startOfWeek(date) {
  const result = new Date(date)
  const day = result.getDay() || 7
  result.setDate(result.getDate() - day + 1)
  result.setHours(0, 0, 0, 0)
  return result
}

function isoWeek(date) {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7))
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  return 1 + Math.round(((target - firstThursday) / 86400000 - 3 +
    ((firstThursday.getDay() + 6) % 7)) / 7)
}

function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function sameDay(first, second) {
  return first && second && dateKey(first) === dateKey(second)
}

function formatDate(date, format) {
  const formatter = new DateFormatter()
  formatter.locale = "de_DE"
  formatter.dateFormat = format
  return formatter.string(date)
}

function getRelativeDate(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const difference = Math.round((date - today) / 86400000)
  if (difference === 0) return "Heute"
  if (difference === 1) return "Morgen"
  return formatDate(date, "dd.MM.")
}

function shortStatus(value) {
  return value
    .replace(/Transit Roads/gi, "Transitstraßen")
    .replace(/\s*\(Amended.*$/i, " – geändert")
}

function statusHex(value) {
  const normalized = value.toLowerCase()
  if (normalized.includes("from") || normalized.includes("until") || normalized.includes("between")) {
    return "#ff9f0a"
  }
  if (normalized.includes("closed")) return "#ff453a"
  if (normalized.includes("open")) return "#30d158"
  return "#636366"
}

function statusColor(value) {
  const normalized = value.toLowerCase()
  if (normalized.includes("from") || normalized.includes("until") || normalized.includes("between")) {
    return Color.orange()
  }
  if (normalized.includes("closed")) return Color.red()
  if (normalized.includes("open")) return Color.green()
  return Color.white()
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
