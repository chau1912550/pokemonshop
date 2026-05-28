import { getState, addShipment, updateShipment, deleteShipment } from '../state.js';
import {
  $, $$, fmtMoney, fmtPct, fmtDateVN, parseNumber, attachNumberInput, toast, confirmAction,
  currencySymbol, formatMoneyInput, debounce, computeShipmentCosts,
} from '../utils.js';
import { openModal } from '../modal.js';

export function renderShipmentsPage() {
  const { shipments } = getState();

  // ===== KPIs =====
  const stats = shipments.map(s => computeShipmentCosts(s));
  const totalLanded = stats.reduce((a, s) => a + s.landed, 0);
  const totalSell   = stats.reduce((a, s) => a + s.sell, 0);
  const totalProfit = stats.reduce((a, s) => a + s.profit, 0);

  $('#shipmentKpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon kpi-blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M1 12h11v6H1zM12 8h5l4 4v6h-9V8z" stroke="currentColor" stroke-width="1.6"/></svg></div></div>
      <div class="kpi-label">Số lô hàng</div>
      <div class="kpi-value">${shipments.length}</div>
    </div>
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon kpi-yellow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 10V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2v-3" stroke="currentColor" stroke-width="1.8"/></svg></div></div>
      <div class="kpi-label">Tổng giá vốn</div>
      <div class="kpi-value">${fmtMoney(totalLanded)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon kpi-teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18M7 14l4-4 3 3 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
      <div class="kpi-label">Tổng giá bán dự kiến</div>
      <div class="kpi-value">${fmtMoney(totalSell)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon kpi-green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/></svg></div></div>
      <div class="kpi-label">Tổng lợi nhuận</div>
      <div class="kpi-value">${fmtMoney(totalProfit)}</div>
    </div>
  `;

  // ===== Table =====
  const body = $('#shipmentsBody');
  if (!shipments.length) {
    body.innerHTML = `<tr><td colspan="12"><div class="empty">
      <div class="empty-title">Chưa có lô hàng</div>
      <div class="empty-sub">Bấm "Thêm lô hàng" — mỗi lô nhập 5 khoản chi phí trực tiếp.</div>
    </div></td></tr>`;
    return;
  }

  const sorted = [...shipments].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  body.innerHTML = sorted.map(s => {
    const c = computeShipmentCosts(s);
    return `
      <tr data-id="${s.id}">
        <td><code style="font-size:12px">${s.code}</code></td>
        <td>${escapeHtml(s.name || '')}</td>
        <td>${fmtDateVN(s.date)}</td>
        <td class="num">${fmtMoney(c.purchase)}</td>
        <td class="num">${fmtMoney(c.packaging)}</td>
        <td class="num">${fmtMoney(c.domestic)}</td>
        <td class="num">${fmtMoney(c.insurance)}${s.insurancePct ? ` <small style="color:var(--text-3)">${(+s.insurancePct).toLocaleString()}%</small>` : ''}</td>
        <td class="num">${fmtMoney(c.intl)}${c.weight ? ` <small style="color:var(--text-3)">${c.weight}lb</small>` : ''}</td>
        <td class="num" style="font-weight:600">${fmtMoney(c.landed)}</td>
        <td class="num">${fmtMoney(c.sell)}</td>
        <td class="num profit-cell" style="color:${c.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtMoney(c.profit)}</td>
        <td class="num">
          <div class="row-actions">
            <button class="icon-btn act-edit" title="Sửa"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="icon-btn act-del" title="Xoá"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  $$('.act-edit', body).forEach(b => b.addEventListener('click', () => openShipmentModal(b.closest('tr').dataset.id)));
  $$('.act-del', body).forEach(b => b.addEventListener('click', () => {
    const id = b.closest('tr').dataset.id;
    const s = getState().shipments.find(x => x.id === id);
    if (!s) return;
    if (confirmAction(`Xoá lô "${s.code} - ${s.name}"?`)) {
      deleteShipment(id);
      toast('Đã xoá lô hàng');
    }
  }));
}

export function openShipmentModal(id = null) {
  const item = id ? getState().shipments.find(s => s.id === id) : null;
  const today = new Date().toISOString().slice(0, 10);
  const data = item || {
    name: '', date: today,
    purchaseCost: 0, packagingCost: 0, domesticShip: 0,
    insurancePct: 0, weight: 0, intlRate: 0, sellPrice: 0, notes: '',
  };
  const sym = currencySymbol();

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="form-grid">
      <div class="form-section"><div class="form-section-title">Thông tin lô</div></div>
      <label class="form-field" style="grid-column: span 2"><span>Tên lô hàng *</span>
        <input type="text" data-f="name" value="${escapeHtml(data.name)}" placeholder="Ví dụ: Lô tháng 5 - TCGplayer" required></label>
      <label class="form-field" style="grid-column: span 2"><span>Ngày nhập</span>
        <input type="date" data-f="date" value="${data.date}"></label>

      <div class="form-section"><div class="form-section-title">Chi phí lô hàng</div></div>
      <label class="form-field"><span>1. Số tiền nhập hàng (${sym})</span>
        <input type="text" inputmode="decimal" data-f="purchaseCost" data-money value="${formatMoneyInput(+data.purchaseCost || 0)}" placeholder="0"></label>
      <label class="form-field"><span>2. Đóng gói (${sym})</span>
        <input type="text" inputmode="decimal" data-f="packagingCost" data-money value="${formatMoneyInput(+data.packagingCost || 0)}" placeholder="0"></label>
      <label class="form-field"><span>3. Ship nội địa Mỹ (${sym})</span>
        <input type="text" inputmode="decimal" data-f="domesticShip" data-money value="${formatMoneyInput(+data.domesticShip || 0)}" placeholder="0"></label>
      <label class="form-field"><span>4. Bảo hiểm (% của tiền hàng)</span>
        <div class="input-with-suffix"><input type="text" inputmode="decimal" data-f="insurancePct" autocomplete="off" value="${(+data.insurancePct || 0) ? formatMoneyInput(+data.insurancePct) : ''}" placeholder="0"><b>%</b></div></label>

      <div class="form-section"><div class="form-section-title">5. Ship quốc tế (cân × đơn giá)</div></div>
      <label class="form-field"><span>Trọng lượng (lb)</span>
        <div class="input-with-suffix"><input type="text" inputmode="decimal" data-f="weight" autocomplete="off" value="${(+data.weight || 0) ? formatMoneyInput(+data.weight) : ''}" placeholder="0"><b>lb</b></div></label>
      <label class="form-field"><span>Đơn giá ship US→VN (${sym} / lb)</span>
        <div class="input-with-suffix"><input type="text" inputmode="decimal" data-f="intlRate" autocomplete="off" value="${(+data.intlRate || 0) ? formatMoneyInput(+data.intlRate) : ''}" placeholder="0"><b class="cur-suffix">${sym}</b></div></label>

      <div class="form-section"><div class="form-section-title">Giá bán &amp; lợi nhuận</div></div>
      <label class="form-field" style="grid-column: span 2"><span>Giá bán dự kiến cả lô (${sym})</span>
        <input type="text" inputmode="decimal" data-f="sellPrice" data-money value="${formatMoneyInput(+data.sellPrice || 0)}" placeholder="0"></label>

      <label class="form-field" style="grid-column: span 2"><span>Ghi chú</span>
        <textarea data-f="notes" rows="2" placeholder="Ví dụ: forwarder Speed-Shipping, chờ xác nhận oversize">${escapeHtml(data.notes || '')}</textarea></label>
    </div>
    <div class="nb-recap" id="shipRecap"></div>
  `;
  $$('input[data-money]', body).forEach(inp => attachNumberInput(inp));
  attachNumberInput($('input[data-f="insurancePct"]', body));
  attachNumberInput($('input[data-f="weight"]', body));
  attachNumberInput($('input[data-f="intlRate"]', body));

  // Live cost recap inside the modal.
  const recap = $('#shipRecap', body);
  function readForm() {
    return {
      purchaseCost: parseNumber($('input[data-f="purchaseCost"]', body).value),
      packagingCost: parseNumber($('input[data-f="packagingCost"]', body).value),
      domesticShip: parseNumber($('input[data-f="domesticShip"]', body).value),
      insurancePct: parseNumber($('input[data-f="insurancePct"]', body).value),
      weight: parseNumber($('input[data-f="weight"]', body).value),
      intlRate: parseNumber($('input[data-f="intlRate"]', body).value),
      sellPrice: parseNumber($('input[data-f="sellPrice"]', body).value),
    };
  }
  function updateRecap() {
    const c = computeShipmentCosts(readForm());
    recap.innerHTML = `
      <div class="nb-recap-row"><span>1. Nhập hàng</span><b>${fmtMoney(c.purchase)}</b></div>
      <div class="nb-recap-row"><span>2. Đóng gói</span><b>${fmtMoney(c.packaging)}</b></div>
      <div class="nb-recap-row"><span>3. Ship nội địa</span><b>${fmtMoney(c.domestic)}</b></div>
      <div class="nb-recap-row"><span>4. Bảo hiểm</span><b>${fmtMoney(c.insurance)}</b></div>
      <div class="nb-recap-row"><span>5. Ship quốc tế ${c.weight ? `(${c.weight}lb × ${fmtMoney(c.intlRate)})` : ''}</span><b>${fmtMoney(c.intl)}</b></div>
      <div class="nb-recap-row nb-recap-total"><span>Tổng giá vốn</span><b>${fmtMoney(c.landed)}</b></div>
      <div class="nb-recap-row"><span>Giá bán dự kiến</span><b>${fmtMoney(c.sell)}</b></div>
      <div class="nb-recap-row nb-recap-profit"><span>Lợi nhuận dự kiến</span><b style="color:${c.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtMoney(c.profit)} ${c.sell > 0 ? `(${fmtPct(c.margin)})` : ''}</b></div>
    `;
  }
  $$('input', body).forEach(inp => inp.addEventListener('input', debounce(updateRecap, 60)));
  updateRecap();

  openModal({
    title: id ? 'Sửa lô hàng' : 'Thêm lô hàng',
    body,
    submitLabel: id ? 'Cập nhật' : 'Thêm',
    onSubmit: () => {
      const f = readForm();
      const payload = {
        name: $('input[data-f="name"]', body).value.trim(),
        date: $('input[data-f="date"]', body).value,
        notes: $('textarea[data-f="notes"]', body).value.trim(),
        ...f,
      };
      if (!payload.name) { toast('Vui lòng nhập tên lô hàng'); return false; }
      if (id) { updateShipment(id, payload); toast('Đã cập nhật lô hàng'); }
      else { addShipment(payload); toast('Đã thêm lô hàng'); }
    },
  });
}

// ===== Quick weight-based shipping calculator =====
function readShipCalc() {
  return {
    weight: parseNumber($('input[data-shipcalc="weight"]').value),
    usRate: parseNumber($('input[data-shipcalc="usRate"]').value),
    intlRate: parseNumber($('input[data-shipcalc="intlRate"]').value),
    quantity: parseNumber($('input[data-shipcalc="quantity"]').value) || 1,
  };
}

function updateShipCalc() {
  const v = readShipCalc();
  const usCost = v.weight * v.usRate;
  const intlCost = v.weight * v.intlRate;
  const totalCost = usCost + intlCost;
  const perUnit = v.quantity > 0 ? totalCost / v.quantity : totalCost;
  $('#shipcalcUs').textContent = fmtMoney(usCost);
  $('#shipcalcIntl').textContent = fmtMoney(intlCost);
  $('#shipcalcPerUnit').textContent = fmtMoney(perUnit);
}

function initShipCalc() {
  $$('input[data-shipcalc]').forEach(inp => {
    attachNumberInput(inp);
    inp.addEventListener('input', debounce(updateShipCalc, 80));
  });
  updateShipCalc();
}

export function initShipments() {
  $('#btnAddShipment').addEventListener('click', () => openShipmentModal(null));
  initShipCalc();
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
