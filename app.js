/* Sổ Thu Chi 6 Lọ — vanilla JS, dữ liệu lưu trên máy (localStorage). */
'use strict';

const KEY = 'sothuchi.v1';

const DEFAULT_JARS = [
  { id: 'nec',  short: 'NEC',  name: 'Thiết yếu',        emoji: '🏠', pct: 55, desc: 'Ăn uống, nhà, đi lại, hoá đơn' },
  { id: 'ffa',  short: 'FFA',  name: 'Tự do tài chính',  emoji: '💰', pct: 10, desc: 'Đầu tư sinh lời — không tiêu' },
  { id: 'edu',  short: 'EDU',  name: 'Giáo dục',         emoji: '📚', pct: 10, desc: 'Sách, khoá học, phát triển bản thân' },
  { id: 'ltss', short: 'LTSS', name: 'Tiết kiệm dài hạn', emoji: '🏦', pct: 10, desc: 'Mục tiêu lớn, quỹ dự phòng' },
  { id: 'play', short: 'PLAY', name: 'Hưởng thụ',        emoji: '🎉', pct: 10, desc: 'Vui chơi, tự thưởng — tiêu hết mỗi tháng' },
  { id: 'give', short: 'GIVE', name: 'Cho đi',           emoji: '❤️', pct: 5,  desc: 'Từ thiện, quà tặng, giúp đỡ' },
];
const PROTECTED = new Set(['ffa', 'ltss']); // lọ không nên tiêu

/* ---------------- Storage ---------------- */
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.tx)) {
      d.jars = DEFAULT_JARS.map(j => ({ ...j, pct: (d.jars || []).find(x => x.id === j.id)?.pct ?? j.pct }));
      return d;
    }
  } catch (e) { /* bỏ qua dữ liệu hỏng */ }
  return { jars: DEFAULT_JARS.map(j => ({ ...j })), tx: [], theme: 'auto', lastBackup: null };
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Không lưu được — bộ nhớ trình duyệt bị chặn?'); }
}

/* ---------------- Helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nf = new Intl.NumberFormat('vi-VN');
const money = n => nf.format(Math.round(n)) + 'đ';
function short(n) {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e9) return s + trim(a / 1e9) + ' tỷ';
  if (a >= 1e6) return s + trim(a / 1e6) + 'tr';
  if (a >= 1e3) return s + trim(a / 1e3) + 'k';
  return s + a;
}
const trim = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const ym = s => s.slice(0, 7);
const jarById = id => db.jars.find(j => j.id === id);
const jarColor = id => `var(--j-${id})`;
function monthLabel(key) { const [y, m] = key.split('-'); return `Tháng ${+m}/${y}`; }
function shiftMonth(key, d) { const [y, m] = key.split('-').map(Number); const t = new Date(y, m - 1 + d, 1); return ymd(t).slice(0, 7); }
function dayLabel(s) {
  const t = today(), y = ymd(new Date(Date.now() - 864e5));
  if (s === t) return 'Hôm nay';
  if (s === y) return 'Hôm qua';
  const d = new Date(s + 'T00:00');
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()] + ', ' + d.getDate() + '/' + (d.getMonth() + 1);
}

/* ---------------- Domain ---------------- */
function splitIncome(amount) {
  const out = {}; let used = 0;
  for (const j of db.jars) { out[j.id] = Math.floor(amount * j.pct / 100); used += out[j.id]; }
  out.nec += amount - used; // phần lẻ vào lọ Thiết yếu
  return out;
}
function delta(t, id) {
  if (t.type === 'out') return t.jar === id ? -t.amount : 0;
  if (t.type === 'in') return t.split?.[id] || 0;
  if (t.type === 'move') return (t.to === id ? t.amount : 0) - (t.from === id ? t.amount : 0);
  return 0;
}
function balances(untilMonth) {
  const b = Object.fromEntries(db.jars.map(j => [j.id, 0]));
  for (const t of db.tx) if (!untilMonth || ym(t.date) <= untilMonth) for (const j of db.jars) b[j.id] += delta(t, j.id);
  return b;
}
function monthStats(key) {
  const s = { income: 0, expense: 0, jars: {} };
  for (const j of db.jars) s.jars[j.id] = { inflow: 0, spent: 0 };
  for (const t of db.tx) {
    if (ym(t.date) !== key) continue;
    if (t.type === 'in') { s.income += t.amount; for (const id in t.split) s.jars[id] && (s.jars[id].inflow += t.split[id]); }
    if (t.type === 'out') { s.expense += t.amount; s.jars[t.jar] && (s.jars[t.jar].spent += t.amount); }
    if (t.type === 'move') { s.jars[t.to] && (s.jars[t.to].inflow += t.amount); s.jars[t.from] && (s.jars[t.from].inflow -= t.amount); }
  }
  return s;
}
function streak() {
  const days = new Set(db.tx.map(t => t.date).concat(db.tx.map(t => t.created && ymd(new Date(t.created)))));
  let d = new Date(), n = 0;
  if (!days.has(ymd(d))) d.setDate(d.getDate() - 1);
  while (days.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
/* Giao dịch hay dùng → nút ghi 1 chạm */
function frequent(limit = 10) {
  const m = new Map(), now = Date.now();
  for (const t of db.tx) {
    if (t.type !== 'out' || !t.note) continue;
    const k = t.note.trim().toLowerCase() + '|' + t.jar + '|' + t.amount;
    const age = (now - (t.created || now)) / 864e5;
    const e = m.get(k) || { note: t.note.trim(), jar: t.jar, amount: t.amount, score: 0 };
    e.score += 1 / (1 + age / 14);
    m.set(k, e);
  }
  return [...m.values()].filter(e => e.score > 0.6).sort((a, b) => b.score - a.score).slice(0, limit);
}
/* Ghi chú đã dùng: note → {jar hay dùng, số tiền gần nhất} */
function noteIndex(type) {
  const m = new Map();
  for (const t of [...db.tx].sort((a, b) => (a.created || 0) - (b.created || 0))) {
    if (t.type !== type || !t.note) continue;
    const k = t.note.trim().toLowerCase();
    const e = m.get(k) || { note: t.note.trim(), jars: {}, count: 0, last: 0, amount: 0 };
    e.count++; e.last = t.created || 0; e.amount = t.amount;
    if (t.jar) e.jars[t.jar] = (e.jars[t.jar] || 0) + 1;
    m.set(k, e);
  }
  for (const e of m.values()) e.jar = Object.entries(e.jars).sort((a, b) => b[1] - a[1])[0]?.[0];
  return m;
}
function addTx(t) {
  t.id = t.id || uid(); t.created = t.created || Date.now();
  db.tx.push(t); save(); renderAll();
  return t;
}

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg, action, fn) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button>${esc(action)}</button>` : '');
  el.hidden = false;
  if (action) $('button', el).onclick = () => { el.hidden = true; fn(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), action ? 5000 : 2500);
}
function undoableAdd(t, msg) {
  const added = addTx(t);
  toast(msg, 'Hoàn tác', () => { db.tx = db.tx.filter(x => x.id !== added.id); save(); renderAll(); });
}

/* ---------------- Jar SVG ---------------- */
function jarSVG(id, fill) {
  const f = Math.max(0, Math.min(1, fill));
  const top = 22, bottom = 70, y = bottom - (bottom - top) * f;
  const c = jarColor(id), cid = 'clip-' + id;
  return `<svg viewBox="0 0 64 76" aria-hidden="true">
    <defs><clipPath id="${cid}"><path d="M18 14h28v6c8 4 12 10 12 18v28a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V38c0-8 4-14 12-18z"/></clipPath></defs>
    <g clip-path="url(#${cid})">
      <rect x="0" y="0" width="64" height="76" fill="var(--surface-2)"/>
      ${f > 0 ? `<g class="wave"><path d="M-10 ${y} q 9 -4 18 0 t 18 0 t 18 0 t 18 0 t 18 0 V 80 H -10 z" fill="${c}"/></g>
      <rect x="0" y="${y + 3}" width="64" height="80" fill="${c}"/>` : ''}
    </g>
    <path d="M18 14h28v6c8 4 12 10 12 18v28a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V38c0-8 4-14 12-18z" fill="none" stroke="${c}" stroke-width="2"/>
    <rect x="15" y="8" width="34" height="7" rx="3" fill="${c}"/>
  </svg>`;
}

/* ---------------- Views ---------------- */
let view = 'home';
const histState = { month: today().slice(0, 7), jar: 'all', q: '' };
let statsMonth = today().slice(0, 7);

function renderHome() {
  const key = today().slice(0, 7), bal = balances(), ms = monthStats(key);
  const total = Object.values(bal).reduce((a, b) => a + b, 0);
  const st = streak(), loggedToday = db.tx.some(t => t.date === today());
  const freq = frequent();
  const hour = new Date().getHours();
  const hi = hour < 11 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  let nudge = '';
  if (!db.tx.length) {
    nudge = `<div class="nudge"><b>👋 Bắt đầu thôi!</b>Bấm <b style="display:inline">＋</b> → chọn <b style="display:inline">Thu nhập</b> và nhập lương tháng này. App sẽ tự chia vào 6 lọ.</div>`;
  } else if (!loggedToday) {
    nudge = `<div class="nudge"><b>${st ? `🔥 Giữ chuỗi ${st} ngày nhé!` : '✍️ Hôm nay chưa ghi gì'}</b>Chạm một nút bên dưới hoặc bấm vào lọ để ghi nhanh — mất 3 giây.</div>`;
  } else if (db.tx.length >= 20 && (!db.lastBackup || Date.now() - db.lastBackup > 30 * 864e5)) {
    nudge = `<div class="nudge"><b>💾 Đã lâu chưa sao lưu</b>Dữ liệu chỉ nằm trên máy này. <a href="#" data-go="settings">Sao lưu ngay</a></div>`;
  }

  const seg = db.jars.map(j => bal[j.id] > 0 ? `<i style="flex:${bal[j.id]};background:${jarColor(j.id)}" title="${esc(j.name)}"></i>` : '').join('');

  $('#view-home').innerHTML = `
    <div class="top">
      <div><div class="muted" style="font-size:13px">${hi}</div><h1>Sổ 6 Lọ</h1></div>
      <span class="streak" title="Số ngày liên tiếp có ghi chép">🔥 ${st} ngày</span>
    </div>
    <div class="card summary">
      <div class="label">Tổng tiền trong các lọ</div>
      <div class="big num ${total < 0 ? 'neg' : ''}">${money(total)}</div>
      <div class="row">
        <div><span class="label">Thu ${monthLabel(key).toLowerCase()}</span><b class="num pos">+${short(ms.income)}</b></div>
        <div><span class="label">Chi ${monthLabel(key).toLowerCase()}</span><b class="num neg">−${short(ms.expense)}</b></div>
      </div>
      ${total > 0 ? `<div class="bar-split" aria-hidden="true">${seg}</div>` : ''}
    </div>
    ${nudge}
    ${freq.length ? `<h2>⚡ Ghi nhanh 1 chạm</h2><div class="quick">${freq.map((f, i) => `
      <button class="qbtn" data-q="${i}" style="--c:${jarColor(f.jar)}"><span class="n">${esc(f.note)}</span><span class="a num">${short(f.amount)} · ${jarById(f.jar)?.short}</span></button>`).join('')}</div>` : ''}
    <h2>Các lọ của bạn <span class="muted" style="font-weight:400">— chạm để ghi chi</span></h2>
    <div class="jars">${db.jars.map(j => {
      const b = bal[j.id], spent = ms.jars[j.id].spent;
      const fill = b <= 0 ? 0 : spent > 0 ? b / (b + spent) : 1;
      const cls = b < 0 || (b === 0 && db.tx.length) ? 'empty' : fill < 0.2 ? 'low' : '';
      return `<button class="jar ${cls}" data-jar="${j.id}" aria-label="${esc(j.name)}: còn ${money(b)}">
        <span class="tag">${j.pct}%</span>
        ${jarSVG(j.id, fill)}
        <div class="jn">${j.emoji} ${esc(j.name)}</div>
        <div class="jb num ${b < 0 ? 'neg' : ''}">${short(b)}</div>
        <div class="js num">${spent ? 'đã chi ' + short(spent) : '&nbsp;'}</div>
      </button>`;
    }).join('')}</div>
  `;
  $$('.qbtn', $('#view-home')).forEach(b => b.onclick = () => {
    const f = freq[+b.dataset.q];
    undoableAdd({ type: 'out', amount: f.amount, jar: f.jar, note: f.note, date: today() }, `Đã ghi ${f.note} −${short(f.amount)}`);
  });
  $$('.jar', $('#view-home')).forEach(b => b.onclick = () => openSheet({ type: 'out', jar: b.dataset.jar }));
  $$('[data-go]', $('#view-home')).forEach(a => a.onclick = e => { e.preventDefault(); show(a.dataset.go); });
}

function txLine(t) {
  let ic, t1, t2, amt, cls, c;
  if (t.type === 'out') {
    const j = jarById(t.jar); c = jarColor(t.jar);
    ic = j?.emoji; t1 = t.note || j?.name; t2 = j?.name; amt = '−' + money(t.amount); cls = '';
  } else if (t.type === 'in') {
    c = 'var(--good)'; ic = '💵'; t1 = t.note || 'Thu nhập';
    const ids = Object.keys(t.split || {}).filter(k => t.split[k]);
    t2 = ids.length > 1 ? 'Chia vào ' + ids.length + ' lọ' : 'Vào lọ ' + (jarById(ids[0])?.name || '');
    amt = '+' + money(t.amount); cls = 'pos';
  } else {
    c = 'var(--text-3)'; ic = '🔁'; t1 = t.note || 'Chuyển lọ';
    t2 = `${jarById(t.from)?.short} → ${jarById(t.to)?.short}`; amt = money(t.amount); cls = 'muted';
  }
  return `<button class="tx" data-id="${t.id}" style="--c:${c}">
    <span class="ic">${ic}</span>
    <span class="mid"><span class="t1" style="display:block">${esc(t1)}</span><span class="t2">${esc(t2)}</span></span>
    <span class="amt num ${cls}">${amt}</span></button>`;
}

function renderHistory() {
  const s = histState, q = s.q.trim().toLowerCase();
  const list = db.tx.filter(t => ym(t.date) === s.month
    && (s.jar === 'all' || (s.jar === 'in' ? t.type === 'in' : delta(t, s.jar) !== 0 && t.type !== 'in'))
    && (!q || (t.note || '').toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  const groups = {};
  for (const t of list) (groups[t.date] ||= []).push(t);

  $('#view-history').innerHTML = `
    <div class="toolbar"><h1>Sổ ghi chép</h1>
      <div class="month-nav"><button data-m="-1" aria-label="Tháng trước">‹</button><span>${monthLabel(s.month)}</span><button data-m="1" aria-label="Tháng sau">›</button></div></div>
    <input class="search" type="search" placeholder="🔍 Tìm theo ghi chú…" value="${esc(s.q)}">
    <div class="filters">
      <button class="fchip ${s.jar === 'all' ? 'on' : ''}" data-f="all">Tất cả</button>
      <button class="fchip ${s.jar === 'in' ? 'on' : ''}" data-f="in">💵 Thu nhập</button>
      ${db.jars.map(j => `<button class="fchip ${s.jar === j.id ? 'on' : ''}" data-f="${j.id}">${j.emoji} ${esc(j.name)}</button>`).join('')}
    </div>
    <div id="histList">${list.length ? Object.entries(groups).map(([d, ts]) => {
      const out = ts.filter(t => t.type === 'out').reduce((a, t) => a + t.amount, 0);
      return `<div class="day"><div class="day-h"><span>${dayLabel(d)}</span><span class="num">${out ? '−' + money(out) : ''}</span></div>
        <div class="txl">${ts.map(txLine).join('')}</div></div>`;
    }).join('') : `<div class="empty-state"><div class="e">📭</div>Chưa có giao dịch nào${q ? ' khớp' : ' trong tháng này'}.</div>`}</div>
  `;
  const v = $('#view-history');
  $$('[data-m]', v).forEach(b => b.onclick = () => { s.month = shiftMonth(s.month, +b.dataset.m); renderHistory(); });
  $$('[data-f]', v).forEach(b => b.onclick = () => { s.jar = b.dataset.f; renderHistory(); });
  const inp = $('.search', v);
  inp.oninput = () => { s.q = inp.value; renderHistory(); const n = $('.search'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $$('.tx', v).forEach(b => b.onclick = () => openSheet(db.tx.find(t => t.id === b.dataset.id)));
}

function renderStats() {
  const key = statsMonth, ms = monthStats(key), bal = balances(key);
  const saved = ms.income - ms.expense;
  const rate = ms.income ? Math.round(saved / ms.income * 100) : null;

  // 6 tháng gần nhất
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(key, i - 5));
  const series = months.map(m => { const s = monthStats(m); return { m, inc: s.income, exp: s.expense }; });
  const max = Math.max(1, ...series.flatMap(s => [s.inc, s.exp]));
  const W = 320, H = 150, padB = 20, padT = 8, bw = 14, gw = W / 6;
  const yv = v => H - padB - (H - padB - padT) * v / max;
  const ticks = [0, .5, 1].map(f => max * f);
  const bars = series.map((s, i) => {
    const x = gw * i + gw / 2;
    const r = (val, dx, color, lbl) => {
      const h = H - padB - yv(val); if (h <= 0) return '';
      const y0 = yv(val), rr = Math.min(4, h);
      return `<path d="M${x + dx} ${H - padB} V${y0 + rr} q0 -${rr} ${rr} -${rr} h${bw - 2 * rr} q${rr} 0 ${rr} ${rr} V${H - padB} z" fill="${color}"/>`;
    };
    return `<g class="bar-g" data-i="${i}">
      <rect x="${gw * i}" y="0" width="${gw}" height="${H}" fill="transparent"/>
      ${r(s.inc, -bw - 1, 'var(--good)')}${r(s.exp, 1, 'var(--bad)')}
      <text class="axis" x="${x}" y="${H - 5}" text-anchor="middle" ${s.m === key ? 'style="font-weight:700;fill:var(--text)"' : ''}>T${+s.m.slice(5)}</text></g>`;
  }).join('');
  const grid = ticks.map(v => `<line class="grid" x1="0" x2="${W}" y1="${yv(v)}" y2="${yv(v)}"/><text class="axis" x="${W}" y="${yv(v) - 3}" text-anchor="end">${v ? short(v) : ''}</text>`).join('');

  // Phân bổ chi tiêu theo lọ
  const spentTotal = db.jars.reduce((a, j) => a + ms.jars[j.id].spent, 0);

  $('#view-stats').innerHTML = `
    <div class="toolbar"><h1>Thống kê</h1>
      <div class="month-nav"><button data-m="-1" aria-label="Tháng trước">‹</button><span>${monthLabel(key)}</span><button data-m="1" aria-label="Tháng sau">›</button></div></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Thu</div><div class="v num pos">${short(ms.income)}</div></div>
      <div class="kpi"><div class="l">Chi</div><div class="v num neg">${short(ms.expense)}</div></div>
      <div class="kpi"><div class="l">Để dành</div><div class="v num ${saved < 0 ? 'neg' : ''}">${rate === null ? '—' : rate + '%'}</div></div>
    </div>

    <h2>Ngân sách từng lọ trong tháng</h2>
    <div class="card budget">${db.jars.map(j => {
      const s = ms.jars[j.id];
      const avail = Math.max(0, bal[j.id] + s.spent); // tồn đầu tháng + nạp trong tháng
      const p = avail ? s.spent / avail : (s.spent ? 1 : 0);
      const over = bal[j.id] < 0;
      const warnUse = PROTECTED.has(j.id) && s.spent > 0;
      return `<div class="brow ${over ? 'over' : ''}" style="--c:${jarColor(j.id)}">
        <div class="bh"><span class="nm"><i></i>${j.emoji} ${esc(j.name)}</span><span class="num">${short(s.spent)} / ${short(avail)}</span></div>
        <div class="track" role="progressbar" aria-valuenow="${Math.round(p * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(j.name)}"><b style="width:${Math.min(100, p * 100)}%"></b></div>
        <div class="bs"><span>${over ? '⚠️ Vượt ' + short(-bal[j.id]) : warnUse ? '⚠️ Lọ này nên giữ, không tiêu' : 'Còn ' + short(bal[j.id])}</span><span>${Math.round(p * 100)}% đã dùng</span></div>
      </div>`;
    }).join('')}</div>

    <h2>Chi tiêu theo lọ</h2>
    <div class="card">${spentTotal ? `
      <div class="bar-split" style="height:14px;margin:0">${db.jars.filter(j => ms.jars[j.id].spent).map(j => `<i style="flex:${ms.jars[j.id].spent};background:${jarColor(j.id)}" title="${esc(j.name)}: ${money(ms.jars[j.id].spent)}"></i>`).join('')}</div>
      <table class="compare" style="margin-top:12px">
        <thead><tr><th>Lọ</th><th>Đã chi</th><th>Tỉ trọng</th><th>Mục tiêu</th></tr></thead>
        <tbody>${db.jars.map(j => {
          const v = ms.jars[j.id].spent, share = Math.round(v / spentTotal * 100);
          return `<tr><td><span class="legend" style="margin:0"><span><i style="background:${jarColor(j.id)}"></i>${esc(j.name)}</span></span></td>
            <td class="num">${short(v)}</td><td class="num">${share}%</td><td class="num muted">${j.pct}%</td></tr>`;
        }).join('')}</tbody></table>` : '<div class="muted">Chưa có chi tiêu trong tháng này.</div>'}
    </div>

    <h2>Thu & chi 6 tháng</h2>
    <div class="card chart" id="trend">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ thu chi 6 tháng">${grid}${bars}</svg>
      <div class="legend"><span><i style="background:var(--good)"></i>Thu</span><span><i style="background:var(--bad)"></i>Chi</span></div>
      <div class="tip" id="trendTip"></div>
    </div>
  `;
  const v = $('#view-stats');
  $$('[data-m]', v).forEach(b => b.onclick = () => { statsMonth = shiftMonth(statsMonth, +b.dataset.m); renderStats(); });
  const tip = $('#trendTip'), box = $('#trend');
  $$('.bar-g', v).forEach(g => {
    const showTip = () => {
      const s = series[+g.dataset.i], r = g.getBoundingClientRect(), br = box.getBoundingClientRect();
      tip.innerHTML = `<b>${monthLabel(s.m)}</b><br>Thu ${money(s.inc)}<br>Chi ${money(s.exp)}`;
      tip.style.left = Math.min(Math.max(r.left - br.left + r.width / 2, 70), br.width - 70) + 'px';
      tip.style.top = (r.top - br.top + 40) + 'px';
      tip.classList.add('show');
    };
    g.addEventListener('pointerenter', showTip);
    g.addEventListener('click', showTip);
    g.addEventListener('pointerleave', () => tip.classList.remove('show'));
  });
}

function renderSettings() {
  const total = db.jars.reduce((a, j) => a + j.pct, 0);
  $('#view-settings').innerHTML = `
    <h1>Cài đặt</h1>
    <h2>Tỉ lệ 6 chiếc lọ</h2>
    <div class="card">
      ${db.jars.map(j => `<div class="set-jar">
        <span class="em">${j.emoji}</span>
        <div><div class="nm">${esc(j.name)} <span class="muted">(${j.short})</span></div><div class="ds">${esc(j.desc)}</div></div>
        <label class="pct"><input type="number" inputmode="numeric" min="0" max="100" value="${j.pct}" data-pct="${j.id}" aria-label="Tỉ lệ ${esc(j.name)}"><span>%</span></label>
      </div>`).join('')}
      <div class="pct-total ${total === 100 ? 'pos' : 'neg'}" id="pctTotal">Tổng: ${total}% ${total === 100 ? '✓' : '— cần đúng 100%'}</div>
      <div class="btn-row" style="margin-top:10px"><button class="btn ghost" id="pctReset">Về mặc định 55-10-10-10-10-5</button></div>
    </div>

    <h2>Giao diện</h2>
    <div class="card set-list"><div class="item"><span>Chế độ màu</span>
      <select id="themeSel"><option value="auto">Theo hệ thống</option><option value="light">Sáng</option><option value="dark">Tối</option></select></div></div>

    <h2>Dữ liệu</h2>
    <div class="card">
      <p class="muted" style="margin:0 0 10px;font-size:13.5px">Dữ liệu chỉ lưu trên trình duyệt của máy này (${db.tx.length} giao dịch). Hãy sao lưu định kỳ.</p>
      <div class="btn-row">
        <button class="btn primary" id="exportJson">💾 Sao lưu (.json)</button>
        <button class="btn ghost" id="importJson">📂 Khôi phục</button>
        <button class="btn ghost" id="exportCsv">📄 Xuất CSV</button>
        <button class="btn ghost danger" id="wipe">Xoá hết</button>
      </div>
      <input type="file" id="fileIn" accept="application/json,.json" hidden>
    </div>

    <h2>Quy tắc 6 chiếc lọ</h2>
    <div class="card"><ul class="rules">
      <li>Mỗi khoản thu nhập được chia ngay vào 6 lọ theo tỉ lệ.</li>
      <li><b>FFA</b> (Tự do tài chính) và <b>LTSS</b> (Tiết kiệm dài hạn) chỉ nạp vào, không tiêu hằng ngày.</li>
      <li><b>PLAY</b> nên tiêu hết mỗi tháng — để tự thưởng cho bản thân.</li>
      <li>Lọ nào cạn thì dừng tiêu từ lọ đó, hoặc <b>chuyển lọ</b> có ý thức.</li>
      <li>Mẹo: cài app ra màn hình chính (Chia sẻ → Thêm vào MH chính) để mở nhanh.</li>
    </ul></div>
    <p class="muted" style="text-align:center;font-size:12px;margin-top:20px">Sổ Thu Chi 6 Lọ · hoạt động offline</p>
  `;
  const v = $('#view-settings');
  $$('[data-pct]', v).forEach(inp => inp.oninput = () => {
    const j = jarById(inp.dataset.pct); j.pct = Math.max(0, Math.min(100, Math.round(+inp.value || 0)));
    const t = db.jars.reduce((a, x) => a + x.pct, 0);
    const el = $('#pctTotal'); el.className = 'pct-total ' + (t === 100 ? 'pos' : 'neg');
    el.textContent = `Tổng: ${t}% ${t === 100 ? '✓' : '— cần đúng 100%'}`;
    save();
  });
  $('#pctReset').onclick = () => { db.jars.forEach(j => j.pct = DEFAULT_JARS.find(d => d.id === j.id).pct); save(); renderSettings(); };
  const ts = $('#themeSel'); ts.value = db.theme || 'auto';
  ts.onchange = () => { db.theme = ts.value; save(); applyTheme(); };
  $('#exportJson').onclick = () => {
    download(`sothuchi-${today()}.json`, JSON.stringify({ app: 'sothuchi', version: 1, ...db }, null, 1), 'application/json');
    db.lastBackup = Date.now(); save();
  };
  $('#exportCsv').onclick = () => {
    const rows = [['Ngày', 'Loại', 'Số tiền', 'Lọ', 'Ghi chú']];
    for (const t of [...db.tx].sort((a, b) => a.date.localeCompare(b.date))) {
      const jar = t.type === 'out' ? jarById(t.jar)?.name : t.type === 'move' ? `${jarById(t.from)?.name} → ${jarById(t.to)?.name}` : 'Chia lọ';
      rows.push([t.date, { in: 'Thu', out: 'Chi', move: 'Chuyển' }[t.type], t.amount, jar, t.note || '']);
    }
    download(`sothuchi-${today()}.csv`, '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  };
  $('#importJson').onclick = () => $('#fileIn').click();
  $('#fileIn').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.tx)) throw 0;
      if (!confirm(`Khôi phục ${d.tx.length} giao dịch? Dữ liệu hiện tại sẽ bị thay thế.`)) return;
      localStorage.setItem(KEY, JSON.stringify(d)); db = load(); save(); applyTheme(); renderAll();
      toast('Đã khôi phục dữ liệu');
    } catch { toast('File không hợp lệ'); }
    e.target.value = '';
  };
  $('#wipe').onclick = () => {
    if (!confirm('Xoá TOÀN BỘ giao dịch? Không thể hoàn tác.')) return;
    db.tx = []; save(); renderAll(); toast('Đã xoá dữ liệu');
  };
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function renderAll() {
  renderHome();
  if (view === 'history') renderHistory();
  if (view === 'stats') renderStats();
  if (view === 'settings') renderSettings();
}

function show(v) {
  view = v;
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  renderAll();
  window.scrollTo(0, 0);
}

/* ---------------- Sheet (thêm / sửa) ---------------- */
const sh = { open: false, type: 'out', amt: '', jar: 'nec', inJar: 'nec', from: 'play', to: 'nec', editing: null };

function jarButtons(el, sel, onPick, withBal) {
  const bal = withBal ? balances() : null;
  el.innerHTML = db.jars.map(j => `<button type="button" data-j="${j.id}" class="${j.id === sel ? 'on' : ''}" style="--c:${jarColor(j.id)}">
    <span class="e">${j.emoji}</span>${j.short}${bal ? `<span class="b num">${short(bal[j.id])}</span>` : ''}</button>`).join('');
  $$('button', el).forEach(b => b.onclick = () => onPick(b.dataset.j));
}

function openSheet(init = {}) {
  const t = init.id ? init : null;
  sh.editing = t;
  sh.type = init.type || 'out';
  sh.amt = t ? String(t.amount) : '';
  const lastOut = [...db.tx].reverse().find(x => x.type === 'out');
  sh.jar = init.jar || lastOut?.jar || 'nec';
  if (t?.type === 'in') {
    const ids = Object.keys(t.split).filter(k => t.split[k]);
    $('#splitAll').checked = ids.length > 1;
    sh.inJar = ids.length === 1 ? ids[0] : 'nec';
  } else { $('#splitAll').checked = true; sh.inJar = 'nec'; }
  if (t?.type === 'move') { sh.from = t.from; sh.to = t.to; }
  $('#noteInput').value = t?.note || '';
  $('#dateInput').value = t?.date || today();
  $('#btnDelete').hidden = !t;
  $('#btnSave').textContent = t ? 'Cập nhật' : 'Lưu';
  $('#toast').hidden = true;
  $('#backdrop').hidden = false; $('#sheet').hidden = false; sh.open = true;
  document.body.style.overflow = 'hidden';
  renderSheet();
}
function closeSheet() {
  $('#backdrop').hidden = true; $('#sheet').hidden = true; sh.open = false;
  document.body.style.overflow = '';
  $('#noteInput').blur();
}

function renderSheet() {
  const amount = +sh.amt || 0;
  $$('#typeSeg button').forEach(b => b.classList.toggle('on', b.dataset.type === sh.type));
  $('#amountText').textContent = nf.format(amount);
  $('#amountBox').className = 'amount ' + (sh.type === 'move' ? '' : sh.type);
  $('#paneOut').hidden = sh.type !== 'out';
  $('#paneIn').hidden = sh.type !== 'in';
  $('#paneMove').hidden = sh.type !== 'move';

  const qa = sh.type === 'in' ? [1e6, 5e6, 10e6, 20e6] : [10e3, 20e3, 50e3, 100e3, 500e3];
  $('#quickAmts').innerHTML = qa.map(v => `<button type="button" data-v="${v}">+${short(v)}</button>`).join('') +
    (sh.amt ? `<button type="button" data-v="clear">Xoá</button>` : '');
  $$('#quickAmts button').forEach(b => b.onclick = () => {
    sh.amt = b.dataset.v === 'clear' ? '' : String(amount + +b.dataset.v); renderSheet();
  });

  if (sh.type === 'out') {
    jarButtons($('#jarPick'), sh.jar, id => { sh.jar = id; renderSheet(); }, true);
  } else if (sh.type === 'in') {
    const all = $('#splitAll').checked;
    $('#splitPreview').hidden = !all; $('#jarPickIn').hidden = all;
    if (all) {
      const sp = splitIncome(amount);
      $('#splitPreview').innerHTML = db.jars.map(j => `<div style="--c:${jarColor(j.id)}">${j.emoji} ${j.short} · ${j.pct}%<b class="num">${short(sp[j.id])}</b></div>`).join('');
    } else jarButtons($('#jarPickIn'), sh.inJar, id => { sh.inJar = id; renderSheet(); });
  } else {
    jarButtons($('#jarFrom'), sh.from, id => { sh.from = id; renderSheet(); }, true);
    jarButtons($('#jarTo'), sh.to, id => { sh.to = id; renderSheet(); }, true);
  }
  renderChips();
  const ok = amount > 0 && !(sh.type === 'move' && sh.from === sh.to) && !(sh.type === 'in' && $('#splitAll').checked && db.jars.reduce((a, j) => a + j.pct, 0) !== 100);
  $('#btnSave').disabled = !ok; $('#btnSave').style.opacity = ok ? 1 : .45;
  if (sh.type === 'out' && PROTECTED.has(sh.jar)) $('#btnSave').textContent = (sh.editing ? 'Cập nhật' : 'Lưu') + ' (lọ này nên để dành!)';
  else $('#btnSave').textContent = sh.editing ? 'Cập nhật' : 'Lưu';
}

const DEFAULT_NOTES = {
  out: ['Ăn sáng', 'Cà phê', 'Ăn trưa', 'Đi chợ', 'Xăng', 'Grab', 'Điện nước', 'Tiền nhà'],
  in: ['Lương', 'Thưởng', 'Làm thêm', 'Lãi đầu tư', 'Được cho'],
  move: ['Cân đối lọ'],
};
function renderChips() {
  const idx = noteIndex(sh.type), q = $('#noteInput').value.trim().toLowerCase();
  let items = [...idx.values()];
  if (q) items = items.filter(e => e.note.toLowerCase().includes(q) && e.note.toLowerCase() !== q);
  else if (sh.type === 'out') items.sort((a, b) => ((b.jar === sh.jar) - (a.jar === sh.jar)) || b.count - a.count);
  else items.sort((a, b) => b.count - a.count);
  let notes = items.slice(0, 10).map(e => e.note);
  if (!q && notes.length < 6) notes = notes.concat(DEFAULT_NOTES[sh.type].filter(n => !idx.has(n.toLowerCase()))).slice(0, 10);
  $('#noteChips').innerHTML = notes.map(n => `<button type="button">${esc(n)}</button>`).join('');
  $$('#noteChips button').forEach((b, i) => b.onclick = () => { $('#noteInput').value = notes[i]; applyNote(true); });
}
/* Ghi chú quen → tự chọn lọ & gợi ý số tiền */
function applyNote(fromChip) {
  const e = noteIndex(sh.type).get($('#noteInput').value.trim().toLowerCase());
  if (e) {
    if (sh.type === 'out' && e.jar) sh.jar = e.jar;
    if (fromChip && !sh.amt && e.amount) sh.amt = String(e.amount);
  }
  renderSheet();
}

function saveSheet() {
  const amount = +sh.amt || 0;
  if (!amount) return;
  const base = { amount, note: $('#noteInput').value.trim(), date: $('#dateInput').value || today(), type: sh.type };
  if (sh.type === 'out') base.jar = sh.jar;
  if (sh.type === 'in') base.split = $('#splitAll').checked ? splitIncome(amount) : { [sh.inJar]: amount };
  if (sh.type === 'move') { if (sh.from === sh.to) return; base.from = sh.from; base.to = sh.to; }

  if (sh.editing) {
    const i = db.tx.findIndex(t => t.id === sh.editing.id);
    db.tx[i] = { id: sh.editing.id, created: sh.editing.created, ...base };
    save(); renderAll(); closeSheet(); toast('Đã cập nhật');
    return;
  }
  closeSheet();
  const label = sh.type === 'out' ? `Đã ghi chi ${short(amount)} từ ${jarById(sh.jar).name}`
    : sh.type === 'in' ? `+${short(amount)} đã ${$('#splitAll').checked ? 'chia vào 6 lọ' : 'vào ' + jarById(sh.inJar).name}`
    : `Đã chuyển ${short(amount)}`;
  undoableAdd(base, label);
  if (sh.type === 'out') {
    const b = balances()[sh.jar];
    if (b < 0) setTimeout(() => toast(`⚠️ Lọ ${jarById(sh.jar).name} đã âm ${short(-b)}`), 5100);
  }
}

function deleteEditing() {
  const t = sh.editing; if (!t) return;
  db.tx = db.tx.filter(x => x.id !== t.id); save(); closeSheet(); renderAll();
  toast('Đã xoá giao dịch', 'Hoàn tác', () => { db.tx.push(t); save(); renderAll(); });
}

function keyIn(k) {
  if (k === 'del') sh.amt = sh.amt.slice(0, -1);
  else if ((sh.amt + k).length <= 13) sh.amt = (sh.amt + k).replace(/^0+/, '');
  renderSheet();
}

/* ---------------- Theme ---------------- */
function applyTheme() {
  const t = db.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* ---------------- Wire up ---------------- */
function init() {
  applyTheme();
  $$('.tab').forEach(t => t.onclick = () => show(t.dataset.view));
  $('#fab').onclick = () => openSheet();
  $('#backdrop').onclick = closeSheet;
  $$('#typeSeg button').forEach(b => b.onclick = () => { sh.type = b.dataset.type; renderSheet(); });
  $$('#keypad button').forEach(b => b.onclick = () => keyIn(b.dataset.k || b.textContent));
  $('#splitAll').onchange = renderSheet;
  $('#noteInput').oninput = () => applyNote(false);
  $('#noteInput').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#noteInput').blur(); } };
  $('#btnSave').onclick = saveSheet;
  $('#btnDelete').onclick = deleteEditing;

  // Kéo thanh trên xuống để đóng sheet
  let y0 = null;
  $('.grab').addEventListener('pointerdown', e => (y0 = e.clientY));
  window.addEventListener('pointerup', e => { if (y0 !== null && e.clientY - y0 > 60) closeSheet(); y0 = null; });

  // Bàn phím trên máy tính
  document.addEventListener('keydown', e => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName);
    if (!sh.open) {
      if (!typing && (e.key === 'n' || e.key === '+')) { e.preventDefault(); openSheet(); }
      return;
    }
    if (e.key === 'Escape') return closeSheet();
    if (typing) return;
    if (/^\d$/.test(e.key)) keyIn(e.key);
    else if (e.key === 'Backspace') keyIn('del');
    else if (e.key === 'k') keyIn('000');
    else if (e.key === 'Enter') saveSheet();
  });

  // Mở app từ shortcut ?add=out|in
  const p = new URLSearchParams(location.search).get('add');
  renderAll();
  if (p) openSheet({ type: p });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // Làm mới khi quay lại app qua ngày mới
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });
}
init();
