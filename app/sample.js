// Demo dataset matching the original dashboard mockup. Used by the
// "Tải dữ liệu mẫu" button in Settings to show a fully populated dashboard.
import { uuid, DEFAULT_CATEGORIES } from './state.js';

export function buildSampleData() {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7); // current month, eg "2026-05"
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = prev.toISOString().slice(0, 7); // previous month

  const products = [
    { id: uuid(), name: 'Chaos Rising ETB', image: '', quantity: 10, weight: 1.8,
      buyPrice: 95, shipPerUnit: 4.9, declaredPrice: 100,
      taxPerUnit: 6, packagingPerUnit: 2, sellPrice: 150 },
    { id: uuid(), name: 'Pitch Black ETB', image: '', quantity: 8, weight: 1.8,
      buyPrice: 87, shipPerUnit: 4.7, declaredPrice: 92,
      taxPerUnit: 6.4, packagingPerUnit: 1.8, sellPrice: 135 },
    { id: uuid(), name: 'Booster Bundle', image: '', quantity: 20, weight: 0.8,
      buyPrice: 22, shipPerUnit: 2.4, declaredPrice: 24,
      taxPerUnit: 0, packagingPerUnit: 0, sellPrice: 38 },
    { id: uuid(), name: 'Elite Trainer Box 151', image: '', quantity: 5, weight: 2.2,
      buyPrice: 79, shipPerUnit: 4.4, declaredPrice: 84,
      taxPerUnit: 5.2, packagingPerUnit: 1.6, sellPrice: 125 },
    { id: uuid(), name: 'Premium Collection Box', image: '', quantity: 6, weight: 1.4,
      buyPrice: 52, shipPerUnit: 3.4, declaredPrice: 55,
      taxPerUnit: 4, packagingPerUnit: 1.4, sellPrice: 83 },
  ];

  // Spread expenses across the current month so the bar chart looks alive.
  const expenses = [
    { id: uuid(), date: `${ym}-03`, category: 'ship_intl', amount: 175, note: 'Lô hàng từ Mỹ' },
    { id: uuid(), date: `${ym}-12`, category: 'ship_intl', amount: 175, note: 'Lô hàng từ Nhật' },
    { id: uuid(), date: `${ym}-05`, category: 'ship_dom', amount: 120, note: 'Giao tỉnh 15 đơn' },
    { id: uuid(), date: `${ym}-20`, category: 'ship_dom', amount: 120, note: 'Giao tỉnh 18 đơn' },
    { id: uuid(), date: `${ym}-04`, category: 'tax', amount: 50, note: 'Thuế nhập khẩu lô 1' },
    { id: uuid(), date: `${ym}-13`, category: 'tax', amount: 50, note: 'Thuế nhập khẩu lô 2' },
    { id: uuid(), date: `${ym}-06`, category: 'packaging', amount: 30, note: 'Hộp + xốp + tem' },
    { id: uuid(), date: `${ym}-22`, category: 'packaging', amount: 30, note: 'Hộp + xốp + tem' },
  ];

  const orders = [
    { id: uuid(), code: 'DH0001', date: `${ym}-07`, customerName: 'Nguyễn Văn A', productId: products[0].id, quantity: 1, revenue: 150, status: 'done' },
    { id: uuid(), code: 'DH0002', date: `${ym}-09`, customerName: 'Trần Thị B', productId: products[2].id, quantity: 2, revenue: 76, status: 'done' },
    { id: uuid(), code: 'DH0003', date: `${ym}-15`, customerName: 'Phạm Quốc C', productId: products[1].id, quantity: 1, revenue: 135, status: 'shipped' },
    { id: uuid(), code: 'DH0004', date: `${ym}-21`, customerName: 'Lê Hoàng D', productId: products[3].id, quantity: 1, revenue: 125, status: 'pending' },
    { id: uuid(), code: 'DH0005', date: `${ym}-25`, customerName: 'Vũ Mạnh E', productId: products[2].id, quantity: 3, revenue: 114, status: 'pending' },
  ];

  // Shipments hold the 5 flat cost components entered directly (the model the
  // dashboard is built on). Lô #1 matches the money-notebook example:
  // 2890 + 16 + 60 + (3% × 2890 = 86.7) + (38lb × 4 = 152) = 3205.7
  const shipments = [
    { id: uuid(), code: 'LH001', name: 'Lô TCGplayer', date: `${ym}-03`, status: 'sold',
      purchaseCost: 2890, packagingCost: 16, domesticShip: 60,
      insurancePct: 3, weight: 38, intlRate: 4, sellPrice: 3800,
      notes: '20 ETB + 17 bundle' },
    { id: uuid(), code: 'LH002', name: 'Lô eBay', date: `${ym}-15`, status: 'selling',
      purchaseCost: 1450, packagingCost: 10, domesticShip: 35,
      insurancePct: 3, weight: 18, intlRate: 4, sellPrice: 1950,
      notes: 'Premium collection boxes' },
    { id: uuid(), code: 'LH003', name: 'Lô tháng trước', date: `${prevYm}-18`, status: 'sold',
      purchaseCost: 2100, packagingCost: 14, domesticShip: 48,
      insurancePct: 3, weight: 26, intlRate: 4, sellPrice: 2780,
      notes: 'Lô đã hoàn tất tháng trước' },
  ];

  // Ship the canonical category set so the sample dataset always works
  // even if the user previously deleted some defaults.
  const categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));

  return { products, expenses, orders, categories, shipments };
}
