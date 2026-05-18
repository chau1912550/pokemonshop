import { getState, addOrder, updateOrder, deleteOrder, ORDER_STATUSES } from '../state.js';
import { $, $$, fmtMoney, fmtDateVN, parseNumber, attachNumberInput, toast, confirmAction, currencySymbol, formatMoneyInput } from '../utils.js';
import { openModal } from '../modal.js';

export function renderOrdersPage() {
  const { orders, products } = getState();

  // KPIs.
  const total = orders.length;
  const pending = orders.filter(o => o.status === 'pending').length;
  const done = orders.filter(o => o.status === 'done').length;
  const revenue = orders.reduce((s, o) => s + (+o.revenue || 0), 0);

  $('#orderKpis').innerHTML = `
    <div class="kpi"><div class="kpi-head"><div class="kpi-icon kpi-blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 5H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div></div><div class="kpi-label">Tổng đơn</div><div class="kpi-value">${total}</div></div>
    <div class="kpi"><div class="kpi-head"><div class="kpi-icon kpi-yellow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div></div><div class="kpi-label">Chờ xử lý</div><div class="kpi-value">${pending}</div></div>
    <div class="kpi"><div class="kpi-head"><div class="kpi-icon kpi-green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><div class="kpi-label">Hoàn tất</div><div class="kpi-value">${done}</div></div>
    <div class="kpi"><div class="kpi-head"><div class="kpi-icon kpi-purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div></div><div class="kpi-label">Tổng doanh thu</div><div class="kpi-value">${fmtMoney(revenue)}</div></div>
  `;

  // Table.
  const body = $('#ordersBody');
  if (!orders.length) {
    body.innerHTML = `<tr><td colspan="8"><div class="empty">
      <div class="empty-title">Chưa có đơn hàng</div>
      <div class="empty-sub">Bấm "Thêm đơn hàng" để bắt đầu.</div>
    </div></td></tr>`;
    return;
  }

  const sorted = [...orders].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  body.innerHTML = sorted.map(o => {
    const status = ORDER_STATUSES.find(s => s.key === o.status) || ORDER_STATUSES[0];
    const product = products.find(p => p.id === o.productId);
    return `
      <tr data-id="${o.id}">
        <td>${o.code}</td>
        <td>${fmtDateVN(o.date)}</td>
        <td>${escapeHtml(o.customerName || '')}</td>
        <td>${product ? escapeHtml(product.name) : '<span style="color:var(--text-3)">—</span>'}</td>
        <td class="num">${o.quantity || 0}</td>
        <td class="num">${fmtMoney(o.revenue)}</td>
        <td><span class="pill ${status.cls}">${status.label}</span></td>
        <td class="num">
          <div class="row-actions">
            <button class="icon-btn act-edit" title="Sửa"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="icon-btn act-del" title="Xoá"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  $$('.act-edit', body).forEach(b => b.addEventListener('click', () => openOrderModal(b.closest('tr').dataset.id)));
  $$('.act-del', body).forEach(b => b.addEventListener('click', () => {
    const id = b.closest('tr').dataset.id;
    if (confirmAction('Xoá đơn hàng này?')) {
      deleteOrder(id);
      toast('Đã xoá');
    }
  }));
}

function openOrderModal(id = null) {
  const { products } = getState();
  const item = id ? getState().orders.find(o => o.id === id) : null;
  const today = new Date().toISOString().slice(0, 10);
  const data = item || { date: today, customerName: '', productId: products[0]?.id || '', quantity: 1, revenue: 0, status: 'pending' };

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="form-grid">
      <label class="form-field"><span>Ngày *</span><input type="date" data-f="date" value="${data.date}"></label>
      <label class="form-field"><span>Trạng thái</span>
        <select data-f="status">
          ${ORDER_STATUSES.map(s => `<option value="${s.key}" ${s.key === data.status ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </label>
      <label class="form-field" style="grid-column: span 2"><span>Khách hàng</span><input type="text" data-f="customerName" value="${escapeHtml(data.customerName || '')}" placeholder="Tên khách / SĐT"></label>
      <label class="form-field"><span>Sản phẩm</span>
        <select data-f="productId">
          <option value="">— Chọn sản phẩm —</option>
          ${products.map(p => `<option value="${p.id}" ${p.id === data.productId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </label>
      <label class="form-field"><span>Số lượng</span><input type="number" min="1" data-f="quantity" value="${data.quantity}"></label>
      <label class="form-field" style="grid-column: span 2"><span>Doanh thu (${currencySymbol()}) *</span><input type="text" inputmode="decimal" data-f="revenue" data-money value="${formatMoneyInput(+data.revenue || 0)}" placeholder="0"></label>
    </div>
    <div class="form-hint">Chọn sản phẩm sẽ tự điền doanh thu = Giá bán × Số lượng. Bạn có thể chỉnh tay sau đó.</div>
  `;
  $$('input[data-money]', body).forEach(inp => attachNumberInput(inp));

  // Auto-fill revenue when product changes.
  const productSel = $('select[data-f="productId"]', body);
  const qtyInput = $('input[data-f="quantity"]', body);
  const revInput = $('input[data-f="revenue"]', body);
  const autoFill = () => {
    const p = products.find(x => x.id === productSel.value);
    if (!p) return;
    const qty = +qtyInput.value || 1;
    revInput.value = formatMoneyInput((+p.sellPrice || 0) * qty);
  };
  productSel.addEventListener('change', autoFill);
  qtyInput.addEventListener('input', autoFill);

  openModal({
    title: id ? 'Sửa đơn hàng' : 'Thêm đơn hàng',
    body,
    submitLabel: id ? 'Cập nhật' : 'Thêm',
    onSubmit: () => {
      const payload = {
        date: $('input[data-f="date"]', body).value,
        status: $('select[data-f="status"]', body).value,
        customerName: $('input[data-f="customerName"]', body).value.trim(),
        productId: $('select[data-f="productId"]', body).value,
        quantity: +$('input[data-f="quantity"]', body).value || 1,
        revenue: parseNumber($('input[data-f="revenue"]', body).value),
      };
      if (!payload.revenue) { toast('Vui lòng nhập doanh thu'); return false; }
      if (id) { updateOrder(id, payload); toast('Đã cập nhật'); }
      else { addOrder(payload); toast('Đã thêm đơn hàng'); }
    },
  });
}

export function initOrders() {
  $('#btnAddOrder').addEventListener('click', () => openOrderModal(null));
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
