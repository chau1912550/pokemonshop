import { getState, getCategories, inPeriod, previousPeriod } from '../state.js';
import { $, $$, fmtMoney, fmtPct, fmtShort, parseNumber, computeProductProfit, attachNumberInput, debounce } from '../utils.js';
import { openProductModal } from './products.js';

let compareChart, costChart;

// ============ KPI cards ============
const KPI_DEFS = [
  { key: 'totalCapital', label: 'Tổng vốn', tone: 'kpi-blue', icon: walletIcon },
  { key: 'shipCost', label: 'Phí ship', tone: 'kpi-teal', icon: truckIcon },
  { key: 'revenue', label: 'Doanh thu dự kiến', tone: 'kpi-green', icon: chartIcon },
  { key: 'profit', label: 'Lợi nhuận', tone: 'kpi-yellow', icon: moneyIcon },
  { key: 'margin', label: 'Biên lợi nhuận', tone: 'kpi-purple', icon: pieIcon, isPercent: true },
];

function walletIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M3 10V7a2 2 0 012-2h12a2 2 0 012 2v3M3 10v8a2 2 0 002 2h14a2 2 0 002-2v-8M3 10h18M17 14h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
function truckIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M1 12h11v6H1zM12 8h5l4 4v6h-9V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'; }
function chartIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18M7 14l4-4 3 3 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function moneyIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l2 3h5l-3 3 1 5-5-3-5 3 1-5-3-3h5l2-3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="14" r="3" stroke="currentColor" stroke-width="1.6"/></svg>'; }
function pieIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M21 12A9 9 0 1112 3v9h9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; }
function trophyIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 22h4M12 17v-3M8 4h8v6a4 4 0 11-8 0V4zM8 6H5v2a3 3 0 003 3M16 6h3v2a3 3 0 01-3 3" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function percentIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M19 5L5 19M7 8a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z" stroke="#0EA5E9" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
function targetIcon() { return '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#7C3AED" stroke-width="1.8"/><circle cx="12" cy="12" r="5" stroke="#7C3AED" stroke-width="1.8"/><circle cx="12" cy="12" r="1.5" fill="#7C3AED"/></svg>'; }

// Build KPI numbers for a given expense set (period-filtered or not).
function computeKPIs(products, periodExpenses, shipments = []) {
  const totalCapital = products.reduce((s, p) => s + (+p.buyPrice || 0) * (+p.quantity || 0), 0);
  const shipFromProducts = products.reduce((s, p) => {
    const ship = computeProductProfit(p, shipments).shipPerUnit;
    return s + ship * (+p.quantity || 0);
  }, 0);
  const shipFromExpenses = periodExpenses
    .filter(e => e.category === 'ship_intl' || e.category === 'ship_dom')
    .reduce((s, e) => s + (+e.amount || 0), 0);
  const shipCost = shipFromExpenses || shipFromProducts;
  const revenue = products.reduce((s, p) => s + (+p.sellPrice || 0) * (+p.quantity || 0), 0);
  const profit = products.reduce((s, p) => s + computeProductProfit(p, shipments).totalProfit, 0);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { totalCapital, shipCost, revenue, profit, margin };
}

function delta(current, previous) {
  if (!previous) return null; // No baseline → no comparison shown
  const diff = current - previous;
  const pct = (diff / Math.abs(previous)) * 100;
  return { pct, up: diff >= 0 };
}

export function renderKPIs() {
  const { products, expenses, period, shipments } = getState();
  const curExpenses = expenses.filter(e => inPeriod(e, period));
  const prevP = previousPeriod(period);
  const prevExpenses = expenses.filter(e => inPeriod(e, prevP));

  const cur = computeKPIs(products, curExpenses, shipments);
  const prev = computeKPIs(products, prevExpenses, shipments);
  // For product-based KPIs (capital, revenue, profit, margin) the snapshot
  // doesn't change with period, so deltas would always be 0. Only show
  // delta on the cost-driven `shipCost` KPI.
  const deltas = {
    totalCapital: null,
    shipCost: delta(cur.shipCost, prev.shipCost),
    revenue: null,
    profit: null,
    margin: null,
  };

  const grid = $('#kpiGrid');
  grid.innerHTML = '';
  KPI_DEFS.forEach(def => {
    const v = cur[def.key];
    const display = def.isPercent ? fmtPct(v) : fmtMoney(v);
    const d = deltas[def.key];
    const deltaHtml = d ? `
      <div class="kpi-delta">
        <span class="${d.up ? 'kpi-delta-up' : 'kpi-delta-down'}">
          ${d.up ? '↑' : '↓'} ${Math.abs(d.pct).toFixed(1)}%
        </span>
        <span>so với kỳ trước</span>
      </div>
    ` : `<div class="kpi-delta"><span style="color:var(--text-3)">—</span></div>`;

    grid.insertAdjacentHTML('beforeend', `
      <div class="kpi">
        <div class="kpi-head">
          <div class="kpi-icon ${def.tone}">${def.icon()}</div>
          <span class="kpi-info" title="${def.label}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v.01M11 11h1v5h1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </span>
        </div>
        <div class="kpi-label">${def.label}</div>
        <div class="kpi-value">${display}</div>
        ${deltaHtml}
      </div>
    `);
  });
}

// ============ Products table on dashboard ============
export function renderDashProductsTable() {
  const { products, shipments } = getState();
  const body = $('#dashProductsBody');
  const foot = $('#dashProductsFoot');

  if (!products.length) {
    body.innerHTML = `<tr><td colspan="8"><div class="empty">
      <div class="empty-title">Chưa có sản phẩm</div>
      <div class="empty-sub">Bấm "Thêm sản phẩm" hoặc dùng "Bộ tính nhanh" để bắt đầu.</div>
    </div></td></tr>`;
    foot.innerHTML = '';
    return;
  }

  const rows = products.map(p => {
    const { profitPerUnit, totalProfit, shipPerUnit } = computeProductProfit(p, shipments);
    const thumb = p.image ? `style="background-image:url('${p.image}')"` : '';
    return `
      <tr data-id="${p.id}" class="row-edit" title="Bấm để sửa">
        <td><div class="product-cell"><div class="product-thumb" ${thumb}></div><span>${escapeHtml(p.name)}</span></div></td>
        <td class="num">${p.quantity || 0}</td>
        <td class="num">${fmtMoney(p.buyPrice)}</td>
        <td class="num">${fmtMoney(shipPerUnit)}</td>
        <td class="num">${fmtMoney(p.declaredPrice)}</td>
        <td class="num">${fmtMoney(p.sellPrice)}</td>
        <td class="num profit-cell">${fmtMoney(profitPerUnit)}</td>
        <td class="num profit-cell">${fmtMoney(totalProfit)}</td>
      </tr>
    `;
  }).join('');
  body.innerHTML = rows;

  // Totals row.
  const sum = products.reduce((acc, p) => {
    const { totalProfit, profitPerUnit, shipPerUnit } = computeProductProfit(p, shipments);
    acc.qty += +p.quantity || 0;
    acc.buy += (+p.buyPrice || 0) * (+p.quantity || 0);
    acc.ship += shipPerUnit * (+p.quantity || 0);
    acc.declared += (+p.declaredPrice || 0) * (+p.quantity || 0);
    acc.sell += (+p.sellPrice || 0) * (+p.quantity || 0);
    acc.profitPerUnit += profitPerUnit;
    acc.totalProfit += totalProfit;
    return acc;
  }, { qty: 0, buy: 0, ship: 0, declared: 0, sell: 0, profitPerUnit: 0, totalProfit: 0 });

  foot.innerHTML = `
    <tr>
      <td>Tổng cộng</td>
      <td class="num">${sum.qty}</td>
      <td class="num">${fmtMoney(sum.buy)}</td>
      <td class="num">${fmtMoney(sum.ship)}</td>
      <td class="num">${fmtMoney(sum.declared)}</td>
      <td class="num">${fmtMoney(sum.sell)}</td>
      <td class="num profit-cell">${fmtMoney(sum.profitPerUnit)}</td>
      <td class="num profit-cell">${fmtMoney(sum.totalProfit)}</td>
    </tr>
  `;

  // Bind click to edit.
  $$('.row-edit', body).forEach(row => {
    row.addEventListener('click', () => openProductModal(row.dataset.id));
  });
}


// ============ Charts ============
export function renderCharts() {
  renderCompareChart();
  renderCostDonut();
}

function lastNMonthsKeys(n = 6) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push({
      key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      label: String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(),
    });
  }
  return keys;
}

function emptyOverlay(boxEl, msg) {
  // Remove any previous overlay before drawing a new one.
  const old = boxEl.querySelector('.chart-empty');
  if (old) old.remove();
  const div = document.createElement('div');
  div.className = 'chart-empty';
  div.innerHTML = `
    <div>
      <svg viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18M7 14l4-4 3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      ${msg}
    </div>
  `;
  boxEl.appendChild(div);
}

function clearEmptyOverlay(boxEl) {
  const old = boxEl.querySelector('.chart-empty');
  if (old) old.remove();
}

function renderCompareChart() {
  const canvas = $('#chartCompare');
  if (!canvas || !window.Chart) return;
  const months = lastNMonthsKeys(6);

  const { products, expenses, orders } = getState();
  // Aggregate per month — fallback to single bucket if there's no dated data.
  const capitalByMonth = {};
  const shipByMonth = {};
  const revenueByMonth = {};

  for (const e of expenses) {
    const m = (e.date || '').slice(0, 7);
    if (!m) continue;
    if (e.category === 'ship_intl' || e.category === 'ship_dom') shipByMonth[m] = (shipByMonth[m] || 0) + (+e.amount || 0);
  }
  for (const o of orders) {
    const m = (o.date || '').slice(0, 7);
    if (!m) continue;
    revenueByMonth[m] = (revenueByMonth[m] || 0) + (+o.revenue || 0);
  }

  // For products without a date, lump into the current month to give the chart *some* data.
  const currentMonth = months[months.length - 1].key;
  const fallbackCapital = products.reduce((s, p) => s + (+p.buyPrice || 0) * (+p.quantity || 0), 0);
  const fallbackShip = products.reduce((s, p) => s + (+p.shipPerUnit || 0) * (+p.quantity || 0), 0);
  const fallbackRev = products.reduce((s, p) => s + (+p.sellPrice || 0) * (+p.quantity || 0), 0);
  if (fallbackCapital) capitalByMonth[currentMonth] = (capitalByMonth[currentMonth] || 0) + fallbackCapital;
  if (!Object.keys(shipByMonth).length && fallbackShip) shipByMonth[currentMonth] = fallbackShip;
  if (!Object.keys(revenueByMonth).length && fallbackRev) revenueByMonth[currentMonth] = fallbackRev;

  const labels = months.map(m => m.label);
  const cap = months.map(m => capitalByMonth[m.key] || 0);
  const ship = months.map(m => shipByMonth[m.key] || 0);
  const rev = months.map(m => revenueByMonth[m.key] || 0);

  const datasets = [
    { label: 'Tổng vốn', data: cap, backgroundColor: '#4F7BFF', borderRadius: 6, barPercentage: 0.7, categoryPercentage: 0.7 },
    { label: 'Phí ship', data: ship, backgroundColor: '#14B8A6', borderRadius: 6, barPercentage: 0.7, categoryPercentage: 0.7 },
    { label: 'Doanh thu dự kiến', data: rev, backgroundColor: '#F59E0B', borderRadius: 6, barPercentage: 0.7, categoryPercentage: 0.7 },
  ];

  $('#legendCompare').innerHTML = datasets.map(d => `<span><i style="background:${d.backgroundColor}"></i>${d.label}</span>`).join('');

  const hasData = [...cap, ...ship, ...rev].some(v => v > 0);
  const box = canvas.parentElement;
  if (!hasData) emptyOverlay(box, 'Chưa có dữ liệu cho khoảng thời gian này');
  else clearEmptyOverlay(box);

  if (compareChart) compareChart.destroy();
  compareChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmtMoney(c.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#9CA3AF' } },
        y: { grid: { color: '#F1F3F8' }, ticks: { font: { size: 11 }, color: '#9CA3AF', callback: v => fmtShort(v) } },
      },
    },
  });
}

function renderCostDonut() {
  const canvas = $('#chartCost');
  if (!canvas || !window.Chart) return;
  const { expenses, period } = getState();
  const cats = getCategories();

  // Aggregate from period-filtered expenses, keyed by category.
  const totals = {};
  cats.forEach(c => totals[c.key] = 0);
  for (const e of expenses) {
    if (!inPeriod(e, period)) continue;
    if (totals[e.category] != null) totals[e.category] += (+e.amount || 0);
  }

  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  $('#donutTotalCost').textContent = fmtMoney(total);

  // Only chart categories with a non-zero value so the donut doesn't waste
  // arc space on zero-spend custom categories.
  const visible = cats.filter(c => (totals[c.key] || 0) > 0);
  const labels = visible.map(c => c.label);
  const data = visible.map(c => totals[c.key] || 0);
  const colors = visible.map(c => c.color);

  const box = canvas.parentElement;
  if (total <= 0) emptyOverlay(box, 'Chưa có chi phí ghi nhận');
  else clearEmptyOverlay(box);

  if (costChart) costChart.destroy();
  costChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => c.label + ': ' + fmtMoney(c.parsed) } },
      },
    },
  });

  // Legend lists every category (incl. zero-spend) so the user sees the full set.
  const legend = $('#donutLegend');
  legend.innerHTML = cats.map(c => {
    const v = totals[c.key] || 0;
    const pct = total > 0 ? (v / total) * 100 : 0;
    return `<li>
      <i style="background:${c.color}"></i>
      <span class="l-name">${escapeHtml(c.label)}</span>
      <span class="l-pct">${pct.toFixed(1)}%</span>
      <span class="l-val">${fmtMoney(v)}</span>
    </li>`;
  }).join('') + `<li style="border-top:1px solid var(--border-2); padding-top:8px; margin-top:4px;">
      <i style="visibility:hidden"></i>
      <span class="l-name" style="font-weight:600">Tổng</span>
      <span class="l-pct">100%</span>
      <span class="l-val" style="font-weight:600">${fmtMoney(total)}</span>
    </li>`;
}

// ============ Highlights ============
export function renderHighlights() {
  const { products, expenses, period, shipments } = getState();
  const target = $('#highlights');
  if (!products.length) {
    target.innerHTML = `<div class="empty"><div class="empty-sub">Thêm sản phẩm để xem thông tin nổi bật.</div></div>`;
    return;
  }

  // Top profit product (per unit).
  const enriched = products.map(p => ({ p, ...computeProductProfit(p, shipments) }));
  const top = enriched.reduce((a, b) => (a.profitPerUnit > b.profitPerUnit ? a : b));

  // Ship-on-capital ratio (use period-filtered expenses).
  const totalCapital = products.reduce((s, p) => s + (+p.buyPrice || 0) * (+p.quantity || 0), 0);
  const shipFromExpenses = expenses
    .filter(e => inPeriod(e, period) && (e.category === 'ship_intl' || e.category === 'ship_dom'))
    .reduce((s, e) => s + (+e.amount || 0), 0);
  const shipFromProducts = enriched.reduce((s, x) => s + x.shipPerUnit * (+x.p.quantity || 0), 0);
  const ship = shipFromExpenses || shipFromProducts;
  const ratio = totalCapital > 0 ? (ship / totalCapital) * 100 : 0;

  // Break-even point: revenue needed when current margin holds — simply totalCapital + totalCosts.
  const totalCosts = totalCapital + ship +
    products.reduce((s, p) => s + ((+p.taxPerUnit || 0) + (+p.packagingPerUnit || 0)) * (+p.quantity || 0), 0);

  // Per-shipment cost breakdown (US domestic vs international).
  const totalWeight = products.reduce((s, p) => {
    if (!p.shipmentId) return s;
    return s + (+p.weight || 0) * (+p.quantity || 0);
  }, 0);
  let totalUsShip = 0;
  let totalIntlShip = 0;
  for (const p of products) {
    if (!p.shipmentId) continue;
    const s = shipments.find(x => x.id === p.shipmentId);
    if (!s) continue;
    const w = (+p.weight || 0) * (+p.quantity || 0);
    totalUsShip += w * (+s.usDomesticRate || 0);
    totalIntlShip += w * (+s.intlRate || 0);
  }
  const hasShipmentData = totalWeight > 0;

  target.innerHTML = `
    <div class="highlight-row">
      <div class="highlight-icon" style="background:#FEF3C7">${trophyIcon()}</div>
      <div class="highlight-text">Mặt hàng lãi cao nhất<b>${escapeHtml(top.p.name)}</b></div>
      <div class="highlight-value">
        <div class="highlight-value-main">${fmtMoney(top.profitPerUnit)}</div>
        <div class="highlight-value-sub">lãi/đơn vị</div>
      </div>
    </div>
    ${hasShipmentData ? `
      <div class="highlight-row">
        <div class="highlight-icon" style="background:#FEF3C7">${truckIcon()}</div>
        <div class="highlight-text">Ship Mỹ → forwarder<b>${fmtMoney(totalUsShip)}</b></div>
        <div class="highlight-value">
          <div class="highlight-value-main">${totalWeight.toFixed(2)} lb</div>
          <div class="highlight-value-sub">tổng cân nặng</div>
        </div>
      </div>
      <div class="highlight-row">
        <div class="highlight-icon" style="background:#DCFCE7">${truckIcon()}</div>
        <div class="highlight-text">Ship Mỹ → Việt Nam<b>${fmtMoney(totalIntlShip)}</b></div>
        <div class="highlight-value">
          <div class="highlight-value-main">${fmtMoney(totalWeight > 0 ? totalIntlShip / totalWeight : 0)}</div>
          <div class="highlight-value-sub">trung bình / lb</div>
        </div>
      </div>
    ` : `
      <div class="highlight-row">
        <div class="highlight-icon" style="background:#E0F2FE">${percentIcon()}</div>
        <div class="highlight-text">Tỉ lệ ship trên vốn<b>${fmtPct(ratio)}</b></div>
        <div class="highlight-value">
          <div class="highlight-value-main">${fmtMoney(ship)}</div>
          <div class="highlight-value-sub">trên tổng vốn</div>
        </div>
      </div>
    `}
    <div class="highlight-row">
      <div class="highlight-icon" style="background:#F3E8FF">${targetIcon()}</div>
      <div class="highlight-text">Điểm hoà vốn (doanh thu)<b>${fmtMoney(totalCosts)}</b></div>
      <div class="highlight-value">
        <div class="highlight-value-sub">để đạt lợi nhuận = 0</div>
      </div>
    </div>
  `;
}


function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderDashboard() {
  renderKPIs();
  renderDashProductsTable();
  renderCharts();
  renderHighlights();
}

export function initDashboard() {
  $('#btnAddProductDash').addEventListener('click', () => openProductModal(null));
  renderDashboard();
}
