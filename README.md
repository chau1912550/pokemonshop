# Pokemon Shop — Dashboard lợi nhuận

Web app theo dõi doanh thu, lợi nhuận, phí ship và đơn hàng cho shop Pokemon TCG. Vanilla HTML/CSS/JS, không build step, dữ liệu lưu trên `localStorage` của trình duyệt.

## Tính năng

- **Dashboard tổng quan**: 5 KPI (Tổng vốn, Phí ship, Doanh thu, Lợi nhuận, Biên lợi nhuận), bảng sản phẩm, bộ tính nhanh, biểu đồ cột & donut, thông tin nổi bật.
- **Sản phẩm**: CRUD đầy đủ, gắn vào lô hàng để tự tính ship theo cân nặng.
- **Lô hàng**: quản lý từng đợt nhập với 2 mức phí ship/pound (US nội địa + US → VN). Có "Tính nhanh phí ship theo cân nặng".
- **Chi phí**: ghi nhận chi phí theo phân loại (ship, thuế, đóng gói, marketing...). Phân loại có thể tự thêm/sửa.
- **Đơn hàng**: theo dõi đơn với trạng thái + auto-fill doanh thu từ giá bán.
- **Báo cáo**: KPI tổng + chart Top sản phẩm, xuất Excel multi-sheet.
- **Cài đặt**: đổi tiền tệ (VND ↔ USD), backup/restore JSON, tải dữ liệu mẫu, quản lý phân loại chi phí.

## Cách chạy

Cần một HTTP server (ES modules không chạy qua `file://`):

```bash
# Cách 1: Python (đã có sẵn)
python devserver.py 5500

# Cách 2: Node + serve
npx serve -l 5500 .
```

Mở `http://localhost:5500` trong trình duyệt.

## Cấu trúc

```
pokemonshop/
├── index.html           # Skeleton 7 trang
├── devserver.py         # Threaded HTTP server với no-cache headers
├── css/styles.css       # Styles + form design rules
└── app/
    ├── app.js           # Router, init, keyboard shortcuts
    ├── state.js         # Store + localStorage + CRUD wrappers
    ├── utils.js         # Formatters, number input, profit calc
    ├── modal.js         # Modal controller
    ├── sample.js        # Demo dataset
    └── pages/
        ├── dashboard.js
        ├── products.js
        ├── shipments.js
        ├── expenses.js
        ├── orders.js
        ├── reports.js
        └── settings.js
```

## Công thức lợi nhuận

```
shipPerUnit = shipmentId ? weight × (usRate + intlRate) : manualShip
profitPerUnit = sellPrice − buyPrice − shipPerUnit − taxPerUnit − packagingPerUnit
totalProfit = profitPerUnit × quantity
margin = profitPerUnit / sellPrice × 100
```

## Keyboard shortcuts

- `1`–`7`: nhảy nhanh giữa các trang sidebar
- `Ctrl+K`: mở form thêm sản phẩm
- `Ctrl+E`: xuất Excel
