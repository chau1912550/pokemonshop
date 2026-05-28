import { getState, addNotebook, updateNotebook, deleteNotebook, uuid } from '../state.js';
import { $, $$, fmtMoney, parseNumber, toast, confirmAction, attachNumberInput, formatMoneyInput } from '../utils.js';

// ID of the currently-visible notebook tab.
// Persists across state-driven re-renders so the open tab doesn't jump.
let _activeId = null;

// After "Add row" or "New notebook", we want to auto-focus a field.
let _focusRowId  = null;   // focus the name-input of this row on next render
let _focusTitle  = false;  // focus + select the notebook title on next render

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getNbs() { return getState().notebooks || []; }

function ensureActive() {
  const nbs = getNbs();
  if (!nbs.length) { _activeId = null; return; }
  if (!nbs.find(n => n.id === _activeId)) _activeId = nbs[0].id;
}

function activeNb() {
  ensureActive();
  return getNbs().find(n => n.id === _activeId) || null;
}

// Compute the effective money value of every row, top-to-bottom.
//   calc 'fixed'   → amount
//   calc 'rate'    → weight (lb) × rate (per lb)
//   calc 'percent' → base × percent%, where base = a specific row above
//                    (baseRowId) or the sum of all rows above (baseRowId = '').
// Percent rows can only reference rows ABOVE them (already computed), so there
// are no circular references.
function computeRows(rows) {
  const out = [];
  for (const r0 of rows) {
    const r = { ...r0, calc: r0.calc || 'fixed' };
    let effective = 0, base = 0;
    if (r.calc === 'rate') {
      effective = (+r.weight || 0) * (+r.rate || 0);
    } else if (r.calc === 'percent') {
      if (r.baseRowId) {
        const br = out.find(x => x.id === r.baseRowId);
        base = br ? br.effective : 0;
      } else {
        base = out.reduce((s, x) => s + x.effective, 0);
      }
      effective = base * ((+r.percent || 0) / 100);
    } else {
      effective = +r.amount || 0;
    }
    out.push({ ...r, effective, base });
  }
  return out;
}

// ─── Mutations ────────────────────────────────────────────────────────────────
function createNotebook() {
  const id = uuid();
  // Set _activeId BEFORE addNotebook because setState fires synchronously,
  // triggering renderNotebookPage() inside the same call stack.
  _activeId   = id;
  _focusTitle = true;
  addNotebook({ id, name: 'Sổ mới', rows: [] });
}

function renameNb(name) {
  if (!_activeId) return;
  updateNotebook(_activeId, { name: name || 'Sổ mới' });
}

function removeNb(id) {
  if (_activeId === id) {
    const nbs = getNbs();
    const idx = nbs.findIndex(n => n.id === id);
    _activeId = nbs[idx + 1]?.id || nbs[idx - 1]?.id || null;
  }
  deleteNotebook(id);
}

function addRow() {
  const nb = activeNb();
  if (!nb) return;
  const rowId = uuid();
  // Set _focusRowId BEFORE updateNotebook because setState fires synchronously.
  _focusRowId = rowId;
  updateNotebook(_activeId, {
    rows: [...(nb.rows || []), { id: rowId, name: '', type: '-', calc: 'fixed', amount: 0, percent: 0, baseRowId: '', weight: 0, rate: 0 }],
  });
}

function patchRow(rowId, patch) {
  const nb = activeNb();
  if (!nb) return;
  updateNotebook(_activeId, { rows: (nb.rows || []).map(r => r.id === rowId ? { ...r, ...patch } : r) });
}

function removeRow(rowId) {
  const nb = activeNb();
  if (!nb) return;
  updateNotebook(_activeId, { rows: (nb.rows || []).filter(r => r.id !== rowId) });
}

// ─── Render ────────────────────────────────────────────────────────────────────
export function renderNotebookPage() {
  ensureActive();
  const container = $('#notebookApp');
  if (!container) return;

  const nbs = getNbs();
  const nb  = activeNb();

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!nbs.length) {
    container.innerHTML = `
      <div class="nb-empty-state">
        <div class="nb-empty-icon">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h12a2 2 0 012 2v12M4 19.5V21M8 7h8M8 11h5"
                  stroke="var(--primary)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="nb-empty-title">Chưa có sổ tay nào</div>
        <div class="nb-empty-sub">Tạo sổ tay để ghi nháp tự do các khoản thu chi.</div>
        <button class="btn btn-primary" id="nbBtnFirstCreate">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Tạo sổ tay đầu tiên
        </button>
      </div>`;
    $('#nbBtnFirstCreate', container).addEventListener('click', createNotebook);
    return;
  }

  // ── Totals (from computed effective values) ────────────────────────────────
  const rows     = nb?.rows || [];
  const computed = computeRows(rows);
  const totalIn  = computed.filter(r => r.type === '+').reduce((s, r) => s + r.effective, 0);
  const totalOut = computed.filter(r => r.type === '-').reduce((s, r) => s + r.effective, 0);
  const net      = totalIn - totalOut;

  // ── Markup ───────────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="nb-layout">

      <div class="nb-tabbar">
        <div class="nb-tabs" id="nbTabs">
          ${nbs.map(n => `
            <button class="nb-tab${n.id === _activeId ? ' active' : ''}" data-nbid="${n.id}">
              <span class="nb-tab-label">${escapeHtml(n.name)}</span>
              <span class="nb-tab-x" data-delnb="${n.id}" title="Xoá sổ này">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
              </span>
            </button>`).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" id="nbBtnNew">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Thêm sổ
        </button>
      </div>

      ${nb ? `
      <section class="card nb-card">
        <header class="card-head nb-card-head">
          <input class="nb-title-input" id="nbTitleInput" value="${escapeAttr(nb.name)}"
                 maxlength="60" placeholder="Tên sổ tay..." />
          <div class="nb-summary">
            <span class="nb-sum-in">Thu&nbsp;+${fmtMoney(totalIn)}</span>
            <span class="nb-sum-sep">&nbsp;·&nbsp;</span>
            <span class="nb-sum-out">Chi&nbsp;−${fmtMoney(totalOut)}</span>
            <span class="nb-sum-sep">&nbsp;·&nbsp;</span>
            <span class="nb-sum-net ${net >= 0 ? 'pos' : 'neg'}">
              Còn lại&nbsp;${net < 0 ? '−' : ''}${fmtMoney(Math.abs(net))}
            </span>
          </div>
        </header>

        <div class="table-wrap">
          <table class="table nb-table">
            <thead>
              <tr>
                <th>Mô tả</th>
                <th style="width:118px">Kiểu</th>
                <th style="width:236px">Cách tính</th>
                <th class="num" style="width:128px">Thành tiền</th>
                <th style="width:78px; text-align:center">Thu/Chi</th>
                <th style="width:42px"></th>
              </tr>
            </thead>
            <tbody id="nbBody">
              ${computed.length ? computed.map((r, i) => rowMarkup(r, computed.slice(0, i))).join('') : `
                <tr><td colspan="6">
                  <div class="empty">
                    <div class="empty-title">Sổ tay trống</div>
                    <div class="empty-sub">Nhấn "Thêm dòng" để bắt đầu ghi chép.</div>
                  </div>
                </td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="nb-footer">
          <button class="btn btn-ghost btn-sm" id="nbBtnAddRow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Thêm dòng
          </button>
          <span class="nb-footer-hint">Kiểu “%” tính theo dòng bạn chọn ở cột Cách tính · Kiểu “Cân × giá” = số pound × đơn giá/lb.</span>
        </div>
      </section>
      ` : ''}
    </div>`;

  bindEvents(container, nb);
}

// Build one <tr>. `before` = computed rows above this one (for % base options).
function rowMarkup(r, before) {
  const calc = r.calc || 'fixed';
  const sign = r.type === '-' ? '−' : '+';

  // "Cách tính" cell content depends on calc type.
  let calcCell = '';
  if (calc === 'percent') {
    const opts = [`<option value="">Tổng các dòng trên</option>`]
      .concat(before.map(b => `<option value="${b.id}" ${b.id === r.baseRowId ? 'selected' : ''}>${escapeHtml(b.name || '(dòng chưa đặt tên)')}</option>`))
      .join('');
    calcCell = `
      <div class="nb-calc-inline">
        <input class="nb-mini nb-calc-inp" data-rowid="${r.id}" data-field="percent" data-type="${r.type}" data-base="${r.base}"
               value="${r.percent ? formatMoneyInput(+r.percent) : ''}" placeholder="0" inputmode="decimal" />
        <span class="nb-op">% của</span>
        <select class="nb-base-sel" data-rowid="${r.id}" data-basesel>${opts}</select>
      </div>`;
  } else if (calc === 'rate') {
    calcCell = `
      <div class="nb-calc-inline">
        <input class="nb-mini nb-calc-inp" data-rowid="${r.id}" data-field="weight" data-type="${r.type}"
               value="${r.weight ? formatMoneyInput(+r.weight) : ''}" placeholder="0" inputmode="decimal" />
        <span class="nb-op">lb ×</span>
        <input class="nb-mini nb-calc-inp" data-rowid="${r.id}" data-field="rate" data-type="${r.type}"
               value="${r.rate ? formatMoneyInput(+r.rate) : ''}" placeholder="0" inputmode="decimal" />
        <span class="nb-op">/lb</span>
      </div>`;
  } else {
    calcCell = `
      <input class="nb-cell nb-calc-inp nb-amt-inp" data-rowid="${r.id}" data-field="amount" data-type="${r.type}"
             value="${r.amount ? formatMoneyInput(+r.amount) : ''}" placeholder="0" inputmode="decimal" />`;
  }

  return `
    <tr>
      <td>
        <input class="nb-cell nb-name-inp" data-rowid="${r.id}"
               value="${escapeAttr(r.name)}" placeholder="Tên khoản tiền..." />
      </td>
      <td>
        <select class="nb-kind-sel" data-rowid="${r.id}" data-kindsel>
          <option value="fixed"   ${calc === 'fixed'   ? 'selected' : ''}>Số tiền</option>
          <option value="percent" ${calc === 'percent' ? 'selected' : ''}>Phần trăm %</option>
          <option value="rate"    ${calc === 'rate'    ? 'selected' : ''}>Cân × giá</option>
        </select>
      </td>
      <td>${calcCell}</td>
      <td class="num">
        <span class="nb-eff ${r.type === '+' ? 'pos' : 'neg'}" data-effrow="${r.id}">${sign}${fmtMoney(r.effective)}</span>
      </td>
      <td style="text-align:center">
        <button class="nb-tc-btn ${r.type === '+' ? 'nb-in' : 'nb-out'}" data-rowid="${r.id}" data-toggletype>
          ${r.type === '+' ? 'Thu' : 'Chi'}
        </button>
      </td>
      <td style="text-align:center">
        <button class="icon-btn" data-rowid="${r.id}" data-delrow title="Xoá dòng">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"
                  stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </td>
    </tr>`;
}

// Recompute & repaint a single row's "Thành tiền" cell live (no full re-render,
// so focus is preserved while the user types).
function liveUpdateEff(container, inp) {
  const rowId = inp.dataset.rowid;
  const type  = inp.dataset.type || '-';
  const field = inp.dataset.field;
  const rowEl = inp.closest('tr');
  let eff = 0;
  if (field === 'amount') {
    eff = parseNumber(inp.value);
  } else if (field === 'percent') {
    const base = +inp.dataset.base || 0;
    eff = base * (parseNumber(inp.value) / 100);
  } else if (field === 'weight' || field === 'rate') {
    const w = parseNumber($('input[data-field="weight"]', rowEl)?.value);
    const rt = parseNumber($('input[data-field="rate"]', rowEl)?.value);
    eff = w * rt;
  }
  const cell = container.querySelector(`[data-effrow="${rowId}"]`);
  if (cell) cell.textContent = (type === '-' ? '−' : '+') + fmtMoney(eff);
}

function bindEvents(container, nb) {
  // Switch tab
  $$('.nb-tab', container).forEach(tab => {
    tab.addEventListener('click', e => {
      if (e.target.closest('[data-delnb]')) return;
      _activeId = tab.dataset.nbid;
      renderNotebookPage();
    });
  });

  // Delete notebook (× inside the tab)
  $$('[data-delnb]', container).forEach(x => {
    x.addEventListener('click', e => {
      e.stopPropagation();
      const id = x.dataset.delnb;
      const found = getNbs().find(n => n.id === id);
      if (found && confirmAction(`Xoá sổ "${found.name}"? Tất cả dòng sẽ bị xoá.`)) {
        removeNb(id);
      }
    });
  });

  // Add notebook
  $('#nbBtnNew', container)?.addEventListener('click', createNotebook);

  if (!nb) return;

  // Rename on blur
  const titleInp = $('#nbTitleInput', container);
  titleInp?.addEventListener('blur', e => {
    const name = e.target.value.trim();
    if (name !== nb.name) renameNb(name);
  });
  titleInp?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); titleInp.blur(); }
  });

  // Add row
  $('#nbBtnAddRow', container)?.addEventListener('click', addRow);

  // Row: name — save on blur only when value actually changed
  $$('.nb-name-inp', container).forEach(inp => {
    inp.addEventListener('blur', e => {
      const row = (activeNb()?.rows || []).find(r => r.id === inp.dataset.rowid);
      if (row && e.target.value !== row.name) patchRow(inp.dataset.rowid, { name: e.target.value });
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    });
  });

  // Kind selector (Số tiền / % / Cân×giá)
  $$('[data-kindsel]', container).forEach(sel => {
    sel.addEventListener('change', () => patchRow(sel.dataset.rowid, { calc: sel.value }));
  });

  // Percent base selector
  $$('[data-basesel]', container).forEach(sel => {
    sel.addEventListener('change', () => patchRow(sel.dataset.rowid, { baseRowId: sel.value }));
  });

  // Calc number inputs (amount / percent / weight / rate)
  // — format live, update the result cell live, save on blur.
  $$('.nb-calc-inp', container).forEach(inp => {
    attachNumberInput(inp);
    inp.addEventListener('input', () => liveUpdateEff(container, inp));
    inp.addEventListener('blur', () => {
      const field = inp.dataset.field;
      const row = (activeNb()?.rows || []).find(r => r.id === inp.dataset.rowid);
      if (!row) return;
      const val = parseNumber(inp.value);
      if (val !== (+row[field] || 0)) patchRow(inp.dataset.rowid, { [field]: val });
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    });
  });

  // Toggle Thu/Chi
  $$('[data-toggletype]', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const row = (activeNb()?.rows || []).find(r => r.id === btn.dataset.rowid);
      if (row) patchRow(btn.dataset.rowid, { type: row.type === '+' ? '-' : '+' });
    });
  });

  // Delete row
  $$('[data-delrow]', container).forEach(btn => {
    btn.addEventListener('click', () => removeRow(btn.dataset.rowid));
  });

  // Deferred focus after "Add row"
  if (_focusRowId) {
    const inp = container.querySelector(`.nb-name-inp[data-rowid="${_focusRowId}"]`);
    if (inp) { inp.focus(); _focusRowId = null; }
  }

  // Deferred focus after "New notebook"
  if (_focusTitle) {
    _focusTitle = false;
    titleInp?.select();
  }
}

export function initNotebook() {
  // All event binding is done inside renderNotebookPage().
  // Nothing global to init here.
}

// ─── Escape helpers ───────────────────────────────────────────────────────────
function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s = '') { return escapeHtml(s); }
