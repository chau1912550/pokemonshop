import { getState, inPeriod, previousPeriod } from '../state.js';
import { $, $$, fmtMoney, fmtPct, fmtShort, computeShipmentCosts, SHIPMENT_COST_KEYS, shipmentStatus } from '../utils.js';
import { openShipmentModal } from './shipments.js';

let costChart, trendChart;

// ============ Icons ============
function walletIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M3 10V7a2 2 0 012-2h12a2 2 0 012 2v3M3 10v8a2 2 0 002 2h14a2 2 0 002-2v-8M3 10h18M17 14h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
function moneyIcon()  { return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l2 3h5l-3 3 1 5-5-3-5 3 1-5-3-3h5l2-3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="14" r="3" stroke="currentColor" stroke-width="1.6"/></svg>'; }
function checkIcon()  { return '<svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function roiIcon()    { return '<svg viewBox="0 0 24 24" fill="none"><path d="M3 17l6-6 4 4 8-8M21 7v6h-6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function pieIcon()    { return '<svg viewBox="0 0 24 24" fill="none"><path d="M21 12A9 9 0 1112 3v9h9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; }
function trophyIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 22h4M12 17v-3M8 4h8v6a4 4 0 11-8 0V4zM8 6H5v2a3 3 0 003 3M16 6h3v2a3 3 0 01-3 3" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function percentIcon(){ return '<svg viewBox="0 0 24 24" fill="none"><path d="M19 5L5 19M7 8a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z" stroke="#0EA5E9" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
function truckIcon()  { return '<svg viewBox="0 0 24 24" fill="none"><path d="M1 12h11v6H1zM12 8h5l4 4v6h-9V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'; }

// Shipments whose date falls inside the active reporting period.
function shipmentsInPeriod(period) {
  return getState().shipments.filter(s => inPeriod(s, period));
}

// Aggregate a list of shipments into one cost/profit summary.
function aggregate(list) {
  const stats = list.map(s => ({ s, c: computeShipmentCosts(s) }));
  const sum = { purchase: 0, packaging: 0, domestic: 0, insurance: 0, intl: 0, landed: 0, sell: 0, profit: 0, realized: 0 };
  for (const { s, c } of stats) {
    sum.purchase  += c.purchase;
    sum.packaging += c.packaging;
    sum.domestic  += c.domestic;
    sum.insurance += c.insurance;
    sum.intl      += c.intl;
    sum.landed    += c.landed;
    sum.sell      += c.sell;
    sum.profit    += c.profit;
    if ((s.status || 'selling') === 'sold') sum.realized += c.profit;
  }
  sum.margin = sum.sell > 0 ? (sum.profit / sum.sell) * 100 : 0;
  sum.roi    = sum.landed > 0 ? (sum.profit / sum.landed) * 100 : 0;
  return { stats, sum };
}

function delta(cur, prev) {
  if (!prev) return null;
  const diff = cur - prev;
  const pct = (diff / Math.abs(prev)) * 100;
  return { pct, up: diff >= 0 };
}

function deltaHtml(d) {
  if (!d) return `<div class="kpi-delta"><span style="color:var(--text-3)">—</span></div>`;
  return `<div class="kpi-delta">
    <span class="${d.up ? 'kpi-delta-up' : 'kpi-delta-down'}">${d.up ? '↑' : '↓'} ${Math.abs(d.pct).toFixed(1)}%</span>
    <span>so với kỳ trước</span>
  </div>`;
}

// ============ KPI cards ============
export function renderKPIs() {
  const { period } = getState();
  const { sum } = aggregate(shipmentsInPeriod(period));
  const { sum: prev } = aggregate(shipmentsInPeriod(previousPeriod(period)));

  const defs = [
    { label: 'Tổng giá vốn',      value: fmtMoney(sum.landed),   tone: 'kpi-blue',   icon: walletIcon, delta: delta(sum.landed, prev.landed) },
    { label: 'Lợi nhuận dự kiến', value: fmtMoney(sum.profit),   tone: 'kpi-yellow', icon: moneyIcon,  delta: delta(sum.profit, prev.profit) },
    { label: 'Lợi nhuận đã chốt', value: fmtMoney(sum.realized), tone: 'kpi-green',  icon: checkIcon,  delta: delta(sum.realized, prev.realized) },
    { label: 'ROI (lời/vốn)',     value: fmtPct(sum.roi),        tone: 'kpi-teal',   icon: roiIcon,    delta: null },
    { label: 'Biên lợi nhuận',    value: fmtPct(sum.margin),     tone: 'kpi-purple', icon: pieIcon,    delta: null },
  ];

  $('#kpiGrid').innerHTML = defs.map(d => `
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon ${d.tone}">${d.icon()}</div></div>
      <div class="kpi-label">${d.label}</div>
      <div class="kpi-value">${d.value}</div>
      ${deltaHtml(d.delta)}
    </div>
  `).join('');
}

// ============ Shipments executive table ============
export function renderDashShipmentsTable() {
  const { period } = getState();
  const { stats, sum } = aggregate(shipmentsInPeriod(period));
  const body = $('#dashShipmentsBody');
  const foot = $('#dashShipmentsFoot');

  if (!stats.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty">
      <div class="empty-title">Chưa có lô hàng trong kỳ</div>
      <div class="empty-sub">Bấm "Thêm lô hàng", hoặc đổi kỳ báo cáo ở góc trên.</div>
    </div></td></tr>`;
    foot.innerHTML = '';
    return;
  }

  const sorted = [...stats].sort((a, b) => (b.s.date || '').localeCompare(a.s.date || ''));
  body.innerHTML = sorted.map(({ s, c }) => {
    const st = shipmentStatus(s);
    return `
      <tr data-id="${s.id}" class="row-edit" title="Bấm để sửa">
        <td><b>${escapeHtml(s.name || s.code)}</b></td>
        <td><span class="pill ${st.cls}">${st.label}</span></td>
        <td class="num">${fmtMoney(c.landed)}</td>
        <td class="num">${fmtMoney(c.sell)}</td>
        <td class="num profit-cell" style="color:${c.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtMoney(c.profit)}</td>
        <td class="num" style="font-weight:600; color:${c.roi >= 0 ? 'var(--success)' : 'var(--danger)'}">${c.sell > 0 ? fmtPct(c.roi) : '—'}</td>
      </tr>`;
  }).join('');

  foot.innerHTML = `
    <tr>
      <td>Tổng cộng</td>
      <td></td>
      <td class="num">${fmtMoney(sum.landed)}</td>
      <td class="num">${fmtMoney(sum.sell)}</td>
      <td class="num profit-cell" style="color:${sum.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtMoney(sum.profit)}</td>
      <td class="num" style="font-weight:700; color:${sum.roi >= 0 ? 'var(--success)' : 'var(--danger)'}">${sum.sell > 0 ? fmtPct(sum.roi) : '—'}</td>
    </tr>
  `;

  $$('.row-edit', body).forEach(row => row.addEventListener('click', () => openShipmentModal(row.dataset.id)));
}

// ============ Trend chart (last 6 months) ============
function lastNMonths(n = 6) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      label: String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2),
    });
  }
  return out;
}

export function renderTrendChart() {
  const canvas = $('#chartTrend');
  if (!canvas || !window.Chart) return;
  const { shipments } = getState();
  const months = lastNMonths(6);

  const cost = {}, rev = {}, profit = {};
  for (const s of shipments) {
    const m = (s.date || '').slice(0, 7);
    if (!m) continue;
    const c = computeShipmentCosts(s);
    cost[m]   = (cost[m]   || 0) + c.landed;
    rev[m]    = (rev[m]    || 0) + c.sell;
    profit[m] = (profit[m] || 0) + c.profit;
  }

  const labels = months.map(m => m.label);
  const dCost = months.map(m => cost[m.key] || 0);
  const dRev  = months.map(m => rev[m.key] || 0);
  const dProf = months.map(m => profit[m.key] || 0);

  const datasets = [
    { label: 'Giá vốn',   data: dCost, backgroundColor: '#4F7BFF', borderRadius: 6, barPercentage: 0.7, categoryPercentage: 0.6 },
    { label: 'Doanh thu', data: dRev,  backgroundColor: '#14B8A6', borderRadius: 6, barPercentage: 0.7, categoryPercentage: 0.6 },
    { label: 'Lợi nhuận', data: dProf, backgroundColor: '#10B981', borderRadius: 6, barPercentage: 0.7, categoryPercentage: 0.6 },
  ];
  $('#legendTrend').innerHTML = datasets.map(d => `<span><i style="background:${d.backgroundColor}"></i>${d.label}</span>`).join('');

  const box = canvas.parentElement;
  const old = box.querySelector('.chart-empty'); if (old) old.remove();
  if (![...dCost, ...dRev, ...dProf].some(v => v !== 0)) {
    const div = document.createElement('div');
    div.className = 'chart-empty';
    div.innerHTML = '<div><svg viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18M7 14l4-4 3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Chưa có dữ liệu theo tháng</div>';
    box.appendChild(div);
  }

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmtMoney(c.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94A3B8' } },
        y: { grid: { color: '#EFF2F7' }, ticks: { font: { size: 11 }, color: '#94A3B8', callback: v => fmtShort(v) } },
      },
    },
  });
}

// ============ Cost donut (5 categories) ============
export function renderCostDonut() {
  const canvas = $('#chartCost');
  if (!canvas || !window.Chart) return;
  const { period } = getState();
  const { sum } = aggregate(shipmentsInPeriod(period));

  const values = { purchase: sum.purchase, packaging: sum.packaging, domestic: sum.domestic, insurance: sum.insurance, intl: sum.intl };
  const total = sum.landed;
  $('#donutTotalCost').textContent = fmtMoney(total);

  const visible = SHIPMENT_COST_KEYS.filter(k => (values[k.key] || 0) > 0);
  const labels = visible.map(k => k.label);
  const data   = visible.map(k => values[k.key]);
  const colors = visible.map(k => k.color);

  const box = canvas.parentElement;
  const old = box.querySelector('.chart-empty'); if (old) old.remove();
  if (total <= 0) {
    const div = document.createElement('div');
    div.className = 'chart-empty';
    div.innerHTML = '<div><svg viewBox="0 0 24 24" fill="none"><path d="M21 12A9 9 0 1112 3v9h9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>Chưa có chi phí lô hàng</div>';
    box.appendChild(div);
  }

  if (costChart) costChart.destroy();
  costChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.label + ': ' + fmtMoney(c.parsed) } } },
    },
  });

  const legend = $('#donutLegend');
  legend.innerHTML = SHIPMENT_COST_KEYS.map(k => {
    const v = values[k.key] || 0;
    const pct = total > 0 ? (v / total) * 100 : 0;
    return `<li>
      <i style="background:${k.color}"></i>
      <span class="l-name">${k.label}</span>
      <span class="l-pct">${pct.toFixed(1)}%</span>
      <span class="l-val">${fmtMoney(v)}</span>
    </li>`;
  }).join('') + `<li style="border-top:1px solid var(--border-2); padding-top:8px; margin-top:4px;">
      <i style="visibility:hidden"></i>
      <span class="l-name" style="font-weight:600">Tổng giá vốn</span>
      <span class="l-pct">100%</span>
      <span class="l-val" style="font-weight:600">${fmtMoney(total)}</span>
    </li>`;
}

// ============ Highlights ============
export function renderHighlights() {
  const { period } = getState();
  const { stats, sum } = aggregate(shipmentsInPeriod(period));
  const target = $('#highlights');
  if (!stats.length) {
    target.innerHTML = `<div class="empty"><div class="empty-sub">Thêm lô hàng để xem thông tin nổi bật.</div></div>`;
    return;
  }

  const top = stats.reduce((a, b) => (a.c.profit > b.c.profit ? a : b));
  const shipTotal = sum.domestic + sum.intl;
  const shipRatio = sum.purchase > 0 ? (shipTotal / sum.purchase) * 100 : 0;
  const soldCount = stats.filter(x => (x.s.status || 'selling') === 'sold').length;

  target.innerHTML = `
    <div class="highlight-row">
      <div class="highlight-icon" style="background:#FEF3C7">${trophyIcon()}</div>
      <div class="highlight-text">Lô lãi cao nhất<b>${escapeHtml(top.s.name || top.s.code)}</b></div>
      <div class="highlight-value">
        <div class="highlight-value-main">${fmtMoney(top.c.profit)}</div>
        <div class="highlight-value-sub">${top.c.sell > 0 ? 'ROI ' + fmtPct(top.c.roi) : 'lợi nhuận'}</div>
      </div>
    </div>
    <div class="highlight-row">
      <div class="highlight-icon" style="background:#DCFCE7">${checkIcon2()}</div>
      <div class="highlight-text">Đã bán hết<b>${soldCount}/${stats.length} lô</b></div>
      <div class="highlight-value">
        <div class="highlight-value-main">${fmtMoney(sum.realized)}</div>
        <div class="highlight-value-sub">lợi nhuận đã chốt</div>
      </div>
    </div>
    <div class="highlight-row">
      <div class="highlight-icon" style="background:#E0F2FE">${truckIcon()}</div>
      <div class="highlight-text">Phí ship (nội địa + quốc tế)<b>${fmtMoney(shipTotal)}</b></div>
      <div class="highlight-value">
        <div class="highlight-value-main">${fmtPct(shipRatio)}</div>
        <div class="highlight-value-sub">trên tiền hàng</div>
      </div>
    </div>
  `;
}
function checkIcon2() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#16A34A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderDashboard() {
  renderKPIs();
  renderTrendChart();
  renderDashShipmentsTable();
  renderCostDonut();
  renderHighlights();
}

export function initDashboard() {
  $('#btnAddShipmentDash').addEventListener('click', () => openShipmentModal(null));
  renderDashboard();
}
