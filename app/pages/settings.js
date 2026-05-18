import {
  getState, setState, importState, clearState,
  getCategories, addCategory, updateCategory, deleteCategory, resetCategoriesToDefault,
} from '../state.js';
import { $, $$, toast, confirmAction, updateCurrencySuffixes } from '../utils.js';
import { openModal } from '../modal.js';
import { buildSampleData } from '../sample.js';

// Palette offered when picking a category color.
const PALETTE = ['#F59E0B', '#10B981', '#FBBF24', '#14B8A6', '#94A3B8', '#4F7BFF', '#EF4444', '#A855F7', '#EC4899', '#0EA5E9'];

export function renderSettingsPage() {
  const s = getState();
  $('#settingShopName').value = s.shopName || '';
  $('#settingCurrency').value = s.currency || 'VND';
  $('#settingPackagingRate').value = s.packagingRate ?? 8.2;
  $('#settingTaxRate').value = s.taxRate ?? 8;

  renderCategoryTable();
}

function renderCategoryTable() {
  const cats = getCategories();
  const body = $('#categoryBody');
  if (!cats.length) {
    body.innerHTML = `<tr><td colspan="4"><div class="empty"><div class="empty-sub">Chưa có phân loại nào. Bấm "Thêm phân loại" để bắt đầu.</div></div></td></tr>`;
    return;
  }
  body.innerHTML = cats.map(c => `
    <tr data-key="${c.key}">
      <td><span style="display:inline-block; width:22px; height:22px; border-radius:6px; background:${c.color}; vertical-align:middle"></span></td>
      <td>${escapeHtml(c.label)}</td>
      <td><code style="font-size:12px; color:var(--text-2)">${escapeHtml(c.key)}</code></td>
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
  `).join('');

  $$('.act-edit', body).forEach(b => b.addEventListener('click', () => openCategoryModal(b.closest('tr').dataset.key)));
  $$('.act-del', body).forEach(b => b.addEventListener('click', () => {
    const key = b.closest('tr').dataset.key;
    const cat = getCategories().find(c => c.key === key);
    if (!cat) return;
    // Warn if the category is referenced by existing expenses.
    const used = getState().expenses.filter(e => e.category === key).length;
    const msg = used
      ? `Phân loại "${cat.label}" đang được dùng cho ${used} khoản chi phí. Xoá vẫn được — các khoản đó sẽ chuyển thành "Không phân loại". Tiếp tục?`
      : `Xoá phân loại "${cat.label}"?`;
    if (confirmAction(msg)) {
      deleteCategory(key);
      toast('Đã xoá phân loại');
    }
  }));
}

function openCategoryModal(editKey = null) {
  const existing = editKey ? getCategories().find(c => c.key === editKey) : null;
  const data = existing || { label: '', color: PALETTE[0] };

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="form-grid">
      <label class="form-field" style="grid-column: span 2"><span>Tên phân loại *</span><input type="text" data-f="label" value="${escapeHtml(data.label)}" placeholder="Ví dụ: Marketing, Lương nhân viên, Thuê kho..." required></label>
      <div class="form-field" style="grid-column: span 2"><span>Màu</span>
        <div class="color-palette" data-color="${data.color}">
          ${PALETTE.map(c => `<button type="button" class="swatch ${c === data.color ? 'is-active' : ''}" style="background:${c}" data-c="${c}" aria-label="${c}"></button>`).join('')}
          <input type="color" class="swatch-custom" value="${data.color}" title="Chọn màu tuỳ ý">
        </div>
      </div>
    </div>
  `;

  // Swatch interactions — clicking a preset or the native picker updates the data-color attr.
  const palette = body.querySelector('.color-palette');
  $$('.swatch', palette).forEach(sw => sw.addEventListener('click', () => {
    palette.dataset.color = sw.dataset.c;
    $$('.swatch', palette).forEach(s => s.classList.toggle('is-active', s === sw));
    palette.querySelector('.swatch-custom').value = sw.dataset.c;
  }));
  palette.querySelector('.swatch-custom').addEventListener('input', e => {
    palette.dataset.color = e.target.value;
    $$('.swatch', palette).forEach(s => s.classList.remove('is-active'));
  });

  openModal({
    title: editKey ? 'Sửa phân loại' : 'Thêm phân loại',
    body,
    submitLabel: editKey ? 'Cập nhật' : 'Thêm',
    onSubmit: () => {
      const label = $('input[data-f="label"]', body).value.trim();
      const color = palette.dataset.color;
      if (!label) {
        $('input[data-f="label"]', body).focus();
        toast('Vui lòng nhập tên');
        return false;
      }
      if (editKey) {
        updateCategory(editKey, { label, color });
        toast('Đã cập nhật phân loại');
      } else {
        addCategory({ label, color });
        toast('Đã thêm phân loại');
      }
    },
  });
}

export function initSettings() {
  $('#btnSaveSettings').addEventListener('click', () => {
    setState(s => ({
      ...s,
      shopName: $('#settingShopName').value.trim() || 'Pokemon Shop',
      currency: $('#settingCurrency').value,
      packagingRate: +$('#settingPackagingRate').value || 0,
      taxRate: +$('#settingTaxRate').value || 0,
    }));
    updateCurrencySuffixes();
    toast('Đã lưu cài đặt');
  });

  // Update currency suffixes immediately when the user changes the dropdown,
  // even before they hit "Lưu" — the form input itself updates visually.
  $('#settingCurrency').addEventListener('change', e => {
    setState(s => ({ ...s, currency: e.target.value }));
    updateCurrencySuffixes();
    toast('Đơn vị tiền tệ: ' + e.target.value);
  });

  $('#btnExportJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokemonshop-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Đã xuất dữ liệu');
  });

  $('#btnImportJson').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirmAction('Nhập dữ liệu sẽ ghi đè toàn bộ dữ liệu hiện tại. Tiếp tục?')) return;
        importState(data);
        toast('Đã nhập dữ liệu');
      } catch (err) {
        alert('File JSON không hợp lệ: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('#btnClearData').addEventListener('click', () => {
    if (!confirmAction('Xoá TOÀN BỘ dữ liệu? Hành động không thể hoàn tác.')) return;
    if (!confirmAction('Bạn chắc chắn? Hãy backup trước khi xoá.')) return;
    clearState();
    toast('Đã xoá dữ liệu');
  });

  $('#btnLoadSample').addEventListener('click', () => {
    if (!confirmAction('Tải dữ liệu mẫu sẽ ghi đè dữ liệu hiện tại. Tiếp tục?')) return;
    const sample = buildSampleData();
    setState(s => ({ ...s, ...sample }));
    toast('Đã tải dữ liệu mẫu — chuyển sang Tổng quan để xem');
    location.hash = '#dashboard';
  });

  // Category management.
  $('#btnAddCategory').addEventListener('click', () => openCategoryModal(null));
  $('#btnResetCategories').addEventListener('click', () => {
    if (!confirmAction('Khôi phục danh sách mặc định? Các phân loại tự thêm sẽ bị xoá.')) return;
    resetCategoriesToDefault();
    toast('Đã khôi phục phân loại mặc định');
  });
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
