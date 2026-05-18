// Demo dataset matching the original dashboard mockup. Used by the
// "Tải dữ liệu mẫu" button in Settings to show a fully populated dashboard.
import { uuid, DEFAULT_CATEGORIES } from './state.js';

export function buildSampleData() {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7); // current month, eg "2026-05"

  const products = [
    { id: uuid(), name: 'Chaos Rising ETB', image: '', quantity: 10,
      buyPrice: 2_350_000, shipPerUnit: 120_000, declaredPrice: 2_520_000,
      taxPerUnit: 150_000, packagingPerUnit: 50_000, sellPrice: 3_650_000 },
    { id: uuid(), name: 'Pitch Black ETB', image: '', quantity: 8,
      buyPrice: 2_150_000, shipPerUnit: 115_000, declaredPrice: 2_320_000,
      taxPerUnit: 160_000, packagingPerUnit: 45_000, sellPrice: 3_350_000 },
    { id: uuid(), name: 'Booster Bundle', image: '', quantity: 20,
      buyPrice: 550_000, shipPerUnit: 60_000, declaredPrice: 610_000,
      taxPerUnit: 0, packagingPerUnit: 0, sellPrice: 950_000 },
    { id: uuid(), name: 'Elite Trainer Box 151', image: '', quantity: 5,
      buyPrice: 1_950_000, shipPerUnit: 110_000, declaredPrice: 2_080_000,
      taxPerUnit: 130_000, packagingPerUnit: 40_000, sellPrice: 3_100_000 },
    { id: uuid(), name: 'Premium Collection Box', image: '', quantity: 6,
      buyPrice: 1_280_000, shipPerUnit: 85_000, declaredPrice: 1_380_000,
      taxPerUnit: 100_000, packagingPerUnit: 35_000, sellPrice: 2_050_000 },
  ];

  // Spread expenses across the current month so the bar chart looks alive.
  const expenses = [
    { id: uuid(), date: `${ym}-03`, category: 'ship_intl', amount: 4_230_000, note: 'Lô hàng từ Mỹ' },
    { id: uuid(), date: `${ym}-12`, category: 'ship_intl', amount: 4_230_000, note: 'Lô hàng từ Nhật' },
    { id: uuid(), date: `${ym}-05`, category: 'ship_dom', amount: 2_985_000, note: 'Giao tỉnh 15 đơn' },
    { id: uuid(), date: `${ym}-20`, category: 'ship_dom', amount: 2_985_000, note: 'Giao tỉnh 18 đơn' },
    { id: uuid(), date: `${ym}-04`, category: 'tax', amount: 1_245_000, note: 'Thuế nhập khẩu lô 1' },
    { id: uuid(), date: `${ym}-13`, category: 'tax', amount: 1_245_000, note: 'Thuế nhập khẩu lô 2' },
    { id: uuid(), date: `${ym}-06`, category: 'packaging', amount: 765_000, note: 'Hộp + xốp + tem' },
    { id: uuid(), date: `${ym}-22`, category: 'packaging', amount: 765_000, note: 'Hộp + xốp + tem' },
  ];

  const orders = [
    { id: uuid(), code: 'DH0001', date: `${ym}-07`, customerName: 'Nguyễn Văn A', productId: products[0].id, quantity: 1, revenue: 3_650_000, status: 'done' },
    { id: uuid(), code: 'DH0002', date: `${ym}-09`, customerName: 'Trần Thị B', productId: products[2].id, quantity: 2, revenue: 1_900_000, status: 'done' },
    { id: uuid(), code: 'DH0003', date: `${ym}-15`, customerName: 'Phạm Quốc C', productId: products[1].id, quantity: 1, revenue: 3_350_000, status: 'shipped' },
    { id: uuid(), code: 'DH0004', date: `${ym}-21`, customerName: 'Lê Hoàng D', productId: products[3].id, quantity: 1, revenue: 3_100_000, status: 'pending' },
    { id: uuid(), code: 'DH0005', date: `${ym}-25`, customerName: 'Vũ Mạnh E', productId: products[2].id, quantity: 3, revenue: 2_850_000, status: 'pending' },
  ];

  // Ship the canonical category set so the sample dataset always works
  // even if the user previously deleted some defaults.
  const categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));

  return { products, expenses, orders, categories };
}
