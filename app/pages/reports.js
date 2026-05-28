import { getState, getCategories } from '../state.js';
import { $, fmtMoney, fmtPct, fmtShort, computeProductProfit, computeShipmentCosts } from '../utils.js';

let topChart, rvcChart;

export function renderReportsPage() {
  const { products, expenses, orders, shipments } = getState();

  // KPI row.
  const revenue = products.reduce((s, p) => s + (+p.sellPrice || 0) * (+p.quantity || 0), 0);
  const orderRev = orders.reduce((s, o) => s + (+o.revenue || 0), 0);
  const profit = products.reduce((s, p) => s + computeProductProfit(p, shipments).totalProfit, 0);
  const totalCost = expenses.reduce((s, e) => s + (+e.amount || 0), 0);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  $('#reportKpis').innerHTML = `
    <div class="kpi"><div class="kpi-head"><div class="kpi-icon kpi-blue"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M3 3v18h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div></div><div class="kpi-label">Doanh thu (dự kiến)</div><div class="kpi-value">${fmtMoney(revenue)}</div></div>
    <div class="kpi"><div class="kpi-head"><div class="kpi-icon kpi-teal"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M3 3v18h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div></div><div class="kpi-label">Doanh thu thực (từ đơn hàng)</div><div class="kpi-value">${fmtMoney(orderRev)}</div></div>
    <div class="kpi"><div class="kpi-head"><div class="kpi-icon kpi-green"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></div></div><div class="kpi-label">Lợi nhuận</div><div class="kpi-value">${fmtMoney(profit)}</div></div>
    <div class="kpi"><div class="kpi-head"><div class="kpi-icon kpi-yellow"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg></div></div><div class="kpi-label">Tổng chi phí</div><div class="kpi-value">${fmtMoney(totalCost)}</div></div>
    <div class="kpi"><div class="kpi-head"><div class="kpi-icon kpi-purple"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M19 5L5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div></div><div class="kpi-label">Biên lợi nhuận</div><div class="kpi-value">${fmtPct(margin)}</div></div>
  `;

  renderTopProductsChart();
  renderRevenueVsCostChart();
}

function renderTopProductsChart() {
  const canvas = $('#chartTopProducts');
  if (!canvas || !window.Chart) return;
  const { products, shipments } = getState();

  const top = products
    .map(p => ({ name: p.name, profit: computeProductProfit(p, shipments).totalProfit }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const box = canvas.parentElement;
  const old = box.querySelector('.chart-empty'); if (old) old.remove();
  if (!top.length || top.every(t => t.profit <= 0)) {
    const div = document.createElement('div');
    div.className = 'chart-empty';
    div.innerHTML = '<div>Chưa có sản phẩm sinh lãi</div>';
    box.appendChild(div);
  }

  if (topChart) topChart.destroy();
  topChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top.map(p => p.name),
      datasets: [{ data: top.map(p => p.profit), backgroundColor: '#4F7BFF', borderRadius: 6 }],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtMoney(c.parsed.x) } } },
      scales: {
        x: { grid: { color: '#F1F3F8' }, ticks: { callback: v => fmtShort(v), color: '#9CA3AF', font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { color: '#6B7280', font: { size: 12 } } },
      },
    },
  });
}

function renderRevenueVsCostChart() {
  const canvas = $('#chartRevenueVsCost');
  if (!canvas || !window.Chart) return;
  const { products, expenses } = getState();
  const revenue = products.reduce((s, p) => s + (+p.sellPrice || 0) * (+p.quantity || 0), 0);

  const totals = {};
  getCategories().forEach(c => totals[c.key] = 0);
  for (const e of expenses) if (totals[e.category] != null) totals[e.category] += +e.amount || 0;
  const totalCost = Object.values(totals).reduce((s, v) => s + v, 0);
  const profit = Math.max(0, revenue - totalCost);

  const box = canvas.parentElement;
  const old = box.querySelector('.chart-empty'); if (old) old.remove();
  if (revenue <= 0 && totalCost <= 0) {
    const div = document.createElement('div');
    div.className = 'chart-empty';
    div.innerHTML = '<div>Chưa có dữ liệu doanh thu / chi phí</div>';
    box.appendChild(div);
  }

  if (rvcChart) rvcChart.destroy();
  rvcChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Lợi nhuận', 'Chi phí'],
      datasets: [{ data: [profit, totalCost], backgroundColor: ['#10B981', '#F59E0B'], borderColor: '#fff', borderWidth: 2 }],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } }, tooltip: { callbacks: { label: c => c.label + ': ' + fmtMoney(c.parsed) } } },
    },
  });
}

// Export current state to an Excel file (multi-sheet).
export function exportExcel() {
  if (!window.XLSX) { alert('Thư viện XLSX chưa tải xong, vui lòng thử lại.'); return; }
  const { products, expenses, orders, shopName, period, shipments } = getState();

  const wb = XLSX.utils.book_new();

  // Sheet 1 — Summary
  const revenue = products.reduce((s, p) => s + (+p.sellPrice || 0) * (+p.quantity || 0), 0);
  const profit = products.reduce((s, p) => s + computeProductProfit(p, shipments).totalProfit, 0);
  const capital = products.reduce((s, p) => s + (+p.buyPrice || 0) * (+p.quantity || 0), 0);
  const totalCost = expenses.reduce((s, e) => s + (+e.amount || 0), 0);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const summary = [
    ['Báo cáo', shopName],
    ['Kỳ báo cáo', `${period.start} – ${period.end}`],
    [],
    ['Chỉ số', 'Giá trị'],
    ['Tổng vốn', capital],
    ['Doanh thu dự kiến', revenue],
    ['Tổng chi phí (đã ghi nhận)', totalCost],
    ['Lợi nhuận', profit],
    ['Biên lợi nhuận (%)', Number(margin.toFixed(2))],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Tổng quan');

  // Sheet 2 — Products
  const prodHeader = ['Sản phẩm', 'SL', 'Cân nặng (lb)', 'Lô hàng', 'Giá nhập', 'Ship/đv', 'Thuế/đv', 'Đóng gói/đv', 'Giá khai báo', 'Giá bán', 'Lãi/đv', 'Tổng lãi'];
  const prodRows = products.map(p => {
    const { profitPerUnit, totalProfit, shipPerUnit } = computeProductProfit(p, shipments);
    const shipment = shipments.find(s => s.id === p.shipmentId);
    return [p.name, +p.quantity || 0, +p.weight || 0, shipment ? shipment.code + ' · ' + shipment.name : '', +p.buyPrice || 0, shipPerUnit, +p.taxPerUnit || 0, +p.packagingPerUnit || 0, +p.declaredPrice || 0, +p.sellPrice || 0, profitPerUnit, totalProfit];
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([prodHeader, ...prodRows]), 'Sản phẩm');

  // Sheet 2b — Shipments (5-cost breakdown + landed cost + profit)
  if (shipments.length) {
    const shipHeader = ['Mã lô', 'Tên', 'Ngày', 'Nhập hàng', 'Đóng gói', 'Ship nội địa', 'Bảo hiểm', 'Ship quốc tế', 'Giá vốn', 'Giá bán', 'Lợi nhuận'];
    const shipRows = shipments.map(s => {
      const c = computeShipmentCosts(s);
      return [s.code, s.name, s.date, c.purchase, c.packaging, c.domestic, c.insurance, c.intl, c.landed, c.sell, c.profit];
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([shipHeader, ...shipRows]), 'Lô hàng');
  }

  // Sheet 3 — Expenses
  const expHeader = ['Ngày', 'Phân loại', 'Mô tả', 'Số tiền'];
  const expRows = expenses.map(e => {
    const cat = getCategories().find(c => c.key === e.category)?.label || e.category;
    return [e.date, cat, e.note || '', +e.amount || 0];
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([expHeader, ...expRows]), 'Chi phí');

  // Sheet 4 — Orders
  const ordHeader = ['Mã đơn', 'Ngày', 'Khách hàng', 'Sản phẩm', 'SL', 'Doanh thu', 'Trạng thái'];
  const ordRows = orders.map(o => {
    const p = products.find(x => x.id === o.productId);
    return [o.code, o.date, o.customerName, p?.name || '', +o.quantity || 0, +o.revenue || 0, o.status];
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ordHeader, ...ordRows]), 'Đơn hàng');

  const filename = `bao-cao-${shopName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function initReports() {
  $('#btnExportReport').addEventListener('click', exportExcel);
}
