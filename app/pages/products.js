import { getState, addProduct, updateProduct, deleteProduct } from '../state.js';
import { $, $$, fmtMoney, parseNumber, computeProductProfit, attachNumberInput, toast, confirmAction, currencySymbol, formatMoneyInput } from '../utils.js';
import { openModal, closeModal } from '../modal.js';

let searchTerm = '';

export function renderProductsPage() {
  const { products, shipments } = getState();
  const body = $('#productsBody');
  const filtered = products.filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="11"><div class="empty">
      <div class="empty-title">${searchTerm ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}</div>
      <div class="empty-sub">${searchTerm ? 'Thử từ khoá khác.' : 'Bấm "Thêm sản phẩm" ở góc phải trên để bắt đầu.'}</div>
    </div></td></tr>`;
    return;
  }

  body.innerHTML = filtered.map(p => {
    const { profitPerUnit, totalProfit, shipPerUnit } = computeProductProfit(p, shipments);
    const thumb = p.image ? `style="background-image:url('${p.image}')"` : '';
    return `
      <tr data-id="${p.id}">
        <td><div class="product-cell"><div class="product-thumb" ${thumb}></div><span>${escapeHtml(p.name)}</span></div></td>
        <td class="num">${p.quantity || 0}</td>
        <td class="num">${fmtMoney(p.buyPrice)}</td>
        <td class="num">${fmtMoney(shipPerUnit)}${p.shipmentId ? ' <small style="color:var(--text-3)">(auto)</small>' : ''}</td>
        <td class="num">${fmtMoney(p.taxPerUnit)}</td>
        <td class="num">${fmtMoney(p.packagingPerUnit)}</td>
        <td class="num">${fmtMoney(p.declaredPrice)}</td>
        <td class="num">${fmtMoney(p.sellPrice)}</td>
        <td class="num profit-cell">${fmtMoney(profitPerUnit)}</td>
        <td class="num profit-cell">${fmtMoney(totalProfit)}</td>
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
      </tr>
    `;
  }).join('');

  $$('.act-edit', body).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    openProductModal(b.closest('tr').dataset.id);
  }));
  $$('.act-del', body).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const id = b.closest('tr').dataset.id;
    const p = getState().products.find(x => x.id === id);
    if (!p) return;
    if (confirmAction(`Xoá sản phẩm "${p.name}"?`)) {
      deleteProduct(id);
      toast('Đã xoá sản phẩm');
    }
  }));
}

export function openProductModal(id = null, prefill = {}) {
  const { shipments } = getState();
  const product = id ? getState().products.find(p => p.id === id) : null;
  const data = product || { name: '', image: '', quantity: 1, buyPrice: 0, shipPerUnit: 0, declaredPrice: 0, taxPerUnit: 0, packagingPerUnit: 0, sellPrice: 0, weight: 0, shipmentId: '', ...prefill };

  const sym = currencySymbol();
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="form-grid">
      <div class="form-section">
        <div class="form-section-title">Thông tin cơ bản</div>
      </div>
      <label class="form-field" style="grid-column: span 2"><span>Tên sản phẩm *</span><input type="text" data-f="name" value="${escapeAttr(data.name)}" placeholder="Ví dụ: Chaos Rising ETB" required></label>
      <label class="form-field"><span>Số lượng</span><input type="number" min="0" step="1" data-f="quantity" value="${data.quantity}"></label>
      <label class="form-field"><span>Giá nhập (${sym})</span><input type="text" inputmode="decimal" data-f="buyPrice" data-money value="${formatMoneyInput(+data.buyPrice || 0)}" placeholder="0"></label>
      <label class="form-field"><span>Ảnh (tuỳ chọn)</span><input type="file" accept="image/*" data-f="imageFile"></label>
      <label class="form-field"><span>URL ảnh (hoặc dán)</span><input type="text" data-f="image" value="${escapeAttr(data.image || '')}" placeholder="https://..."></label>

      <div class="form-section">
        <div class="form-section-title">Phí ship</div>
      </div>
      <label class="form-field"><span>Trọng lượng / đơn vị</span><div class="input-with-suffix"><input type="text" inputmode="decimal" data-f="weight" value="${(+data.weight || 0) ? formatMoneyInput(+data.weight) : ''}" placeholder="0"><b>lb</b></div></label>
      <label class="form-field"><span>Thuộc lô hàng</span>
        <select data-f="shipmentId">
          <option value="">— Không gán lô —</option>
          ${shipments.map(s => `<option value="${s.id}" ${s.id === data.shipmentId ? 'selected' : ''}>${escapeHtml(s.code + ' · ' + s.name)}</option>`).join('')}
        </select>
      </label>
      <label class="form-field" style="grid-column: span 2"><span>Phí ship / đơn vị (${sym})</span><input type="text" inputmode="decimal" data-f="shipPerUnit" data-money value="${formatMoneyInput(+data.shipPerUnit || 0)}" placeholder="0"></label>
      <div class="form-hint" id="shipAutoHint" style="display:none; grid-column: span 2"></div>

      <div class="form-section">
        <div class="form-section-title">Chi phí phụ &amp; giá bán</div>
      </div>
      <label class="form-field"><span>Thuế / đơn vị (${sym})</span><input type="text" inputmode="decimal" data-f="taxPerUnit" data-money value="${formatMoneyInput(+data.taxPerUnit || 0)}" placeholder="0"></label>
      <label class="form-field"><span>Đóng gói / đơn vị (${sym})</span><input type="text" inputmode="decimal" data-f="packagingPerUnit" data-money value="${formatMoneyInput(+data.packagingPerUnit || 0)}" placeholder="0"></label>
      <label class="form-field"><span>Giá khai báo (${sym})</span><input type="text" inputmode="decimal" data-f="declaredPrice" data-money value="${formatMoneyInput(+data.declaredPrice || 0)}" placeholder="0"></label>
      <label class="form-field"><span>Giá bán (${sym})</span><input type="text" inputmode="decimal" data-f="sellPrice" data-money value="${formatMoneyInput(+data.sellPrice || 0)}" placeholder="0"></label>
    </div>
    <div class="form-hint">Lãi/đơn vị = Giá bán − Giá nhập − Ship − Thuế − Đóng gói. Nếu gán lô hàng, ship sẽ tự tính = <b>Trọng lượng × (Phí Mỹ + Phí quốc tế)</b>.</div>
  `;

  // Live-format every money input + the weight input.
  $$('input[data-money]', body).forEach(inp => attachNumberInput(inp));
  attachNumberInput($('input[data-f="weight"]', body));

  // When a shipment is selected, auto-compute shipPerUnit from weight × rates,
  // disable the manual ship field, and show a tip explaining the formula.
  const shipSel = $('select[data-f="shipmentId"]', body);
  const weightInp = $('input[data-f="weight"]', body);
  const shipInp = $('input[data-f="shipPerUnit"]', body);
  const hint = $('#shipAutoHint', body);

  function syncShipFromShipment() {
    const sid = shipSel.value;
    const s = shipments.find(x => x.id === sid);
    if (s) {
      const w = parseNumber(weightInp.value);
      const rate = (+s.usDomesticRate || 0) + (+s.intlRate || 0);
      const ship = w * rate;
      shipInp.value = formatMoneyInput(ship);
      shipInp.readOnly = true;
      hint.style.display = 'block';
      hint.innerHTML = `Tự tính từ lô hàng: <b>${formatMoneyInput(w) || 0} lb × ${sym}${formatMoneyInput(rate) || 0}/lb = ${sym}${formatMoneyInput(ship) || 0}</b>. Bỏ chọn lô để nhập thủ công.`;
    } else {
      shipInp.readOnly = false;
      hint.style.display = 'none';
    }
  }
  shipSel.addEventListener('change', syncShipFromShipment);
  weightInp.addEventListener('input', syncShipFromShipment);
  syncShipFromShipment();

  // Handle file -> data URL.
  const fileInput = $('input[data-f="imageFile"]', body);
  const urlInput = $('input[data-f="image"]', body);
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { urlInput.value = r.result; };
    r.readAsDataURL(f);
  });

  openModal({
    title: id ? 'Sửa sản phẩm' : 'Thêm sản phẩm',
    body,
    submitLabel: id ? 'Cập nhật' : 'Thêm',
    onSubmit: () => {
      const get = sel => $(sel, body);
      const payload = {
        name: get('input[data-f="name"]').value.trim(),
        image: get('input[data-f="image"]').value.trim(),
        quantity: +get('input[data-f="quantity"]').value || 0,
        weight: parseNumber(get('input[data-f="weight"]').value),
        shipmentId: get('select[data-f="shipmentId"]').value,
        buyPrice: parseNumber(get('input[data-f="buyPrice"]').value),
        shipPerUnit: parseNumber(get('input[data-f="shipPerUnit"]').value),
        taxPerUnit: parseNumber(get('input[data-f="taxPerUnit"]').value),
        packagingPerUnit: parseNumber(get('input[data-f="packagingPerUnit"]').value),
        declaredPrice: parseNumber(get('input[data-f="declaredPrice"]').value),
        sellPrice: parseNumber(get('input[data-f="sellPrice"]').value),
      };
      if (!payload.name) {
        get('input[data-f="name"]').focus();
        toast('Vui lòng nhập tên sản phẩm');
        return false;
      }
      if (id) {
        updateProduct(id, payload);
        toast('Đã cập nhật sản phẩm');
      } else {
        addProduct(payload);
        toast('Đã thêm sản phẩm');
      }
    },
  });
}

export function initProducts() {
  $('#btnAddProduct').addEventListener('click', () => openProductModal(null));
  $('#searchProduct').addEventListener('input', e => {
    searchTerm = e.target.value;
    renderProductsPage();
  });
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s = '') { return escapeHtml(s); }
