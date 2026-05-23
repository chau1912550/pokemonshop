import { getState, addExpense, updateExpense, deleteExpense, getCategories } from '../state.js';
import { $, $$, fmtMoney, fmtDateVN, parseNumber, attachNumberInput, toast, confirmAction, currencySymbol, formatMoneyInput } from '../utils.js';
import { openModal } from '../modal.js';

let _filterShipmentId = '';   // '' = show all, or a shipment id to filter

export function renderExpensesPage() {
  const { expenses, shipments } = getState();

  // ── KPI cards ──────────────────────────────────────────────────────────────
  const cats = getCategories();
  const totals = {};
  cats.forEach(c => totals[c.key] = 0);
  let grandTotal = 0;
  for (const e of expenses) {
    if (totals[e.category] != null) totals[e.category] += +e.amount || 0;
    grandTotal += +e.amount || 0;
  }

  const topCats = [...cats].sort((a, b) => (totals[b.key] || 0) - (totals[a.key] || 0)).slice(0, 3);
  const kpis = $('#expenseKpis');
  kpis.innerHTML = `
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon kpi-blue">
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
          <path d="M3 10V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2v-3" stroke="currentColor" stroke-width="1.8"/>
        </svg>
      </div></div>
      <div class="kpi-label">Tổng chi phí</div>
      <div class="kpi-value">${fmtMoney(grandTotal)}</div>
    </div>
    ${topCats.map(c => `
      <div class="kpi">
        <div class="kpi-head"><div class="kpi-icon" style="background:${hexToBg(c.color)}; color:${c.color}">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg>
        </div></div>
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${fmtMoney(totals[c.key] || 0)}</div>
      </div>`).join('')}
  `;

  // ── Shipment filter bar ────────────────────────────────────────────────────
  const filterBar = $('#expenseShipFilter');
  if (filterBar) {
    filterBar.innerHTML = `
      <span class="exp-filter-label">Lọc theo lô:</span>
      <select id="expFilterSel" class="exp-filter-sel">
        <option value="">Tất cả</option>
        ${shipments.map(s => `<option value="${s.id}" ${s.id === _filterShipmentId ? 'selected' : ''}>${escapeHtml(s.code + ' · ' + s.name)}</option>`).join('')}
      </select>
      ${_filterShipmentId ? `<button class="btn btn-ghost btn-sm" id="expFilterClear">✕ Bỏ lọc</button>` : ''}
    `;
    $('#expFilterSel')?.addEventListener('change', e => {
      _filterShipmentId = e.target.value;
      renderExpensesPage();
    });
    $('#expFilterClear')?.addEventListener('click', () => {
      _filterShipmentId = '';
      renderExpensesPage();
    });
  }

  // ── Table ──────────────────────────────────────────────────────────────────
  const body = $('#expensesBody');
  const allCats = getCategories();

  // Apply shipment filter
  const filtered = _filterShipmentId
    ? expenses.filter(e => e.shipmentId === _filterShipmentId)
    : expenses;

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty">
      <div class="empty-title">${_filterShipmentId ? 'Không có chi phí cho lô này' : 'Chưa có chi phí'}</div>
      <div class="empty-sub">${_filterShipmentId ? 'Thêm chi phí và gán vào lô hàng này.' : 'Bấm "Thêm chi phí" để ghi nhận các khoản ship, thuế, đóng gói...'}</div>
    </div></td></tr>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  body.innerHTML = sorted.map(e => {
    const cat = allCats.find(c => c.key === e.category) || { label: e.category || '(không phân loại)', color: '#94A3B8' };
    const ship = e.shipmentId ? shipments.find(s => s.id === e.shipmentId) : null;
    return `
      <tr data-id="${e.id}">
        <td>${fmtDateVN(e.date)}</td>
        <td><span class="cat-pill" style="background:${hexToBg(cat.color)}; color:${cat.color}">${cat.label}</span></td>
        <td>${escapeHtml(e.note || '')}</td>
        <td>
          ${ship
            ? `<span class="ship-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M1 12h11v6H1zM12 8h5l4 4v6h-9V8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>${escapeHtml(ship.code)}</span>`
            : `<span class="muted-dash">—</span>`}
        </td>
        <td class="num">${fmtMoney(e.amount)}</td>
        <td class="num">
          <div class="row-actions">
            <button class="icon-btn act-edit" title="Sửa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="icon-btn act-del" title="Xoá">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  $$('.act-edit', body).forEach(b => b.addEventListener('click', () => openExpenseModal(b.closest('tr').dataset.id)));
  $$('.act-del', body).forEach(b => b.addEventListener('click', () => {
    const id = b.closest('tr').dataset.id;
    if (confirmAction('Xoá khoản chi phí này?')) {
      deleteExpense(id);
      toast('Đã xoá');
    }
  }));
}

function openExpenseModal(id = null) {
  const cats = getCategories();
  const { shipments } = getState();
  const item = id ? getState().expenses.find(e => e.id === id) : null;
  const today = new Date().toISOString().slice(0, 10);
  const data = item || { date: today, category: cats[0]?.key || '', amount: 0, note: '', shipmentId: '' };
  const sym = currencySymbol();

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="form-grid">
      <label class="form-field"><span>Ngày *</span>
        <input type="date" data-f="date" value="${data.date}">
      </label>
      <label class="form-field"><span>Phân loại *</span>
        <select data-f="category">
          ${cats.map(c => `<option value="${c.key}" ${c.key === data.category ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
        </select>
      </label>
      <label class="form-field" style="grid-column: span 2">
        <span>Số tiền (${sym}) *</span>
        <input type="text" inputmode="decimal" data-f="amount" data-money
               value="${formatMoneyInput(+data.amount || 0)}" placeholder="0">
      </label>
      <label class="form-field" style="grid-column: span 2">
        <span>Mô tả</span>
        <input type="text" data-f="note" value="${escapeHtml(data.note || '')}"
               placeholder="Ví dụ: Phí ship lô hàng tháng 5">
      </label>
      <label class="form-field" style="grid-column: span 2">
        <span>Thuộc lô hàng <small style="color:var(--text-3)">(tuỳ chọn)</small></span>
        <select data-f="shipmentId">
          <option value="">— Không gán lô —</option>
          ${shipments.map(s => `<option value="${s.id}" ${s.id === (data.shipmentId || '') ? 'selected' : ''}>${escapeHtml(s.code + ' · ' + s.name)}</option>`).join('')}
        </select>
      </label>
    </div>
  `;
  $$('input[data-money]', body).forEach(inp => attachNumberInput(inp));

  openModal({
    title: id ? 'Sửa chi phí' : 'Thêm chi phí',
    body,
    submitLabel: id ? 'Cập nhật' : 'Thêm',
    onSubmit: () => {
      const payload = {
        date:       $('input[data-f="date"]', body).value,
        category:   $('select[data-f="category"]', body).value,
        amount:     parseNumber($('input[data-f="amount"]', body).value),
        note:       $('input[data-f="note"]', body).value.trim(),
        shipmentId: $('select[data-f="shipmentId"]', body).value,
      };
      if (!payload.amount) { toast('Vui lòng nhập số tiền'); return false; }
      if (id) { updateExpense(id, payload); toast('Đã cập nhật'); }
      else    { addExpense(payload);        toast('Đã thêm chi phí'); }
    },
  });
}

export function initExpenses() {
  $('#btnAddExpense').addEventListener('click', () => openExpenseModal(null));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToBg(hex) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  const mix = c => Math.round(c + (255 - c) * 0.85);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
