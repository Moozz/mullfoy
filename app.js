const BINS = {
  green: {
    label: 'Bioabfall', sub: 'Organic waste', em: '🟩', cls: 'b-green',
    rule: 'Paper bags only — "compostable" bioplastic bags are banned in Erlangen.'
  },
  blue: {
    label: 'Papier', sub: 'Paper & cardboard', em: '🟦', cls: 'b-blue',
    rule: 'Must be clean and dry. Flatten cardboard. Labels and tape can stay on.'
  },
  yellow: {
    label: 'Verpackung', sub: 'Packaging / Gelbe Tonne', em: '🟨', cls: 'b-yellow',
    rule: '"Löffelrein" (spoon-clean) is enough — scrape, don\'t wash. Composites count too.'
  },
  black: {
    label: 'Restabfall', sub: 'Residual waste', em: '⬛', cls: 'b-black',
    rule: 'Last resort — check the other bins first. Ash must be fully cold.'
  },
  glass: {
    label: 'Altglas', sub: 'Glass container', em: '🫙', cls: 'b-glass',
    rule: 'Sort by colour (brown / green / white). Lids off → yellow bin.'
  },
  hazard: {
    label: 'Sondermüll', sub: 'Hazardous drop-off', em: '☠️', cls: 'b-haz',
    rule: 'Full or liquid → drop-off point. Empty spray cans & dried paint → black bin.'
  }
};

let ITEMS = [];
const $ = s => document.querySelector(s);
const qEl = $('#q'), clearBtn = $('#clear');
const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* --- fuzzy: is q a subsequence of t? --- */
function subseq(q, t) { let i = 0; for (const c of t) { if (c === q[i]) i++; if (i === q.length) return true; } return !q.length; }

function score(it, q) {
  const n = norm(it.name), d = norm(it.de), a = (it.aliases || []).map(norm);
  if (n === q) return 100;
  if (a.includes(q) || d === q) return 95;
  if (n.startsWith(q)) return 85;
  if (a.some(x => x.startsWith(q)) || d.startsWith(q)) return 78;
  if (n.includes(q)) return 70;
  if (d.includes(q) || a.some(x => x.includes(q))) return 62;
  if (norm(it.note).includes(q)) return 40;
  if (q.length >= 4 && (subseq(q, n) || a.some(x => subseq(q, x)))) return 30;
  return 0;
}

function search(raw) {
  const q = norm(raw); if (!q) return [];
  return ITEMS.map(it => ({ it, s: score(it, q) })).filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.it.name.length - b.it.name.length)
    .slice(0, 8).map(x => x.it);
}

function hl(text, raw) {
  const q = norm(raw), t = esc(text); if (!q) return t;
  const i = norm(t).indexOf(q); if (i < 0) return t;
  return t.slice(0, i) + '<mark>' + t.slice(i, i + q.length) + '</mark>' + t.slice(i + q.length);
}

/* ================= renderers ================= */
function renderLegend() {
  $('#legend').innerHTML = Object.values(BINS).map(b =>
    `<div class="chip ${b.cls}"><b>${b.em} ${b.label}</b><i>${b.sub}</i></div>`).join('');
  $('#quicknav').innerHTML = Object.entries(BINS).map(([k, b]) =>
    `<button data-go="bin-${k}">${b.em} ${b.label}</button>`).join('');
}

function renderBrowse() {
  $('#browse').innerHTML = Object.entries(BINS).map(([k, b]) => {
    const L = ITEMS.filter(i => i.bin === k);
    return `<details id="bin-${k}" open>
      <summary class="${b.cls}">
        <span class="em">${b.em}</span>
        <span>${b.label}<span class="sub">${b.sub}</span></span>
        <span class="cnt">${L.length}</span><span class="chev">▼</span>
      </summary>
      <ul>${L.map(i => `<li>${esc(i.name)}<small>${esc(i.note)}</small></li>`).join('')}</ul>
      <div class="golden">⚠️ <b>Golden rule:</b> ${b.rule}</div>
    </details>`;
  }).join('');
  $('#count').textContent = ITEMS.length;
}

function renderConfused() {
  $('#confused').innerHTML = ITEMS.filter(i => i.confusable).map(i => {
    const b = BINS[i.bin];
    return `<div class="crow" data-q="${esc(i.name)}">
      <span class="cn">${esc(i.name)}<small>${esc(i.de)}</small></span>
      <span class="tag ${b.cls}">${b.em}</span></div>`;
  }).join('');
}

function renderResults(L, raw) {
  const box = $('#results');
  if (!L.length) { box.hidden = true; $('#empty').hidden = false; $('#guide').hidden = true; return; }
  $('#empty').hidden = true; $('#guide').hidden = true; box.hidden = false;
  box.innerHTML = L.map(it => {
    const b = BINS[it.bin];
    return `<article class="res">
      <div class="head ${b.cls}"><span class="em">${b.em}</span>
        <span class="txt"><b>${b.label}</b><small>${b.sub}</small></span></div>
      <div class="body">
        <div class="name">${hl(it.name, raw)}</div>
        <div class="de">${esc(it.de)}</div>
        <div class="note">${esc(it.note)}</div>
      </div></article>`;
  }).join('');
}

/* ================= recent ================= */
const RK = 'wg-recent';
const getR = () => { try { return JSON.parse(localStorage.getItem(RK) || '[]'); } catch { return []; } };
function pushR(t) {
  if (!t.trim()) return;
  const r = [t, ...getR().filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 5);
  localStorage.setItem(RK, JSON.stringify(r)); renderR();
}
function renderR() {
  const r = getR(), el = $('#recent');
  el.hidden = !r.length || !!qEl.value;
  el.innerHTML = r.map(t => `<button data-t="${esc(t)}">${esc(t)}</button>`).join('');
}

/* ================= events ================= */
function run() {
  const v = qEl.value;
  clearBtn.classList.toggle('show', !!v);
  renderR();

  if (!v.trim()) {
    // Force show guide, force hide others
    const guide = $('#guide');
    guide.hidden = false;
    guide.style.display = 'block'; // Ensure it's not overridden

    $('#results').hidden = true;
    $('#empty').hidden = true;
    return;
  }

  // Searching...
  renderResults(search(v), v);
  $('#guide').hidden = true;
}

qEl.addEventListener('input', run);
qEl.addEventListener('change', () => pushR(qEl.value));
qEl.addEventListener('keydown', e => { if (e.key === 'Enter') { pushR(qEl.value); qEl.blur(); } });
clearBtn.addEventListener('click', () => { qEl.value = ''; run(); qEl.focus(); });

$('#recent').addEventListener('click', e => {
  const b = e.target.closest('button'); if (b) { qEl.value = b.dataset.t; run(); }
});
$('#quicknav').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const el = document.getElementById(b.dataset.go);
  if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});
$('#confused').addEventListener('click', e => {
  const r = e.target.closest('.crow'); if (!r) return;
  qEl.value = r.dataset.q; run(); pushR(r.dataset.q);
  scrollTo({ top: 0, behavior: 'smooth' });
});
$('#toggleAll').addEventListener('click', () => {
  const d = [...document.querySelectorAll('#browse details')], open = d.some(x => x.open);
  d.forEach(x => x.open = !open);
  $('#toggleAll').textContent = open ? 'Expand all' : 'Collapse all';
});
addEventListener('beforeprint', () => document.querySelectorAll('details').forEach(d => d.open = true));

/* ================= boot ================= */
function fail(msg) {
  const el = $('#err');
  el.hidden = false;
  el.innerHTML = `<b style="color:#c62828">⚠️ Could not load items</b><br>${esc(msg)}
    <small>Usually a stale cache or a wrong path to data/items.json.
    Clear site data and reload.</small>`;
}

fetch('./data/items.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' fetching data/items.json'); return r.json(); })
  .then(d => {
    ITEMS = d.items || [];
    if (!ITEMS.length) throw new Error('items.json loaded but contains 0 items');
    renderLegend(); renderBrowse(); renderConfused(); renderR();
    const dq = new URLSearchParams(location.search).get('q');
    if (dq) { qEl.value = dq; run(); }
  })
  .catch(e => fail(e.message));

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
}