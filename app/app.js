// Main entry: router, page bootstrap, global state subscriptions.
import { getState, subscribe, setState } from './state.js';
import { $, $$, fmtPeriod, updateCurrencySuffixes } from './utils.js';
import './modal.js';

import { initDashboard, renderDashboard } from './pages/dashboard.js';
import { initProducts, renderProductsPage } from './pages/products.js';
import { initShipments, renderShipmentsPage } from './pages/shipments.js';
import { initReports, renderReportsPage, exportExcel } from './pages/reports.js';
import { initSettings, renderSettingsPage } from './pages/settings.js';
import { initNotebook, renderNotebookPage } from './pages/notebook.js';

const PAGES = {
  dashboard: renderDashboard,
  products: renderProductsPage,
  shipments: renderShipmentsPage,
  reports: renderReportsPage,
  notebook: renderNotebookPage,
  settings: renderSettingsPage,
};

function showPage(route) {
  if (!PAGES[route]) route = 'dashboard';

  // Toggle page visibility.
  $$('.page').forEach(p => p.hidden = p.dataset.page !== route);

  // Highlight active nav item.
  $$('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.route === route));

  // Render the page content (also runs on state changes via subscribe).
  PAGES[route]();
}

function currentRoute() {
  const hash = (location.hash || '').replace(/^#/, '');
  return PAGES[hash] ? hash : 'dashboard';
}

window.addEventListener('hashchange', () => showPage(currentRoute()));

function updatePeriodLabels() {
  const label = fmtPeriod(getState().period);
  $('#sidebarPeriodLabel').textContent = label;
  $('#headerPeriodLabel').textContent = label;
}

// Inline date-range picker — opens a tiny popover with two date inputs.
function openPeriodPicker(anchorBtn) {
  const { period } = getState();
  const existing = document.querySelector('.date-popover');
  if (existing) { existing.remove(); return; }

  const pop = document.createElement('div');
  pop.className = 'date-popover';
  pop.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center;">
      <input type="date" id="popStart" value="${period.start}">
      <span style="color:var(--text-3)">–</span>
      <input type="date" id="popEnd" value="${period.end}">
      <button class="btn btn-primary btn-sm" id="popApply">Áp dụng</button>
    </div>
  `;
  Object.assign(pop.style, {
    position: 'absolute', background: '#fff', border: '1px solid var(--border)',
    padding: '10px', borderRadius: '12px', boxShadow: 'var(--shadow)', zIndex: 40,
  });
  document.body.appendChild(pop);
  const rect = anchorBtn.getBoundingClientRect();
  pop.style.top = (rect.bottom + window.scrollY + 6) + 'px';
  pop.style.left = (rect.left + window.scrollX) + 'px';

  $('#popApply', pop).addEventListener('click', () => {
    setState(s => ({ ...s, period: { start: $('#popStart', pop).value, end: $('#popEnd', pop).value } }));
    pop.remove();
  });

  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!pop.contains(e.target) && e.target !== anchorBtn && !anchorBtn.contains(e.target)) {
        pop.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 0);
}

function bindGlobalUI() {
  // Nav clicks just update the hash; the hashchange listener handles render.
  $$('.nav-item').forEach(a => a.addEventListener('click', () => {
    // Native href="#xxx" handles it; nothing else to do.
  }));

  // Period buttons (sidebar + header) open the same popover.
  $('#sidebarPeriod').addEventListener('click', e => openPeriodPicker(e.currentTarget));
  $('#headerPeriod').addEventListener('click', e => openPeriodPicker(e.currentTarget));

  // Export from dashboard header → Excel
  $('#btnExport').addEventListener('click', exportExcel);

  // Sidebar collapse toggle — persisted in localStorage so the choice sticks.
  const root = document.querySelector('.app');
  const COLLAPSED_KEY = 'pokemonShop.sidebarCollapsed';
  if (localStorage.getItem(COLLAPSED_KEY) === '1') root.classList.add('sidebar-collapsed');
  document.querySelector('.brand-toggle')?.addEventListener('click', () => {
    root.classList.toggle('sidebar-collapsed');
    localStorage.setItem(COLLAPSED_KEY, root.classList.contains('sidebar-collapsed') ? '1' : '0');
  });

  // Keyboard shortcuts — only when no input/textarea is focused.
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.querySelector('#btnAddShipmentDash, #btnAddShipment, #btnAddProduct')?.click();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      exportExcel();
    }
    // Quick page navigation: 1..7 jumps to the matching sidebar item.
    const idx = '1234567'.indexOf(e.key);
    if (idx !== -1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const nav = document.querySelectorAll('.nav-item')[idx];
      if (nav) location.hash = nav.dataset.route;
    }
  });
}

function init() {
  bindGlobalUI();

  // Init each page (binds listeners that only need to run once).
  initDashboard();
  initProducts();
  initShipments();
  initReports();
  initNotebook();
  initSettings();

  // Re-render whenever state changes — every page re-renders on demand from getState().
  subscribe(() => {
    updatePeriodLabels();
    updateCurrencySuffixes();
    PAGES[currentRoute()]();
  });

  updatePeriodLabels();
  updateCurrencySuffixes();
  showPage(currentRoute());
}

// Chart.js + XLSX load via <script defer>; wait for window load to be safe.
if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
