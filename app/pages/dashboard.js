import { getState } from '../state.js';
import { $, $$, fmtMoney, fmtPct, computeShipmentCosts, SHIPMENT_COST_KEYS } from '../utils.js';
import { openShipmentModal } from './shipments.js';

let costChart;

// ============ KPI cards ============
function walletIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M3 10V7a2 2 0 012-2h12a2 2 0 012 2v3M3 10v8a2 2 0 002 2h14a2 2 0 002-2v-8M3 10h18M17 14h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
function chartIcon()  { return '<svg viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18M7 14l4-4 3 3 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function moneyIcon()  { return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l2 3h5l-3 3 1 5-5-3-5 3 1-5-3-3h5l2-3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="14" r="3" stroke="currentColor" stroke-width="1.6"/></svg>'; }
function pieIcon()    { return '<svg viewBox="0 0 24 24" fill="none"><path d="M21 12A9 9 0 1112 3v9h9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; }
function trophyIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 22h4M12 17v-3M8 4h8v6a4 4 0 11-8 0V4zM8 6H5v2a3 3 0 003 3M16 6h3v2a3 3 0 01-3 3" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function percentIcon(){ return '<svg viewBox="0 0 24 24" fill="none"><path d="M19 5L5 19M7 8a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z" stroke="#0EA5E9" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
function truckIcon()  { return '<svg viewBox="0 0 24 24" fill="none"><path d="M1 12h11v6H1zM12 8h5l4 4v6h-9V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'; }

// Aggregate all shipments into one cost/profit summary.
function aggregate() {
  const { shipments } = getState();
  const stats = shipments.map(s => ({ s, c: computeShipmentCosts(s) }));
  const sum = { purchase: 0, packaging: 0, domestic: 0, insurance: 0, intl: 0, landed: 0, sell: 0, profit: 0 };
  for (const { c } of stats) {
    sum.purchase  += c.purchase;
    sum.packaging += c.packaging;
    sum.domestic  += c.domestic;
    sum.insurance += c.insurance;
    sum.intl      += c.intl;
    sum.landed    += c.landed;
    sum.sell      += c.sell;
    sum.profit    += c.profit;
  }
  sum.margin = sum.sell > 0 ? (sum.profit / sum.sell) * 100 : 0;
  return { stats, sum };
}

export function renderKPIs() {
  const { sum } = aggregate();
  const defs = [
    { label: 'Tổng giá vốn',        value: fmtMoney(sum.landed), tone: 'kpi-blue',   icon: walletIcon },
    { label: 'Giá bán dự kiến',     value: fmtMoney(sum.sell),   tone: 'kpi-teal',   icon: chartIcon  },
    { label: 'Lợi nhuận dự kiến',   value: fmtMoney(sum.profit), tone: 'kpi-green',  icon: moneyIcon  },
    { label: 'Biên lợi nhuận',      value: fmtPct(sum.margin),   tone: 'kpi-purple', icon: pieIcon    },
  ];
  const grid = $('#kpiGrid');
  grid.innerHTML = defs.map(d => `
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon ${d.tone}">${d.icon()}</div></div>
      <div class="kpi-label">${d.label}</div>
      <div class="kpi-value">${d.value}</div>
    </div>
  `).join('');
}

// ============ Shipments breakdown table ============
export function renderDashShipmentsTable() {
  const { stats, sum } = aggregate();
  const body = $('#dashShipmentsBody');
  const foot = $('#dashShipmentsFoot');

  if (!stats.length) {
    body.innerHTML = `<tr><td colspan="9"><div class="empty">
      <div class="empty-title">Chưa có lô hàng</div>
      <div class="empty-sub">Bấm "Thêm lô hàng" để nhập 5 khoản chi phí cho lô đầu tiên.</div>
    </div></td></tr>`;
    foot.innerHTML = '';
    return;
  }

  const sorted = [...stats].sort((a, b) => (b.s.date || '').localeCompare(a.s.date || ''));
  body.innerHTML = sorted.map(({ s, c }) => `
    <tr data-id="${s.id}" class="row-edit" title="Bấm để sửa">
      <td><b>${escapeHtml(s.name || s.code)}</b></td>
      <td class="num">${fmtMoney(c.purchase)}</td>
      <td class="num">${fmtMoney(c.packaging)}</td>
      <td class="num">${fmtMoney(c.domestic)}</td>
      <td class="num">${fmtMoney(c.insurance)}</td>
      <td class="num">${fmtMoney(c.intl)}</td>
      <td class="num" style="font-weight:600">${fmtMoney(c.landed)}</td>
      <td class="num">${fmtMoney(c.sell)}</td>
      <td class="num profit-cell" style="color:${c.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtMoney(c.profit)}</td>
    </tr>
  `).join('');

  foot.innerHTML = `
    <tr>
      <td>Tổng cộng</td>
      <td class="num">${fmtMoney(sum.purchase)}</td>
      <td class="num">${fmtMoney(sum.packaging)}</td>
      <td class="num">${fmtMoney(sum.domestic)}</td>
      <td class="num">${fmtMoney(sum.insurance)}</td>
      <td class="num">${fmtMoney(sum.intl)}</td>
      <td class="num" style="font-weight:700">${fmtMoney(sum.landed)}</td>
      <td class="num">${fmtMoney(sum.sell)}</td>
      <td class="num profit-cell" style="color:${sum.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtMoney(sum.profit)}</td>
    </tr>
  `;

  $$('.row-edit', body).forEach(row => row.addEventListener('click', () => openShipmentModal(row.dataset.id)));
}

// ============ Cost donut (5 categories) ============
export function renderCostDonut() {
  const canvas = $('#chartCost');
  if (!canvas || !window.Chart) return;
  const { sum } = aggregate();

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
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => c.label + ': ' + fmtMoney(c.parsed) } },
      },
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
  const { stats, sum } = aggregate();
  const target = $('#highlights');
  if (!stats.length) {
    target.innerHTML = `<div class="empty"><div class="empty-sub">Thêm lô hàng để xem thông tin nổi bật.</div></div>`;
    return;
  }

  // Most profitable shipment.
  const top = stats.reduce((a, b) => (a.c.profit > b.c.profit ? a : b));
  // Ship cost (domestic + intl) ratio over purchase cost.
  const shipTotal = sum.domestic + sum.intl;
  const shipRatio = sum.purchase > 0 ? (shipTotal / sum.purchase) * 100 : 0;

  target.innerHTML = `
    <div class="highlight-row">
      <div class="highlight-icon" style="background:#FEF3C7">${trophyIcon()}</div>
      <div class="highlight-text">Lô lãi cao nhất<b>${escapeHtml(top.s.name || top.s.code)}</b></div>
      <div class="highlight-value">
        <div class="highlight-value-main">${fmtMoney(top.c.profit)}</div>
        <div class="highlight-value-sub">lợi nhuận</div>
      </div>
    </div>
    <div class="highlight-row">
      <div class="highlight-icon" style="background:#E0F2FE">${truckIcon()}</div>
      <div class="highlight-text">Tổng phí ship (nội địa + quốc tế)<b>${fmtMoney(shipTotal)}</b></div>
      <div class="highlight-value">
        <div class="highlight-value-main">${fmtPct(shipRatio)}</div>
        <div class="highlight-value-sub">trên tiền hàng</div>
      </div>
    </div>
    <div class="highlight-row">
      <div class="highlight-icon" style="background:#F3E8FF">${percentIcon()}</div>
      <div class="highlight-text">Biên lợi nhuận trung bình<b>${fmtPct(sum.margin)}</b></div>
      <div class="highlight-value">
        <div class="highlight-value-main">${fmtMoney(sum.profit)}</div>
        <div class="highlight-value-sub">tổng lợi nhuận</div>
      </div>
    </div>
  `;
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderDashboard() {
  renderKPIs();
  renderDashShipmentsTable();
  renderCostDonut();
  renderHighlights();
}

export function initDashboard() {
  $('#btnAddShipmentDash').addEventListener('click', () => openShipmentModal(null));
  renderDashboard();
}
