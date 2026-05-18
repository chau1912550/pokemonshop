import { getState, addShipment, updateShipment, deleteShipment } from '../state.js';
import {
  $, $$, fmtMoney, fmtDateVN, parseNumber, attachNumberInput, toast, confirmAction,
  currencySymbol, formatMoneyInput, debounce, computeShipPerUnit,
} from '../utils.js';
import { openModal } from '../modal.js';

// Aggregate per-shipment stats so the table and KPIs share a single source.
function shipmentStats(shipment, products) {
  const items = products.filter(p => p.shipmentId === shipment.id);
  const totalWeight = items.reduce((s, p) => s + (+p.weight || 0) * (+p.quantity || 0), 0);
  const ratePerLb = (+shipment.usDomesticRate || 0) + (+shipment.intlRate || 0);
  const totalShipCost = totalWeight * ratePerLb;
  const totalUsShip = totalWeight * (+shipment.usDomesticRate || 0);
  const totalIntlShip = totalWeight * (+shipment.intlRate || 0);
  return { items, totalWeight, ratePerLb, totalShipCost, totalUsShip, totalIntlShip };
}

export function renderShipmentsPage() {
  const { shipments, products } = getState();

  // ===== KPIs =====
  const total = shipments.length;
  const allStats = shipments.map(s => shipmentStats(s, products));
  const totalWeight = allStats.reduce((acc, s) => acc + s.totalWeight, 0);
  const totalShipCost = allStats.reduce((acc, s) => acc + s.totalShipCost, 0);
  const totalUsShip = allStats.reduce((acc, s) => acc + s.totalUsShip, 0);
  const totalIntlShip = allStats.reduce((acc, s) => acc + s.totalIntlShip, 0);

  $('#shipmentKpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon kpi-blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M1 12h11v6H1zM12 8h5l4 4v6h-9V8z" stroke="currentColor" stroke-width="1.6"/></svg></div></div>
      <div class="kpi-label">Số lô hàng</div>
      <div class="kpi-value">${total}</div>
    </div>
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon kpi-teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12l9-9 9 9-9 9-9-9z" stroke="currentColor" stroke-width="1.6"/></svg></div></div>
      <div class="kpi-label">Tổng cân nặng</div>
      <div class="kpi-value">${totalWeight.toFixed(2)} lb</div>
    </div>
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon kpi-yellow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 12h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div></div>
      <div class="kpi-label">Ship nội địa Mỹ</div>
      <div class="kpi-value">${fmtMoney(totalUsShip)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-head"><div class="kpi-icon kpi-green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" stroke="currentColor" stroke-width="1.5"/></svg></div></div>
      <div class="kpi-label">Ship Mỹ → VN</div>
      <div class="kpi-value">${fmtMoney(totalIntlShip)}</div>
    </div>
  `;

  // ===== Table =====
  const body = $('#shipmentsBody');
  if (!shipments.length) {
    body.innerHTML = `<tr><td colspan="9"><div class="empty">
      <div class="empty-title">Chưa có lô hàng</div>
      <div class="empty-sub">Bấm "Thêm lô hàng" để bắt đầu — mỗi lô có riêng giá ship/lb.</div>
    </div></td></tr>`;
    return;
  }

  const sorted = [...shipments].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  body.innerHTML = sorted.map(s => {
    const st = shipmentStats(s, products);
    return `
      <tr data-id="${s.id}">
        <td><code style="font-size:12px">${s.code}</code></td>
        <td>${escapeHtml(s.name || '')}</td>
        <td>${fmtDateVN(s.date)}</td>
        <td class="num">${fmtMoney(s.usDomesticRate)}</td>
        <td class="num">${fmtMoney(s.intlRate)}</td>
        <td class="num">${st.items.length}</td>
        <td class="num">${st.totalWeight.toFixed(2)} lb</td>
        <td class="num profit-cell">${fmtMoney(st.totalShipCost)}</td>
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
    const used = getState().products.filter(p => p.shipmentId === id).length;
    const msg = used
      ? `Lô "${s.code} - ${s.name}" đang liên kết với ${used} sản phẩm. Xoá lô sẽ ngắt liên kết (sản phẩm vẫn còn). Tiếp tục?`
      : `Xoá lô "${s.code} - ${s.name}"?`;
    if (confirmAction(msg)) {
      deleteShipment(id);
      toast('Đã xoá lô hàng');
    }
  }));
}

function openShipmentModal(id = null) {
  const item = id ? getState().shipments.find(s => s.id === id) : null;
  const today = new Date().toISOString().slice(0, 10);
  const data = item || { name: '', date: today, usDomesticRate: 0, intlRate: 0, notes: '' };
  const sym = currencySymbol();

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="form-grid">
      <div class="form-section">
        <div class="form-section-title">Thông tin lô</div>
      </div>
      <label class="form-field" style="grid-column: span 2"><span>Tên lô hàng *</span><input type="text" data-f="name" value="${escapeHtml(data.name)}" placeholder="Ví dụ: Lô tháng 5 - TCGplayer" required></label>
      <label class="form-field" style="grid-column: span 2"><span>Ngày nhập</span><input type="date" data-f="date" value="${data.date}"></label>

      <div class="form-section">
        <div class="form-section-title">Giá ship / pound</div>
      </div>
      <label class="form-field"><span>Phí ship nội địa Mỹ (${sym} / lb)</span><input type="text" inputmode="decimal" data-f="usDomesticRate" data-money value="${formatMoneyInput(+data.usDomesticRate || 0)}" placeholder="0"></label>
      <label class="form-field"><span>Phí ship Mỹ → Việt Nam (${sym} / lb) *</span><input type="text" inputmode="decimal" data-f="intlRate" data-money value="${formatMoneyInput(+data.intlRate || 0)}" placeholder="3.5"></label>

      <label class="form-field" style="grid-column: span 2"><span>Ghi chú</span><textarea data-f="notes" rows="2" placeholder="Ví dụ: forwarder Speed-Shipping, ETA 7 ngày">${escapeHtml(data.notes || '')}</textarea></label>
    </div>
    <div class="form-hint">Phí ship cho mỗi sản phẩm trong lô = <b>Cân nặng (lb) × (Phí Mỹ + Phí quốc tế)</b>. Gán sản phẩm vào lô ở trang Sản phẩm.</div>
  `;
  $$('input[data-money]', body).forEach(inp => attachNumberInput(inp));

  openModal({
    title: id ? 'Sửa lô hàng' : 'Thêm lô hàng',
    body,
    submitLabel: id ? 'Cập nhật' : 'Thêm',
    onSubmit: () => {
      const payload = {
        name: $('input[data-f="name"]', body).value.trim(),
        date: $('input[data-f="date"]', body).value,
        usDomesticRate: parseNumber($('input[data-f="usDomesticRate"]', body).value),
        intlRate: parseNumber($('input[data-f="intlRate"]', body).value),
        notes: $('textarea[data-f="notes"]', body).value.trim(),
      };
      if (!payload.name) { toast('Vui lòng nhập tên lô hàng'); return false; }
      if (!payload.intlRate && !payload.usDomesticRate) {
        toast('Cần ít nhất 1 mức phí ship');
        return false;
      }
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
