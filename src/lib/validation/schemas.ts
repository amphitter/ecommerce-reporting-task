import { z } from "zod";

export const dashboardQuerySchema = z.object({
  from: z.string().date().optional().or(z.literal("").transform(() => undefined)),
  to: z.string().date().optional().or(z.literal("").transform(() => undefined)),
  marketplace: z.string().optional().or(z.literal("").transform(() => undefined)),
  warehouse: z.string().optional().or(z.literal("").transform(() => undefined)),
  sku: z.string().optional().or(z.literal("").transform(() => undefined)),
  category: z.string().optional().or(z.literal("").transform(() => undefined)),
  status: z.string().optional().or(z.literal("").transform(() => undefined)),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().refine(v => [25, 50, 100].includes(v), "Page size must be 25, 50, or 100").default(50),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const ordersQuerySchema = dashboardQuerySchema.merge(paginationSchema).extend({
  search: z.string().optional().or(z.literal("").transform(() => undefined)),
});

export const productsQuerySchema = dashboardQuerySchema.merge(paginationSchema).extend({
  search: z.string().optional().or(z.literal("").transform(() => undefined)),
});

export const inventoryQuerySchema = paginationSchema.extend({
  search: z.string().optional().or(z.literal("").transform(() => undefined)),
  warehouse: z.string().optional().or(z.literal("").transform(() => undefined)),
  status: z.string().optional().or(z.literal("").transform(() => undefined)),
});

export const loginSchema = z.object({
  adminId: z.string().min(1, "Admin ID required"),
  password: z.string().min(1, "Password required"),
});

export type DashboardFilters = z.infer<typeof dashboardQuerySchema>;
export type OrdersFilters = z.infer<typeof ordersQuerySchema>;
export type ProductsFilters = z.infer<typeof productsQuerySchema>;
export type InventoryFilters = z.infer<typeof inventoryQuerySchema>;
