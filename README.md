# NexusOps — E-commerce Sales & Inventory Reporting Platform

NexusOps is a high-performance, enterprise-grade e-commerce operations analytics platform engineered for operations leads, financial analysts, and fulfillment coordinators managing multi-marketplace catalog products, order dispatches, stock balances, and regional fulfillment hubs.

The platform is designed around six core engineering principles: **Correctness, Low Database Load, High Throughput, Clean Enterprise UX, Simple Architecture, and Scalability**.

---

## 🚀 Key Features

- **Consolidated Analytics Dashboard**: 12 operational KPIs calculated at the database layer (Total Sales, Total Returns, Units Sold/Returned, Return Rate, Average Order Value, Average Daily Consumption, Top Revenue Champion by Sales Amount, Return Anomalies by Amount & Quantity, Stock Out Alert, Highest Stock Buffer).
- **Interactive Visualizations**:
  - Daily Sales & Returns Flow (Recharts dual area gradient curve).
  - Warehouse Allocation & Throughput Share (interactive donut chart with dynamic percentage shares).
- **Multi-Facility Order Ledger (`/orders`)**:
  - Full transactional order list with multi-marketplace channel attribution (Amazon, Flipkart, Myntra, Meesho, Shopify).
  - Real-time warehouse routing using canonical allocation logic.
  - Server-side pagination (25, 50, 100 rows per page), sorting, debounced search, and zero-inventory-duplication stock lookup.
- **Catalog Performance Ledger (`/products`)**:
  - Product-level performance aggregating unit sales, returned values, multi-warehouse stock totals, active warehouse counts, and top-selling channels.
  - Strict inventory pre-aggregation preventing double-counting across multi-node inventory.
- **Inventory & Reorder Control (`/inventory`)**:
  - Real-time visibility into multi-node stock balances (`WH-NORTH`, `WH-SOUTH`, `WH-EAST`, `WH-WEST`).
  - Critical restock alerts when stock drops below designated safety reorder thresholds.
  - Fast filtering by stock state: `All`, `In Stock`, `Low Stock`, `Out of Stock`.
- **Idempotent CSV Import Pipeline (`/admin/import`)**:
  - Bulk ingestion pipeline for `products.csv` (1,000 items), `orders.csv` (5,000 items), and `inventory.csv` (4,000 items).
  - Row-level Zod validation, price checks, non-negative quantity constraints.
  - Re-importing does not create duplicates.
- **Filtered Server-Side CSV Exports**:
  - Order-wise and Product-wise export endpoints that stream CSV downloads directly from filtered database queries without downloading the entire dataset to the browser.
- **Enterprise Security & Auth**:
  - Single admin authentication backed by HTTP-Only encrypted session cookies (`jose` JWT).
  - In-memory rate limiting against brute force attempts.
  - Route protection middleware safeguarding all operational views and APIs.
  - Supabase service role credentials never exposed to client browsers.

---

## 📐 Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js (App Router, Server Components & Dynamic Route Handlers) |
| **Language** | TypeScript (Strict Mode) |
| **Styling** | Tailwind CSS (Corporate Modern aesthetic per Executive Precision design tokens) |
| **Database** | Supabase PostgreSQL (Production) / Embedded Relational SQL Engine (Local) |
| **Charts** | Recharts |
| **Validation** | Zod |
| **Icons** | Lucide React |
| **Session / Auth** | `jose` (HS256 encrypted HTTP-Only cookies) |
| **CSV Parser** | `csv-parse` (Streaming sync bulk engine) |
| **Testing** | Vitest |

---

## 🏛 Database Schema & Design

The database schema is normalized into 4 primary relational tables with constraints and access-pattern indexes:

```
┌────────────────────────────────────────────────────────┐
│                        products                        │
├────────────────────────────────────────────────────────┤
│ id                 SERIAL PRIMARY KEY                  │
│ product_id         TEXT UNIQUE NOT NULL                │
│ sku                TEXT UNIQUE NOT NULL                │
│ product_name       TEXT NOT NULL                       │
│ category           TEXT NOT NULL                       │
│ brand              TEXT NOT NULL                       │
│ selling_price      NUMERIC(12,2) NOT NULL              │
│ cost_price         NUMERIC(12,2) NOT NULL              │
│ default_warehouse  TEXT NOT NULL                       │
│ active             CHAR(1) DEFAULT 'Y'                 │
│ created_at         TIMESTAMPTZ DEFAULT NOW()           │
│ updated_at         TIMESTAMPTZ DEFAULT NOW()           │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                         orders                         │
├────────────────────────────────────────────────────────┤
│ id                  SERIAL PRIMARY KEY                 │
│ order_id            TEXT UNIQUE NOT NULL               │
│ order_date          DATE NOT NULL                      │
│ marketplace         TEXT NOT NULL                      │
│ sku                 TEXT NOT NULL                      │
│ product_id          TEXT NOT NULL                      │
│ category            TEXT NOT NULL                      │
│ quantity            INTEGER NOT NULL CHECK (qty > 0)   │
│ selling_price       NUMERIC(12,2) NOT NULL             │
│ order_amount        NUMERIC(12,2) NOT NULL             │
│ order_status        TEXT NOT NULL                      │
│ allocated_warehouse TEXT                               │
│ default_warehouse   TEXT                               │
│ final_warehouse     TEXT NOT NULL                      │
│ created_at          TIMESTAMPTZ DEFAULT NOW()          │
└────────────────────────────────────────────────────────┘
                           ▲
                           │
┌────────────────────────────────────────────────────────┐
│                       inventory                        │
├────────────────────────────────────────────────────────┤
│ id                 SERIAL PRIMARY KEY                  │
│ sku                TEXT NOT NULL                       │
│ product_id         TEXT NOT NULL                       │
│ warehouse          TEXT NOT NULL                       │
│ available_quantity INTEGER NOT NULL CHECK (qty >= 0)   │
│ reorder_level      INTEGER NOT NULL CHECK (rl >= 0)    │
│ inventory_status   TEXT NOT NULL                       │
│ last_updated       DATE NOT NULL                       │
│ UNIQUE(sku, warehouse)                                 │
└────────────────────────────────────────────────────────┘
```

### Critical Access Pattern Indexes
- `idx_orders_order_date`: Date range queries and daily aggregation.
- `idx_orders_sku`: Order-to-product joins and SKU searches.
- `idx_orders_composite_filter`: Composite filter on `(order_date, marketplace, final_warehouse, order_status)`.
- `idx_inventory_sku`: Fast SKU-level inventory grouping.
- `idx_inventory_warehouse`: Multi-node warehouse queries.

---

## 💼 Core Business Rules & Formulas

### 1. Canonical Warehouse Allocation Rule
```
If allocated_warehouse is present and not blank:
    final_warehouse = allocated_warehouse
Else if default_warehouse is present and not blank:
    final_warehouse = default_warehouse
Else:
    final_warehouse = "Warehouse Not Assigned"
```
The canonical `final_warehouse` is computed during import and applied consistently across order tracking, warehouse metrics, and the warehouse sales ratio donut chart.

### 2. Valid Sales & Return Metrics
- **Valid Sales Amount**: `SUM(order_amount)` where `order_status NOT IN ('Cancelled', 'Returned')`.
- **Total Return Amount**: `SUM(order_amount)` where `order_status = 'Returned'`.
- **Total Units Sold**: `SUM(quantity)` where `order_status NOT IN ('Cancelled', 'Returned')`.
- **Total Units Returned**: `SUM(quantity)` where `order_status = 'Returned'`.
- **Return Rate**: `Total Units Returned / Total Units Sold`.
- **Average Order Value (AOV)**: `Total Sales Amount / Number of Valid Orders`.
- **Average Daily Consumption**: `Total Units Sold / Number of Days in Selected Range`.
- **Highest Selling Product**: Product with maximum total sales amount (clearly noted in UI).

### 3. Inventory Aggregation Rule (Anti-Duplication)
A single SKU can exist across multiple regional warehouses (`WH-NORTH`, `WH-SOUTH`, etc.). To prevent duplicate stock and sales totals when joining tables, **inventory is grouped by SKU first** before joining with product or order records:
```sql
SELECT sku, SUM(available_quantity) AS total_stock
FROM inventory
GROUP BY sku;
```

---

## 🛠 Local Setup & Development

### Prerequisites
- Node.js 18.17+ or 20+
- npm 9+

### 1. Clone & Install
```bash
git clone https://github.com/your-username/ecommerce-reporting-platform.git
cd ecommerce-reporting-platform
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Set the credentials:
```env
ADMIN_ID=admin
ADMIN_PASSWORD=admin123
SESSION_SECRET=nexusops-super-secure-jwt-secret-key-32bytes-min
# Optional: Set remote Supabase credentials when deploying to Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Business Logic Tests
```bash
npm test
```
Executes the Vitest test suite covering warehouse allocation, sales/returns exclusions, return rate, AOV, and inventory aggregation rules.

---

## 📥 Ingesting Data

1. Log in at `/login` using:
   - **Admin ID**: `admin`
   - **Password**: `admin123`
2. Navigate to **Admin / Import** (`/admin/import`).
3. Select the dataset:
   - **Products CSV** (`products.csv`, 1,000 rows)
   - **Orders CSV** (`orders.csv`, 5,000 rows)
   - **Inventory CSV** (`inventory.csv`, 4,000 rows)
4. Upload your CSV files (`products.csv`, `orders.csv`, `inventory.csv`) and click **Upload & Import**.
5. Inspect the validation summary. Once imported, all operational dashboards and reports are immediately populated.

---

## 🌐 Deploying to Vercel with Supabase

### 1. Set Up Supabase Project
1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase and run the migration script:
   `supabase/migrations/001_init_schema.sql`
   This sets up the normalized tables, indexes, triggers, and the consolidated PostgreSQL RPC function `get_dashboard_metrics()`.

### 2. Deploy to Vercel
1. Import your repository into Vercel.
2. In the Vercel Project Settings &rarr; **Environment Variables**, add:
   - `ADMIN_ID`: your admin ID (e.g. `admin`)
   - `ADMIN_PASSWORD`: your secure admin password
   - `SESSION_SECRET`: 32+ character random string
   - `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: your Supabase anonymous public key
   - `SUPABASE_SERVICE_ROLE_KEY`: your Supabase service role private key
3. Click **Deploy**.

---

## ⚡ Performance & Scalability Strategy

### Why PostgreSQL + Supabase?
- Relational integrity with foreign keys and unique constraints (`sku`, `order_id`, `(sku, warehouse)`).
- Native numeric precision types (`NUMERIC(12,2)`) to eliminate floating-point arithmetic errors in financial calculations.
- Sophisticated cost-based query optimizer that leverages multi-column composite indexes.
- Single database round-trip RPC functions combining 12 KPI aggregations, trend series, and allocation shares.

### Optimization Decisions Implemented
1. **Consolidated Dashboard Endpoint**: `/api/dashboard` returns all KPI cards, daily velocity charts, warehouse donut charts, and top products in a single database round-trip.
2. **Server-Side Pagination**: Large tables (`/orders`, `/products`, `/inventory`) only fetch 25, 50, or 100 rows per request.
3. **No `SELECT *`**: Queries specify only the exact columns required by the UI.
4. **Debounced Search**: Search filters are debounced by 350ms to prevent spamming the database on keystrokes.
5. **No Bulk Dataset in Client Memory**: Aggregations are performed at the SQL engine level.

### Path to Scale (100x Volume)
- **Table Partitioning**: Range-partition the `orders` table by year/month (`order_date`) for fast pruning.
- **Materialized Views**: Daily pre-aggregated views refreshed periodically for historical months.
- **Read Replicas**: Route reporting queries to read replicas while transactional order writes hit the primary database.
