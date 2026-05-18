// Centralised state + localStorage persistence + pub/sub.
const STORAGE_KEY = 'pokemonShop.v1';

// Built-in categories shipped with every fresh install. Users can edit/delete
// these or add their own from the Settings page.
export const DEFAULT_CATEGORIES = [
  { key: 'ship_intl', label: 'Ship quốc tế', color: '#F59E0B' },
  { key: 'ship_dom', label: 'Ship nội địa', color: '#10B981' },
  { key: 'tax', label: 'Thuế/Phí khác', color: '#FBBF24' },
  { key: 'packaging', label: 'Đóng gói', color: '#14B8A6' },
  { key: 'other', label: 'Khác', color: '#94A3B8' },
];

const defaultState = {
  shopName: 'Pokemon Shop',
  currency: 'VND',
  packagingRate: 8.2,
  taxRate: 8,
  period: { start: isoDate(monthStart()), end: isoDate(monthEnd()) },
  products: [],
  expenses: [],
  orders: [],
  // Shipments group one or more product imports under a single set of
  // freight rates. Rates are "per pound" so cost = weight * rate.
  // Two rates because the typical flow is: US seller → US forwarder
  // (domestic US ship) → forwarder → Vietnam (international ship).
  shipments: [],
  categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
};

function monthStart(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthEnd(d = new Date()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function isoDate(d) { return d.toISOString().slice(0, 10); }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const merged = { ...structuredClone(defaultState), ...parsed };
    // Backfill categories for users upgrading from an older build.
    if (!Array.isArray(merged.categories) || merged.categories.length === 0) {
      merged.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    }
    if (!Array.isArray(merged.shipments)) merged.shipments = [];
    return merged;
  } catch (e) {
    console.warn('State load failed, using defaults', e);
    return structuredClone(defaultState);
  }
}

let state = load();
const listeners = new Set();

export function getState() { return state; }

export function setState(updater) {
  const next = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
  state = next;
  persist();
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() { listeners.forEach(fn => fn(state)); }

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Persist failed', e);
  }
}

// -------- Domain helpers (mutating wrappers) --------
export function addProduct(p) {
  setState(s => ({ ...s, products: [...s.products, { ...p, id: uuid() }] }));
}
export function updateProduct(id, patch) {
  setState(s => ({ ...s, products: s.products.map(p => p.id === id ? { ...p, ...patch } : p) }));
}
export function deleteProduct(id) {
  setState(s => ({ ...s, products: s.products.filter(p => p.id !== id) }));
}

export function addExpense(e) {
  setState(s => ({ ...s, expenses: [...s.expenses, { ...e, id: uuid() }] }));
}
export function updateExpense(id, patch) {
  setState(s => ({ ...s, expenses: s.expenses.map(e => e.id === id ? { ...e, ...patch } : e) }));
}
export function deleteExpense(id) {
  setState(s => ({ ...s, expenses: s.expenses.filter(e => e.id !== id) }));
}

export function addOrder(o) {
  setState(s => ({ ...s, orders: [...s.orders, { ...o, id: uuid(), code: nextOrderCode(s.orders) }] }));
}
export function updateOrder(id, patch) {
  setState(s => ({ ...s, orders: s.orders.map(o => o.id === id ? { ...o, ...patch } : o) }));
}
export function deleteOrder(id) {
  setState(s => ({ ...s, orders: s.orders.filter(o => o.id !== id) }));
}

function nextOrderCode(orders) {
  const n = orders.length + 1;
  return 'DH' + String(n).padStart(4, '0');
}

// -------- Shipments CRUD --------
export function addShipment(s) {
  setState(prev => ({
    ...prev,
    shipments: [...prev.shipments, { ...s, id: uuid(), code: nextShipmentCode(prev.shipments) }],
  }));
}
export function updateShipment(id, patch) {
  setState(s => ({ ...s, shipments: s.shipments.map(x => x.id === id ? { ...x, ...patch } : x) }));
}
export function deleteShipment(id) {
  setState(s => ({
    ...s,
    shipments: s.shipments.filter(x => x.id !== id),
    // Detach products from the deleted shipment but keep the products.
    products: s.products.map(p => p.shipmentId === id ? { ...p, shipmentId: '' } : p),
  }));
}

function nextShipmentCode(shipments) {
  return 'LH' + String((shipments?.length || 0) + 1).padStart(3, '0');
}

export function importState(data) {
  setState(() => ({ ...structuredClone(defaultState), ...data }));
}

export function clearState() {
  state = structuredClone(defaultState);
  persist();
  emit();
}

export function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// -------- Categories CRUD --------
// Returns the current category list (always reflects latest state).
export function getCategories() { return state.categories || []; }

export function addCategory({ label, color }) {
  const key = slugifyKey(label) || ('cat-' + uuid().slice(0, 6));
  // Avoid colliding with existing keys by appending a counter.
  let finalKey = key;
  let n = 2;
  while (state.categories.some(c => c.key === finalKey)) {
    finalKey = `${key}-${n++}`;
  }
  setState(s => ({ ...s, categories: [...s.categories, { key: finalKey, label, color: color || '#94A3B8' }] }));
  return finalKey;
}

export function updateCategory(key, patch) {
  setState(s => ({ ...s, categories: s.categories.map(c => c.key === key ? { ...c, ...patch } : c) }));
}

export function deleteCategory(key) {
  setState(s => ({
    ...s,
    categories: s.categories.filter(c => c.key !== key),
    // Detach the category from any expense that used it (keep the row, drop the link).
    expenses: s.expenses.map(e => e.category === key ? { ...e, category: '' } : e),
  }));
}

export function resetCategoriesToDefault() {
  setState(s => ({ ...s, categories: DEFAULT_CATEGORIES.map(c => ({ ...c })) }));
}

function slugifyKey(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const ORDER_STATUSES = [
  { key: 'pending', label: 'Chờ xử lý', cls: 'pill-pending' },
  { key: 'shipped', label: 'Đang giao', cls: 'pill-shipped' },
  { key: 'done', label: 'Hoàn tất', cls: 'pill-done' },
  { key: 'cancel', label: 'Đã huỷ', cls: 'pill-cancel' },
];

// -------- Period filtering helpers --------
// All "dated" entities (expenses, orders) use ISO date strings (YYYY-MM-DD).
// Products are inventory snapshots and are NOT filtered by period.
export function inPeriod(item, period) {
  if (!item.date) return false;
  return item.date >= period.start && item.date <= period.end;
}

// Given a period, return the equal-length window immediately before it. Used
// for "% so với kỳ trước" deltas on KPI cards.
export function previousPeriod(period) {
  const start = new Date(period.start + 'T00:00:00');
  const end = new Date(period.end + 'T00:00:00');
  const days = Math.round((end - start) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return {
    start: prevStart.toISOString().slice(0, 10),
    end: prevEnd.toISOString().slice(0, 10),
  };
}

export function getExpensesInPeriod(period) {
  return state.expenses.filter(e => inPeriod(e, period));
}
export function getOrdersInPeriod(period) {
  return state.orders.filter(o => inPeriod(o, period));
}
