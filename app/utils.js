// Number formatting and date helpers used everywhere.
import { getState } from './state.js';

const nfVND = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const nfUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
// minFractionDigits=0 so plain inputs don't get a forced ".00" suffix —
// the user can type "90" and see "90", not "90.00". USD displays in tables
// still use nfUSD which decides its own decimals.
const nfUSDPlain = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nfPct = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function currentCurrency() {
  try { return getState().currency || 'VND'; } catch { return 'VND'; }
}

export function currencySymbol(currency = currentCurrency()) {
  return currency === 'USD' ? '$' : 'đ';
}

export function fmtMoney(n, currency = currentCurrency()) {
  if (!isFinite(n)) n = 0;
  if (currency === 'USD') return nfUSD.format(n);
  return nfVND.format(Math.round(n)) + ' đ';
}

export function fmtPct(n) {
  if (!isFinite(n)) n = 0;
  return nfPct.format(n) + '%';
}

export function fmtShort(n, currency = currentCurrency()) {
  if (!isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (currency === 'USD') {
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return '$' + Math.round(n);
  }
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'tỷ';
  if (abs >= 1e6) return (n / 1e6).toFixed(0) + 'tr';
  if (abs >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return String(Math.round(n));
}

// Parse user input strings. Handles both VND-style ("1.234.567") and
// USD-style ("1,234.56") by treating a single trailing dot/comma with 1–2
// digits after as the decimal separator, and grouping characters as
// thousand separators otherwise.
export function parseNumber(str) {
  if (str == null) return 0;
  if (typeof str === 'number') return str;
  let s = String(str).trim();
  if (!s) return 0;
  // Strip currency markers and whitespace.
  s = s.replace(/[$đ\s]/gi, '');
  // Pull out sign, then strip non-numeric/separator chars.
  const negative = s.startsWith('-');
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return 0;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const lastSep = Math.max(lastDot, lastComma);
  let n;
  if (lastSep < 0) {
    n = Number(s);
  } else {
    const afterSep = s.slice(lastSep + 1);
    // 1–2 digits after last separator → treat as decimal separator
    // 3 digits → likely a thousand separator (e.g. VND "1.234")
    if (afterSep.length >= 1 && afterSep.length <= 2 && /^\d+$/.test(afterSep)) {
      const intPart = s.slice(0, lastSep).replace(/[.,]/g, '');
      n = Number(intPart + '.' + afterSep);
    } else {
      n = Number(s.replace(/[.,]/g, ''));
    }
  }
  if (!isFinite(n)) return 0;
  return negative ? -n : n;
}

export function fmtDateVN(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('vi-VN');
}

export function fmtPeriod(period) {
  return fmtDateVN(period.start) + ' – ' + fmtDateVN(period.end);
}

// Tiny DOM helpers.
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

// Debounce small inputs (search, calc).
export function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Compute the per-unit shipping cost. If the product is linked to a
// shipment with per-pound rates, ship = weight × (us_rate + intl_rate).
// Otherwise fall back to the manually-entered shipPerUnit.
export function computeShipPerUnit(p, shipments = []) {
  if (p.shipmentId) {
    const s = shipments.find(x => x.id === p.shipmentId);
    if (s) {
      const w = +p.weight || 0;
      const rate = (+s.usDomesticRate || 0) + (+s.intlRate || 0);
      return w * rate;
    }
  }
  return +p.shipPerUnit || 0;
}

// Standardised product profitability calc — same formula used by table, calculator, and reports.
// profit/unit = sellPrice - buyPrice - shipPerUnit - taxPerUnit - packagingPerUnit
export function computeProductProfit(p, shipments = []) {
  const buy = +p.buyPrice || 0;
  const ship = computeShipPerUnit(p, shipments);
  const tax = +p.taxPerUnit || 0;
  const pack = +p.packagingPerUnit || 0;
  const sell = +p.sellPrice || 0;
  const qty = +p.quantity || 0;
  const profitPerUnit = sell - buy - ship - tax - pack;
  const totalProfit = profitPerUnit * qty;
  const margin = sell > 0 ? (profitPerUnit / sell) * 100 : 0;
  return { profitPerUnit, totalProfit, margin, shipPerUnit: ship };
}

// Show a toast for ~2s. Useful for "Saved" / "Deleted" feedback.
let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

// Confirm dialog using native confirm() — simple enough for our use case.
export function confirmAction(msg) { return window.confirm(msg); }

// Format numeric input on the fly.
//   VND mode → "1234567" displays as "1.234.567"
//   USD mode → "1234.5" displays as "1,234.5", "90" stays "90"
//
// Design rule: only add thousand separators to the integer part. Never
// force trailing ".00" while the user is typing — that breaks the keyboard
// flow ("90" turning into "90.00" then "9,000.00" when they keep typing).
// If the user explicitly types a decimal (e.g. "90."), we preserve it.
export function attachNumberInput(input) {
  input.addEventListener('input', () => {
    const cur = currentCurrency();
    const thousSep = cur === 'USD' ? ',' : '.';
    const decSep = cur === 'USD' ? '.' : ',';

    const before = input.value;
    const caret = input.selectionStart;

    // Split off a decimal portion only if the LAST separator has 0–2 digits
    // after it — that matches user intent without forcing a locale.
    let intPart, decPart, hasDecimal = false;
    const m = before.match(/^(.*)([.,])(\d{0,2})$/);
    if (m) {
      intPart = m[1];
      decPart = m[3];
      hasDecimal = true;
    } else {
      intPart = before;
      decPart = '';
    }

    const negative = before.trim().startsWith('-');
    const digits = intPart.replace(/\D/g, '');

    let formatted = '';
    if (digits) {
      formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, thousSep);
    }
    if (negative) formatted = '-' + formatted;
    if (hasDecimal) formatted += decSep + decPart;

    input.value = formatted;
    // Best-effort caret restore (length diff = chars we added/removed).
    const diff = formatted.length - before.length;
    try { input.setSelectionRange((caret || 0) + diff, (caret || 0) + diff); } catch {}
  });

  // On blur: trim a dangling separator like "90." → "90" so the value is
  // clean when serialised. No reformat that would surprise the user.
  input.addEventListener('blur', () => {
    if (!input.value) return;
    input.value = input.value.replace(/[.,]$/, '');
  });
}

// Pre-format a money value for displaying inside an input (e.g. when editing).
// Strips ".00" suffix; user can re-add decimals if they want.
export function formatMoneyInput(n, currency = currentCurrency()) {
  if (!isFinite(n) || n === 0) return '';
  if (currency === 'USD') return nfUSDPlain.format(n);
  return nfVND.format(Math.round(n));
}

// Apply the current currency symbol to all <b class="cur-suffix"> tags.
export function updateCurrencySuffixes() {
  const sym = currencySymbol();
  document.querySelectorAll('.cur-suffix').forEach(el => { el.textContent = sym; });
}
