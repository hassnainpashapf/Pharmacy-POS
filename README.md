# System Optix Pharmacy POS Station 🏥💊

An enterprise-grade, offline-first Pharmacy Point of Sale (POS) and inventory management system designed for fast-paced retail pharmacies, hospitals, and multi-branch distribution chains.

Built with **React 18**, **Electron**, **Tailwind CSS**, and **Capacitor**, providing seamless operation across **Windows Desktop**, **Web**, and **Mobile** platforms.

---

## 🌟 Key Features

### ⚡ Rapid POS Counter & Billing
* **High-Speed Checkout**: Optimized for barcode scanners, touchscreen monitors, and keyboard shortcuts.
* **Batch & Expiry Management**: FEFO (First-Expired, First-Out) stock dispensing with automated warnings for near-expiry or expired medicines.
* **Prescription & Composition Lookup**: Real-time generic medicine alternative suggestions and dosage guidance.
* **Split Payments & Discounts**: Cash, Card, Bank Transfer, and Customer Credit with itemized or invoice-level discounting.
* **Shift Management**: Cash-drawer opening floats, blind reconciliation, day-end shift closures, and Z-reports.

### 📦 Smart Inventory & Supply Chain
* **Real-time Stock Tracking**: Automatic stock deductions across batches, packs, strips, and loose units.
* **Low Stock & Expiry Alerts**: Visual notifications and automated replenishment alerts for essential medicines.
* **Supplier & Purchase Orders**: Purchase order generation, Goods Received Notes (GRN), invoice matching, and supplier return tracking.
* **Wholesale & B2B Distribution**: Separate rate structures, bulk order fulfillment, and distributor ledgers.

### 🔍 Camera Barcode & OCR Label Scanning
* **Integrated Barcode Scanner**: In-browser camera scanning powered by `@zxing/browser` for camera-equipped laptops and tablets.
* **Medicine Label OCR**: On-device optical character recognition using **Tesseract.js** to scan batch numbers, manufacturing, and expiry dates from medicine packages.

### 🌐 Offline-First Resilience & Sync
* **Zero Downtime**: Runs 100% offline using client-side caching and IndexedDB storage.
* **Automatic Cloud Synchronization**: Queues transactions locally during network drops and syncs cleanly once connectivity is restored.
* **Hardware Station Support**: ESC/POS thermal receipt printers, customer displays, barcode scanners, and electronic cash drawers.

### 🔒 Enterprise Security & Administration
* **Role-Based Access Control (RBAC)**: Fine-grained permissions for Cashier, Pharmacist, Store Manager, Accountant, and Superadmin.
* **Full Audit Trail**: Tamper-evident logging of price changes, stock adjustments, voided bills, and user logins.
* **Disaster Recovery & Local Backups**: One-click local database backup and restore routines.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 6, React Router 7, Tailwind CSS, Lucide Icons |
| **Data Visualization** | Recharts |
| **Desktop Runtime** | Electron 44, Electron Builder, NSIS Installer |
| **Mobile Runtime** | Capacitor 8 (Android & iOS) |
| **Vision & Scanning** | ZXing Browser, Tesseract.js OCR |
| **Local Storage** | IndexedDB & Local Cache with Sync Hooks |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** >= 22.0.0
* **npm** or **yarn**

### 1. Clone & Install
```bash
git clone https://github.com/hassnainpashapf/Pharmacy-POS.git
cd Pharmacy-POS
npm install
```

### 2. Development Mode
```bash
# Run web station in development mode (Vite)
npm run dev

# Or launch Desktop Electron window
npm run electron:dev
```

### 3. Production Builds

#### Web Station
```bash
npm run build
npm run serve:web
```

#### Windows Desktop Installer (`.exe`)
```bash
npm run electron:build:win
```
*Generated output: `release/System Optix Pharmacy Station Setup 1.0.0.exe`*

#### macOS Installer (`.dmg`)
```bash
npm run electron:build:mac
```

#### Mobile Apps (Capacitor Android / iOS)
```bash
npm run mobile:sync
npm run android:open
npm run ios:open
```

---

## 📂 Project Directory Structure

```plaintext
pharmacy-pos/
├── electron/              # Electron main process & IPC handlers
│   ├── main.cjs           # Window lifecycle, hardware & GPU flags
│   └── preload.cjs        # Secure preload bridge
├── src/
│   ├── components/        # Reusable UI widgets, charts, and hardware modlets
│   │   ├── AICopilot.jsx
│   │   ├── BarcodeScanner.jsx
│   │   ├── MedicineLabelScanner.jsx
│   │   ├── ShiftModal.jsx
│   │   └── SyncStatusBar.jsx
│   ├── pages/             # App views
│   │   ├── POS.jsx             # Point of Sale Counter
│   │   ├── Dashboard.jsx       # KPIs, Revenue & Sales charts
│   │   ├── Inventory.jsx       # Stock, Batches & Expiry control
│   │   ├── Medicines.jsx       # Formulary & generic catalog
│   │   ├── Purchases.jsx       # Supplier orders & GRN
│   │   ├── Reports.jsx         # Accounting, Tax & Profit reports
│   │   └── Users.jsx           # Team & Role management
│   ├── lib/               # Database, sync engines & utilities
│   ├── App.jsx            # Main app shell & routing
│   └── main.jsx           # React DOM root entry
├── scripts/               # Custom build & distribution scripts
│   ├── build-windows.cjs  # NSIS packaging helper
│   ├── serve-browser.cjs  # High-speed static & binary stream server
│   └── prepare-ocr.mjs    # OCR engine initialization
└── package.json           # Dependencies, scripts & electron metadata
```

---

## 📄 License
This project is proprietary software developed by **System Optix**. All rights reserved.
