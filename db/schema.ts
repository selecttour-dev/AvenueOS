import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------

export const bookingStatusEnum = pgEnum("booking_status", [
  "inquiry", // მოთხოვნა
  "tentative", // წინასწარი
  "confirmed", // დადასტურებული
  "completed", // ჩატარებული
  "cancelled", // გაუქმებული
]);

export const eventTypeEnum = pgEnum("event_type", [
  "wedding",
  "birthday",
  "corporate",
  "anniversary",
  "memorial",
  "other",
]);

export const ledgerTypeEnum = pgEnum("ledger_type", [
  "income",
  "expense",
  "wage",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "transfer",
  "card",
]);

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "unpaid",
  "partial",
  "paid",
]);

export const unitEnum = pgEnum("unit", ["kg", "l", "pc"]);

const money = (name: string) =>
  numeric(name, { precision: 12, scale: 2, mode: "number" });

// ---------- Core ----------

export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  capacity: integer("capacity"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable(
  "settings",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [uniqueIndex("settings_venue_key").on(t.venueId, t.key)],
);

// ---------- CRM / Bookings ----------

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    clientId: integer("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    packageId: integer("package_id").references(() => packages.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    eventType: eventTypeEnum("event_type").notNull().default("other"),
    eventDate: date("event_date").notNull(),
    startTime: text("start_time"),
    endTime: text("end_time"),
    guestCount: integer("guest_count").notNull().default(0),
    pricePerGuest: money("price_per_guest").notNull().default(0),
    extraCharges: money("extra_charges").notNull().default(0),
    discount: money("discount").notNull().default(0),
    status: bookingStatusEnum("status").notNull().default("inquiry"),
    notes: text("notes"),
    // What the client wants for this event (menu wishes, decor, timing…).
    requirements: text("requirements"),
    reminderSentAt: text("reminder_sent_at"), // last reminder day tag "YYYY-MM-DD:N"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("bookings_venue_date").on(t.venueId, t.eventDate)],
);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  paidOn: date("paid_on").notNull(),
  amount: money("amount").notNull(),
  method: paymentMethodEnum("method").notNull().default("cash"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: money("price").notNull().default(0),
  cost: money("cost").notNull().default(0),
  perGuest: boolean("per_guest").notNull().default(false),
  active: boolean("active").notNull().default(true),
});

export const bookingServices = pgTable("booking_services", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  serviceId: integer("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  qty: integer("qty").notNull().default(1),
});

// ---------- Staff / Daily register ----------

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  phone: text("phone"),
  dailyRate: money("daily_rate").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const ledger = pgTable(
  "ledger",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    entryDate: date("entry_date").notNull(),
    type: ledgerTypeEnum("type").notNull(),
    category: text("category"),
    staffId: integer("staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    bookingId: integer("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    // Set when this income row mirrors a booking payment — deleting the
    // payment removes the register row too (single source of truth).
    paymentId: integer("payment_id").references(() => payments.id, {
      onDelete: "cascade",
    }),
    amount: money("amount").notNull(),
    qty: numeric("qty", { precision: 10, scale: 2, mode: "number" })
      .notNull()
      .default(1),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ledger_venue_date").on(t.venueId, t.entryDate)],
);

export const dayCloses = pgTable(
  "day_closes",
  {
    id: serial("id").primaryKey(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    closeDate: date("close_date").notNull(),
    openingBalance: money("opening_balance").notNull().default(0),
    income: money("income").notNull().default(0),
    wages: money("wages").notNull().default(0),
    expenses: money("expenses").notNull().default(0),
    net: money("net").notNull().default(0),
    expectedCash: money("expected_cash").notNull().default(0),
    countedCash: money("counted_cash"),
    difference: money("difference"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("day_closes_venue_date").on(t.venueId, t.closeDate)],
);

// ---------- Suppliers / Purchases ----------

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
});

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  supplierId: integer("supplier_id").references(() => suppliers.id, {
    onDelete: "set null",
  }),
  purchaseDate: date("purchase_date").notNull(),
  total: money("total").notNull().default(0),
  paid: money("paid").notNull().default(0),
  status: purchaseStatusEnum("status").notNull().default("unpaid"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Calculations (menu costing) ----------

export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  unit: unitEnum("unit").notNull().default("kg"),
  pricePerUnit: money("price_per_unit").notNull().default(0),
  wastePct: numeric("waste_pct", { precision: 5, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  supplierId: integer("supplier_id").references(() => suppliers.id, {
    onDelete: "set null",
  }),
});

export const dishCategories = pgTable("dish_categories", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
});

// Top-level menu kind: traditional Georgian, buffet (ფურშეტი), etc.
export const menuTypes = pgTable("menu_types", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const dishes = pgTable("dishes", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => dishCategories.id, {
    onDelete: "set null",
  }),
  menuTypeId: integer("menu_type_id").references(() => menuTypes.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  sellPrice: money("sell_price").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const dishIngredients = pgTable("dish_ingredients", {
  id: serial("id").primaryKey(),
  dishId: integer("dish_id")
    .notNull()
    .references(() => dishes.id, { onDelete: "cascade" }),
  ingredientId: integer("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  // qty per portion, in grams / ml / pieces depending on ingredient unit
  qty: numeric("qty", { precision: 10, scale: 2, mode: "number" }).notNull(),
});

export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  menuTypeId: integer("menu_type_id").references(() => menuTypes.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  pricePerGuest: money("price_per_guest").notNull().default(0),
  manualCostPerGuest: money("manual_cost_per_guest"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

export const packageDishes = pgTable("package_dishes", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id")
    .notNull()
    .references(() => packages.id, { onDelete: "cascade" }),
  dishId: integer("dish_id")
    .notNull()
    .references(() => dishes.id, { onDelete: "cascade" }),
  qtyPerGuest: numeric("qty_per_guest", {
    precision: 10,
    scale: 3,
    mode: "number",
  })
    .notNull()
    .default(1),
});

// Ad-hoc per-event menu (dishes chosen directly for one booking, no package)
export const bookingDishes = pgTable("booking_dishes", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  dishId: integer("dish_id")
    .notNull()
    .references(() => dishes.id, { onDelete: "cascade" }),
  qty: numeric("qty", { precision: 12, scale: 3, mode: "number" })
    .notNull()
    .default(1),
  // true → qty is per guest (×guests); false → qty is the total for the event
  perGuest: boolean("per_guest").notNull().default(true),
});

// ---------- Inventory ----------

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"),
  unit: text("unit").notNull().default("ცალი"),
  quantity: numeric("quantity", { precision: 12, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  unitPrice: money("unit_price").notNull().default(0),
  perGuest: numeric("per_guest", { precision: 10, scale: 3, mode: "number" }),
  minQty: numeric("min_qty", { precision: 12, scale: 2, mode: "number" }),
});

// Which inventory items a dish "consumes" while served (e.g. lobiani → 1 plate)
export const dishInventory = pgTable("dish_inventory", {
  id: serial("id").primaryKey(),
  dishId: integer("dish_id")
    .notNull()
    .references(() => dishes.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  qtyPerPortion: numeric("qty_per_portion", {
    precision: 10,
    scale: 3,
    mode: "number",
  })
    .notNull()
    .default(1),
});

export const inventoryMoves = pgTable("inventory_moves", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  moveDate: date("move_date").notNull(),
  delta: numeric("delta", { precision: 12, scale: 2, mode: "number" }).notNull(),
  reason: text("reason"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Fixed costs ----------

export const fixedCosts = pgTable("fixed_costs", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  monthlyAmount: money("monthly_amount").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// One-off business costs paid from advances. kind:
//  'operational' = deducted from overall profit
//  'partner_advance' = money partners pre-took → recovered from future profit
export const operationalExpenses = pgTable("operational_expenses", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: money("amount").notNull().default(0),
  kind: text("kind").notNull().default("operational"),
  category: text("category"),
  note: text("note"),
  spentOn: date("spent_on"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Telegram reminder recipients ----------

export const telegramRecipients = pgTable("telegram_recipients", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Partners (profit split) ----------

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sharePct: numeric("share_pct", { precision: 5, scale: 2, mode: "number" })
    .notNull()
    .default(50),
  // Personal advance the partner took (a debt repaid from profit over time).
  advanceAmount: money("advance_amount").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// Money a partner has taken out (advance or profit withdrawal).
export const partnerDraws = pgTable("partner_draws", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  partnerId: integer("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  drawDate: date("draw_date").notNull(),
  amount: money("amount").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A repayment that reduces a partner's advance debt (from a day's profit).
export const advanceRepayments = pgTable("advance_repayments", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  partnerId: integer("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  repayDate: date("repay_date").notNull(),
  amount: money("amount").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
