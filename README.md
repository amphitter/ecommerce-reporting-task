# NexusOps — E-commerce Sales & Inventory Platform

NexusOps is a high-throughput, performance-focused reporting and analytics platform designed for e-commerce operations. It handles product catalog management, multi-marketplace order dispatching, regional warehouse inventory balances, and executive KPI aggregation with minimal database load.

---

## 1. System Architecture

The architecture separates the presentation and server layers (Next.js deployed on Vercel) from the persistent transactional data layer (Supabase PostgreSQL).

```
                                      CLIENT BROWSER
                                            │
                             HTTPS / JSON / Session Cookie
                                            ▼
                    ┌────────────────────────────────────────────────┐
                    │               VERCEL EDGE & SERVER             │
                    │                  (Next.js 16)                  │
                    │                                                │
                    │  App Router Server Components & Client Slices  │
                    │  ├── Middleware (Session Verification)        │
                    │  ├── Route Handlers (/api/dashboard, etc.)    │
                    │  ├── Streaming CSV Exporters                   │
                    │  └── Zod Input Validation Layer                │
                    └───────────────────────┬────────────────────────┘
                                            │
                                  SSL / Prepared SQL
                                            ▼
                    ┌────────────────────────────────────────────────┐
                    │              SUPABASE POSTGRESQL               │
                    │                                                │
                    │  Normalized Tables:                            │
                    │  ├── products (SKU & Product ID unique)       │
                    │  ├── orders (Order ID unique, final warehouse) │
                    │  ├── inventory (Composite unique SKU + WH)    │
                    │  └── warehouses                               │
                    │                                                │
                    │  Database Functions & Optimization:            │
                    │  ├── get_dashboard_metrics() (Consolidated)   │
                    │  ├── get_inventory_summary()                  │
                    │  └── Composite Indexing Engine                 │
                    └────────────────────────────────────────────────┘
```

### Component Roles

1. **Client Tier**: Renders a compact, high-density interface built with Tailwind CSS and Recharts. The client never receives raw multi-thousand-row datasets; it receives only paginated slices or pre-aggregated chart points.
2. **Next.js Server Tier (Vercel)**:
   - Validates all incoming query parameters and payload structures via Zod schemas.
   - Manages single-admin authentication using signed, HTTP-only session cookies (`jose` JWT) — credentials never touch client storage.
   - Enforces rate-limiting to protect endpoints from abusive requests.
   - Routes database queries directly to PostgreSQL using parameterized inputs.
3. **Database Tier (Supabase PostgreSQL)**:
   - Acts as the single source of truth for transactional records.
   - Executes aggregation, filtering, and sorting close to the disk via PostgreSQL's cost-based query planner.
   - Enforces data integrity through foreign keys, check constraints (`quantity > 0`, `selling_price >= 0`), and unique constraints.

---

## 2. Why PostgreSQL & Supabase?

The platform's workload is relational and reporting-heavy. PostgreSQL was selected over NoSQL/document stores for specific architectural reasons:

- **Relational Integrity**: SKUs, product identifiers, orders, and multi-warehouse stock entries must remain traceable without data divergence.
- **Financial Precision**: Uses `NUMERIC(12,2)` types for monetary values to eliminate binary floating-point rounding errors common in reporting.
- **In-Database Aggregations**: PostgreSQL executes group-bys, conditional sums, and date-range truncations in native compiled C code, returning small JSON summaries to Next.js instead of transferring thousands of rows over the network.
- **Cost-Based Query Optimization**: The engine leverages B-tree and composite indexes to index only what is queried (`order_date`, `marketplace`, `final_warehouse`, `order_status`).

---

## 3. Engineering Decisions: How We Made It Efficient

### Principle 1: Zero `SELECT *`
Every query in the application explicitly lists only the required columns. Unused columns are never fetched, reducing memory consumption, buffer cache pressure, and network serialization overhead.

### Principle 2: Consolidated Dashboard Endpoint (`/api/dashboard`)
Rather than dispatching a separate HTTP request per KPI (e.g., `/api/total-sales`, `/api/returns`, `/api/units`), the dashboard issues **a single consolidated request**. The database executes all 12 KPI calculations, the 30-day sales trend curve, the warehouse throughput donut distribution, and top-selling products in **one database round-trip**.

### Principle 3: Strict Anti-Duplication Inventory Aggregation
When a SKU exists across multiple warehouses (e.g., Delhi = 20, Mumbai = 30), joining orders directly with raw inventory rows multiplies stock counts. The platform strictly **aggregates inventory by SKU first** before joining with product or order records:

```sql
SELECT sku, SUM(available_quantity) AS total_stock
FROM inventory
GROUP BY sku;
```

### Principle 4: Server-Side Pagination & Bounded Page Sizes
Large tables (`/orders`, `/products`, `/inventory`) never stream unbounded records to the DOM. Page sizes are restricted to `25`, `50`, or `100` rows. Zod enforces this strictly on the server:

```typescript
pageSize: z.coerce.number().int().refine(v => [25, 50, 100].includes(v))
```

### Principle 5: Streaming Server-Side CSV Exports
CSV downloads (`/api/exports/orders` and `/api/exports/products`) do not fetch the full table into browser memory. Instead, the server streams the filtered database query output directly as `text/csv; charset=utf-8` using chunked transfer encoding.

### Principle 6: Debounced Input Filtering
All search inputs (SKU, Product Name, Order ID) use a 350ms debounce mechanism, preventing wasteful database requests during active keystrokes.

---

## 4. Business Logic & Calculation Rules

### Warehouse Allocation Rule
Derived canonically during data import:
```
IF allocated_warehouse is present and non-blank:
    USE allocated_warehouse
ELSE IF default_warehouse is present and non-blank:
    USE default_warehouse
ELSE:
    USE "Warehouse Not Assigned"
```

### KPI Formulas
| KPI | Formula / Rule |
|---|---|
| **Total Sales Amount** | `SUM(order_amount)` where `order_status NOT IN ('Cancelled', 'Returned')` |
| **Total Return Amount** | `SUM(order_amount)` where `order_status = 'Returned'` |
| **Total Units Sold** | `SUM(quantity)` where `order_status NOT IN ('Cancelled', 'Returned')` |
| **Total Units Returned** | `SUM(quantity)` where `order_status = 'Returned'` |
| **Return Rate** | `Total Units Returned / Total Units Sold` |
| **Average Order Value** | `Total Sales Amount / Valid Orders Count` |
| **Average Consumption / Day** | `Total Units Sold / Number of Days in Selected Date Range` |
| **Highest-Selling Product** | Maximum `SUM(order_amount)` where `order_status NOT IN ('Cancelled', 'Returned')` *(determined by sales amount)* |
| **Highest Return by Amount** | Maximum `SUM(order_amount)` where `order_status = 'Returned'` |
| **Highest Return by Quantity** | Maximum `SUM(quantity)` where `order_status = 'Returned'` |
| **Lowest-Stock Product** | Minimum `SUM(available_quantity)` across warehouses grouped by SKU |
| **Highest-Stock Product** | Maximum `SUM(available_quantity)` across warehouses grouped by SKU |
| **Warehouse Sales Ratio** | `Warehouse Sales / Total Valid Sales` |

---

## 5. How to Use the Platform

### Step 1: Authentication
1. Navigate to `/login`.
2. Enter your credentials:
   - **Admin ID**: Value of `ADMIN_ID` in `.env.local` (default: `admin`)
   - **Password**: Value of `ADMIN_PASSWORD` in `.env.local`
3. Click **Sign in**. A secure HTTP-Only session cookie will be issued.

### Step 2: Ingesting Datasets
The application starts fresh with zero records. To import data:
1. Go to **Import Data** in the left navigation (`/admin/import`).
2. Select the dataset type:
   - **Products CSV**: `product_id, sku, product_name, category, brand, selling_price, cost_price, default_warehouse, active`
   - **Orders CSV**: `order_id, order_date, marketplace, sku, product_id, category, quantity, selling_price, order_amount, order_status, allocated_warehouse, default_warehouse, final_warehouse`
   - **Inventory CSV**: `sku, product_id, warehouse, available_quantity, reorder_level, inventory_status, last_updated`
3. Select your CSV file and click **Upload & Import**.
4. The pipeline parses rows, applies validation schemas, resolves the canonical warehouse allocation, and executes a bulk upsert.
5. Re-running imports is **idempotent**: unique constraints prevent duplicated records.

### Step 3: Executive Dashboard (`/dashboard`)
- View 12 operational KPIs computed in real time.
- Filter by date range, marketplace, warehouse, product category, order status, or SKU.
- View the **Daily Sales & Returns** trend curve.
- Inspect the **Warehouse Sales Distribution** donut chart.
- Review top-selling SKUs ranked by total sales revenue.

### Step 4: Reports & Table Views
- **Orders Report (`/orders`)**: View transaction-level dispatches with current available stock. Sort by date, quantity, or order amount.
- **Product Performance (`/products`)**: Review catalog-level volume, sales revenue, return leakage, multi-warehouse stock, and top marketplace.
- **Inventory Ledger (`/inventory`)**: Review warehouse stock balances, low-stock warnings, and reorder levels.

### Step 5: Exporting Data
Click **Export CSV** on either the Orders or Products pages. The exported file respects your active filters and streams directly to your browser.

---

## 6. Local Setup & Testing

### Prerequisites
- Node.js 18.17+ or Node.js 20+
- npm 9+

### Installation
```bash
git clone https://github.com/your-username/nexusops.git
cd nexusops
npm install
```

### Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Set the following values:
```env
ADMIN_ID=admin
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=at_least_32_characters_random_secret_string

# Optional: Supabase configuration (when connecting to cloud Supabase)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Run Tests
Execute the Vitest suite covering warehouse allocation, sales/return logic, inventory aggregation, and formula correctness:
```bash
npm test
```

### Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Supabase Database Setup & Migrations

When deploying with Supabase PostgreSQL:

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Open `supabase/migrations/001_init_schema.sql` from this repository.
4. Paste the SQL script and click **Run**.
5. The migration creates:
   - The normalized `products`, `orders`, `inventory`, and `warehouses` tables.
   - All check constraints and unique indexes.
   - The consolidated `get_dashboard_metrics()` and `get_inventory_summary()` stored functions.
6. Retrieve your credentials from **Project Settings > API**:
   - `Project URL` &rarr; `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` &rarr; `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` &rarr; `SUPABASE_SERVICE_ROLE_KEY` *(server-side only)*

---

## 8. Deployment to Vercel

1. Push your repository to GitHub.
2. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
3. Import your GitHub repository.
4. Under **Environment Variables**, add:
   - `ADMIN_ID`: your admin username
   - `ADMIN_PASSWORD`: your admin password
   - `SESSION_SECRET`: a 32+ character random string
   - `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: your Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY`: your Supabase service role key
5. Build settings will auto-detect Next.js.
6. Click **Deploy**.

---

## 9. Future Scalability Blueprint

While the current architecture easily handles millions of rows using indexed PostgreSQL queries, the system has a straightforward scaling roadmap for higher scale:

1. **Table Partitioning (10M+ Orders)**: Partition the `orders` table by month (`RANGE (order_date)`) to allow PostgreSQL to prune partition scans on date-range queries.
2. **Materialized Reporting Views**: Use hourly or daily refreshed materialized views for historical periods to make dashboard queries near-instantaneous.
3. **Read Replicas**: Direct all reporting and analytical reads (`/api/dashboard`, `/api/exports`) to a Supabase read replica while transactional writes target the primary node.
4. **Edge CDN Caching**: Cache static filter dropdowns (`/api/filter-options`) using `stale-while-revalidate` at the Vercel Edge.
