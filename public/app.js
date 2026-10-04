// FX Advisor — フロントエンド
const $ = (id) => document.getElementById(id);
const api = async (path, opts) => {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

const state = { series: [], points: [], history: [], aiEnabled: true };

// ---------- 数値フォーマット ----------
function fmtPrice(v) {
  if (v == null) return "—";
  return v >= 10 ? v.toFixed(3) : v.toFixed(5);
}
function fmtNum(v, d = 2) {
  return v == null ? "—" : v.toFixed(d);
}

// ---------- トースト ----------
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

// ---------- 分析 ----------
async function runAnalysis() {
  const pair = $("pair").value.trim() || "USD/JPY";
  const days = Math.max(35, Math.min(365, parseInt($("days").value, 10) || 120));
  const btn = $("analyze");
  btn.disabled = true;
  btn.textContent = "分析中…";
  try {
    const [analysis, seriesRes] = await Promise.all([
      api(`/api/analysis/${encodeURIComponent(pair)}?days=${days}`),
      api(`/api/rates/${encodeURIComponent(pair)}/series?days=${days}`),
    ]);
    renderSummary(analysis);
    renderIndicators(analysis);
    state.series = seriesRes.series;
    renderChart();
    $("chartTitle").textContent = `${analysis.pair} 価格チャート`;
    $("chartRange").textContent = `${seriesRes.series[0]?.date} 〜 ${seriesRes.series.at(-1)?.date}`;
  } catch (err) {
    toast(`分析に失敗しました: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "分析";
  }
}

function renderSummary(a) {
  $("sumPair").textContent = a.pair;
  $("sumPrice").textContent = fmtPrice(a.latestClose);
  $("sumMeta").textContent = `as of ${a.asOf}`;

  const dir = a.signal.direction;
  const label = { buy: "買い", sell: "売り", neutral: "中立" }[dir];
  const badge = $("signalBadge");
  badge.dataset.dir = dir;
  $("signalLabel").textContent = `シグナル: ${label}`;
  $("signalScore").textContent = `スコア ${a.signal.score > 0 ? "+" : ""}${a.signal.score}`;

  // メーター: -100..100 を 0..100% に。中央から伸ばす。
  const score = a.signal.score;
  const fill = $("meterFill");
  const color = dir === "buy" ? "var(--buy)" : dir === "sell" ? "var(--sell)" : "var(--neutral)";
  const half = Math.abs(score) / 2; // 0..50 (%)
  fill.style.background = color;
  if (score >= 0) {
    fill.style.left = "50%";
    fill.style.right = "auto";
    fill.style.width = half + "%";
  } else {
    fill.style.right = "50%";
    fill.style.left = "auto";
    fill.style.width = half + "%";
  }
}

function renderIndicators(a) {
  const i = a.indicators;
  $("tSma").textContent = fmtPrice(i.sma.value);
  $("tEma").textContent = fmtPrice(i.ema.value);
  $("tRsi").textContent = fmtNum(i.rsi.value, 1);
  $("tMacd").textContent = i.macd.histogram == null ? "—" : i.macd.histogram.toFixed(4);

  const ul = $("reasons");
  ul.innerHTML = "";
  for (const r of a.signal.reasons) {
    const li = document.createElement("li");
    li.textContent = r;
    ul.appendChild(li);
  }
}

// ---------- チャート（自己完結 SVG） ----------
function renderChart() {
  const svg = $("chart");
  const wrap = $("chartWrap");
  const data = state.series;
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  if (!data.length || W === 0) return;

  const padL = 10, padR = 52, padT = 14, padB = 22;
  const closes = data.map((d) => d.close);
  let min = Math.min(...closes), max = Math.max(...closes);
  const span = max - min || max * 0.01 || 1;
  min -= span * 0.08;
  max += span * 0.08;

  const n = data.length;
  const x = (i) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1);
  const y = (v) => padT + ((max - v) * (H - padT - padB)) / (max - min);

  state.points = data.map((d, i) => ({ x: x(i), y: y(d.close), date: d.date, close: d.close }));

  // グリッド + 右側ラベル（控えめ）
  const gridLines = 4;
  let grid = "";
  for (let g = 0; g <= gridLines; g++) {
    const val = max - ((max - min) * g) / gridLines;
    const gy = y(val);
    grid += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${gy.toFixed(1)}" class="grid" />`;
    grid += `<text x="${(W - padR + 6).toFixed(1)}" y="${(gy + 3.5).toFixed(1)}" class="axis">${fmtPrice(val)}</text>`;
  }

  const linePath = state.points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath =
    `M${state.points[0].x.toFixed(1)},${(H - padB).toFixed(1)} ` +
    state.points.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` L${state.points.at(-1).x.toFixed(1)},${(H - padB).toFixed(1)} Z`;

  const up = closes.at(-1) >= closes[0];
  const lineColor = up ? "var(--buy)" : "var(--sell)";

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.innerHTML = `
    <defs>
      <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.18" />
        <stop offset="100%" stop-color="${lineColor}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <style>
      .grid { stroke: var(--border); stroke-width: 1; }
      .axis { fill: var(--muted); font-size: 10px; font-family: var(--font); }
      .price-line { fill: none; stroke: ${lineColor}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
      .cross-line { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; }
      .cross-dot { fill: ${lineColor}; stroke: var(--surface); stroke-width: 2; }
    </style>
    ${grid}
    <path d="${areaPath}" fill="url(#area)" />
    <path d="${linePath}" class="price-line" />
    <g id="crosshair" style="display:none">
      <line class="cross-line" id="crossLine" y1="${padT}" y2="${H - padB}" />
      <circle class="cross-dot" id="crossDot" r="4.5" />
    </g>
  `;
}

// クロスヘア + ツールチップ
function setupChartHover() {
  const wrap = $("chartWrap");
  const tip = $("chartTip");
  wrap.addEventListener("pointermove", (e) => {
    if (!state.points.length) return;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    // 最近傍の点を探す
    let nearest = state.points[0], best = Infinity;
    for (const p of state.points) {
      const d = Math.abs(p.x - mx);
      if (d < best) { best = d; nearest = p; }
    }
    const ch = $("crosshair");
    if (ch) {
      ch.style.display = "";
      $("crossLine").setAttribute("x1", nearest.x);
      $("crossLine").setAttribute("x2", nearest.x);
      $("crossDot").setAttribute("cx", nearest.x);
      $("crossDot").setAttribute("cy", nearest.y);
    }
    tip.hidden = false;
    tip.innerHTML = `<div>${fmtPrice(nearest.close)}</div><div class="tt-date">${nearest.date}</div>`;
    tip.style.left = nearest.x + "px";
    tip.style.top = nearest.y + "px";
  });
  wrap.addEventListener("pointerleave", () => {
    tip.hidden = true;
    const ch = $("crosshair");
    if (ch) ch.style.display = "none";
  });
}

// ---------- カレンダー ----------
async function loadCalendar() {
  const ul = $("events");
  const now = new Date();
  const to = new Date(now.getTime() + 30 * 864e5);
  const iso = (d) => d.toISOString().slice(0, 10);
  try {
    const res = await api(`/api/calendar?from=${iso(now)}&to=${iso(to)}`);
    const threshold = $("calImportance").value;
    const rank = { low: 0, medium: 1, high: 2 };
    let events = res.events;
    if (threshold) events = events.filter((e) => rank[e.importance] >= rank[threshold]);

    ul.innerHTML = "";
    if (!events.length) { ul.innerHTML = `<li class="muted">該当するイベントはありません。</li>`; return; }
    const impLabel = { high: "高", medium: "中", low: "低" };
    for (const e of events) {
      const dt = new Date(e.datetime);
      const d = dt.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      const li = document.createElement("li");
      li.className = "event";
      li.innerHTML = `
        <span class="event-date">${d}</span>
        <span class="event-title">${escapeHtml(e.country)} ${escapeHtml(e.title)}</span>
        <span class="imp" data-imp="${e.importance}">${impLabel[e.importance]}</span>`;
      ul.appendChild(li);
    }
  } catch (err) {
    ul.innerHTML = `<li class="muted">カレンダーの取得に失敗しました: ${escapeHtml(err.message)}</li>`;
  }
}

// ---------- AI チャット ----------
function addMsg(role, text) {
  const log = $("chatLog");
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

async function sendChat(e) {
  e.preventDefault();
  const ta = $("chatText");
  const q = ta.value.trim();
  if (!q) return;
  addMsg("user", q);
  state.history.push({ role: "user", content: q });
  ta.value = "";

  const send = $("chatSend");
  send.disabled = true;
  const typing = addMsg("assistant", "");
  typing.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;

  try {
    const body = { question: q, history: state.history.slice(0, -1) };
    if ($("attachAnalysis").checked) body.pair = $("pair").value.trim();
    const res = await api("/api/advice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    typing.className = "chat-msg assistant";
    typing.textContent = res.answer;
    state.history.push({ role: "assistant", content: res.answer });
    if (state.history.length > 20) state.history = state.history.slice(-20);
  } catch (err) {
    typing.className = "chat-msg error";
    typing.textContent = `エラー: ${err.message}`;
  } finally {
    send.disabled = false;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- 初期化 ----------
async function init() {
  setupChartHover();
  $("analyze").addEventListener("click", runAnalysis);
  $("pair").addEventListener("keydown", (e) => { if (e.key === "Enter") runAnalysis(); });
  $("days").addEventListener("keydown", (e) => { if (e.key === "Enter") runAnalysis(); });
  $("calImportance").addEventListener("change", loadCalendar);
  $("chatForm").addEventListener("submit", sendChat);
  $("chatText").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendChat(e);
  });
  window.addEventListener("resize", () => renderChart());

  // AI 利用可否
  try {
    const h = await api("/api/health");
    state.aiEnabled = h.features.aiAdvisor;
    if (!state.aiEnabled) {
      $("chatHint").textContent = "※ AI 相談を使うにはサーバーに ANTHROPIC_API_KEY を設定してください。";
    }
    if (h.features.ratesProvider === "mock") {
      toast("レートは mock(デモ用) です。実レートは RATES_PROVIDER=frankfurter で。");
    }
  } catch { /* ignore */ }

  await Promise.all([runAnalysis(), loadCalendar()]);
}

init();
