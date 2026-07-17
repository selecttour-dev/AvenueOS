import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  bookingDishes,
  bookings,
  clients,
  dayCloses,
  dishCategories,
  dishes,
  dishIngredients,
  dishInventory,
  fixedCosts,
  ingredients,
  inventoryItems,
  ledger,
  menuTypes,
  operationalExpenses,
  packageDishes,
  partnerDraws,
  partners,
  packages,
  payments,
  purchases,
  settings,
  staff,
  suppliers,
} from "@/db/schema";
import {
  PARAM_KEYS,
  breakEvenEvents,
  contributionPerEvent,
  type ModelParams,
} from "./forecast-shared";
import { todayISO } from "./format";
import { bookingTotal, type BookingRow } from "./booking-shared";
import type {
  InventoryItem,
  MenuCategory,
  MenuDish,
  MenuIngredient,
  MenuPackage,
  MenuType,
} from "./menu-shared";

export { bookingTotal, type BookingRow };

export async function getMenuData(venueId: number): Promise<{
  ingredients: MenuIngredient[];
  categories: MenuCategory[];
  menuTypes: MenuType[];
  dishes: MenuDish[];
}> {
  const [ings, cats, types, dishRows] = await Promise.all([
    db
      .select()
      .from(ingredients)
      .where(eq(ingredients.venueId, venueId))
      .orderBy(asc(ingredients.name)),
    db
      .select()
      .from(dishCategories)
      .where(eq(dishCategories.venueId, venueId))
      .orderBy(asc(dishCategories.sort), asc(dishCategories.id)),
    db
      .select()
      .from(menuTypes)
      .where(eq(menuTypes.venueId, venueId))
      .orderBy(asc(menuTypes.sort), asc(menuTypes.id)),
    db
      .select()
      .from(dishes)
      .where(eq(dishes.venueId, venueId))
      .orderBy(asc(dishes.name)),
  ]);

  const dishIds = dishRows.map((d) => d.id);
  const [lines, invLines] = dishIds.length
    ? await Promise.all([
        db
          .select()
          .from(dishIngredients)
          .where(inArray(dishIngredients.dishId, dishIds)),
        db
          .select()
          .from(dishInventory)
          .where(inArray(dishInventory.dishId, dishIds)),
      ])
    : [[], []];

  return {
    ingredients: ings.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      pricePerUnit: i.pricePerUnit,
      wastePct: i.wastePct,
    })),
    categories: cats.map((c) => ({ id: c.id, name: c.name })),
    menuTypes: types.map((t) => ({ id: t.id, name: t.name })),
    dishes: dishRows.map((d) => ({
      id: d.id,
      name: d.name,
      categoryId: d.categoryId,
      menuTypeId: d.menuTypeId,
      sellPrice: d.sellPrice,
      lines: lines
        .filter((l) => l.dishId === d.id)
        .map((l) => ({ id: l.id, ingredientId: l.ingredientId, qty: l.qty })),
      invLines: invLines
        .filter((l) => l.dishId === d.id)
        .map((l) => ({ id: l.id, itemId: l.itemId, qtyPerPortion: l.qtyPerPortion })),
    })),
  };
}

export async function getTargetFoodCostPct(venueId: number): Promise<number> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(
      and(
        eq(settings.venueId, venueId),
        eq(settings.key, "targetFoodCostPct"),
      ),
    );
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 32;
}

/** Income (turnover) tax rate %, applied to revenue. 0 = none. */
export async function getIncomeTaxPct(venueId: number): Promise<number> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(
      and(eq(settings.venueId, venueId), eq(settings.key, "incomeTaxPct")),
    );
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function getPackages(venueId: number): Promise<MenuPackage[]> {
  const pkgRows = await db
    .select()
    .from(packages)
    .where(eq(packages.venueId, venueId))
    .orderBy(asc(packages.name));
  if (pkgRows.length === 0) return [];

  const pkgDishes = await db
    .select()
    .from(packageDishes)
    .where(
      inArray(
        packageDishes.packageId,
        pkgRows.map((p) => p.id),
      ),
    );

  return pkgRows.map((p) => ({
    id: p.id,
    name: p.name,
    menuTypeId: p.menuTypeId,
    pricePerGuest: p.pricePerGuest,
    manualCostPerGuest: p.manualCostPerGuest,
    description: p.description,
    active: p.active,
    dishes: pkgDishes
      .filter((pd) => pd.packageId === p.id)
      .map((pd) => ({ id: pd.id, dishId: pd.dishId, qtyPerGuest: pd.qtyPerGuest })),
  }));
}

export type FixedCostRow = {
  id: number;
  name: string;
  monthlyAmount: number;
  active: boolean;
};

export type OperationalExpenseRow = {
  id: number;
  name: string;
  amount: number;
  kind: string;
  category: string | null;
  note: string | null;
  spentOn: string | null;
};

export async function getOperationalExpenses(
  venueId: number,
): Promise<OperationalExpenseRow[]> {
  const rows = await db
    .select()
    .from(operationalExpenses)
    .where(eq(operationalExpenses.venueId, venueId))
    .orderBy(asc(operationalExpenses.kind), desc(operationalExpenses.amount));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    kind: r.kind,
    category: r.category,
    note: r.note,
    spentOn: r.spentOn,
  }));
}

// ---------- partners (profit split) ----------

export type PartnerRow = {
  id: number;
  name: string;
  sharePct: number;
  active: boolean;
  allocated: number; // share of distributable profit
  drawn: number; // Σ draws (advances + withdrawals)
  balance: number; // allocated − drawn
};

export type PartnerDrawRow = {
  id: number;
  partnerId: number;
  partnerName: string;
  drawDate: string;
  amount: number;
  note: string | null;
};

export type PartnersData = {
  partners: PartnerRow[];
  draws: PartnerDrawRow[];
  totals: {
    income: number;
    costs: number; // wages + expenses from ledger
    tax: number;
    operational: number; // one-off operational expenses
    distributable: number;
  };
};

/** Distributable profit = ledger income − ledger costs − income tax − operational one-offs. */
export async function getPartnersData(venueId: number): Promise<PartnersData> {
  const [partnerRows, drawRows, ledgerAgg, opAgg, taxPct] = await Promise.all([
    db
      .select()
      .from(partners)
      .where(eq(partners.venueId, venueId))
      .orderBy(asc(partners.id)),
    db
      .select({
        id: partnerDraws.id,
        partnerId: partnerDraws.partnerId,
        partnerName: partners.name,
        drawDate: partnerDraws.drawDate,
        amount: partnerDraws.amount,
        note: partnerDraws.note,
      })
      .from(partnerDraws)
      .innerJoin(partners, eq(partners.id, partnerDraws.partnerId))
      .where(eq(partnerDraws.venueId, venueId))
      .orderBy(desc(partnerDraws.drawDate), desc(partnerDraws.id)),
    db
      .select({
        income: sql<number>`coalesce(sum(case when ${ledger.type} = 'income' then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
        costs: sql<number>`coalesce(sum(case when ${ledger.type} in ('expense','wage') then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
      })
      .from(ledger)
      .where(eq(ledger.venueId, venueId)),
    db
      .select({
        total: sql<number>`coalesce(sum(${operationalExpenses.amount}), 0)::float`,
      })
      .from(operationalExpenses)
      .where(
        and(
          eq(operationalExpenses.venueId, venueId),
          eq(operationalExpenses.kind, "operational"),
        ),
      ),
    getIncomeTaxPct(venueId),
  ]);

  const income = ledgerAgg[0]?.income ?? 0;
  const costs = ledgerAgg[0]?.costs ?? 0;
  const tax = (income * taxPct) / 100;
  const operational = opAgg[0]?.total ?? 0;
  const distributable = income - costs - tax - operational;

  const drawnByPartner = new Map<number, number>();
  for (const d of drawRows)
    drawnByPartner.set(d.partnerId, (drawnByPartner.get(d.partnerId) ?? 0) + d.amount);

  return {
    partners: partnerRows.map((p) => {
      const allocated = p.active ? (distributable * p.sharePct) / 100 : 0;
      const drawn = drawnByPartner.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        sharePct: p.sharePct,
        active: p.active,
        allocated,
        drawn,
        balance: allocated - drawn,
      };
    }),
    draws: drawRows,
    totals: { income, costs, tax, operational, distributable },
  };
}

/** Lightweight list for showing day/month splits in the register. */
export async function getPartnersLite(
  venueId: number,
): Promise<{ id: number; name: string; sharePct: number }[]> {
  const rows = await db
    .select()
    .from(partners)
    .where(and(eq(partners.venueId, venueId), eq(partners.active, true)))
    .orderBy(asc(partners.id));
  return rows.map((p) => ({ id: p.id, name: p.name, sharePct: p.sharePct }));
}

export async function getFixedCosts(venueId: number): Promise<FixedCostRow[]> {
  const rows = await db
    .select()
    .from(fixedCosts)
    .where(eq(fixedCosts.venueId, venueId))
    .orderBy(desc(fixedCosts.monthlyAmount));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    monthlyAmount: r.monthlyAmount,
    active: r.active,
  }));
}

export async function getInventoryItems(venueId: number): Promise<InventoryItem[]> {
  const rows = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.venueId, venueId))
    .orderBy(asc(inventoryItems.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    minQty: r.minQty,
    perGuest: r.perGuest,
  }));
}

export async function getBookings(venueId: number): Promise<BookingRow[]> {
  const rows = await db
    .select({
      id: bookings.id,
      title: bookings.title,
      eventType: bookings.eventType,
      eventDate: bookings.eventDate,
      guestCount: bookings.guestCount,
      pricePerGuest: bookings.pricePerGuest,
      extraCharges: bookings.extraCharges,
      discount: bookings.discount,
      status: bookings.status,
      notes: bookings.notes,
      clientName: clients.name,
      clientPhone: clients.phone,
      paidTotal: sql<number>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.bookingId} = ${bookings.id}), 0)::float`,
    })
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .where(eq(bookings.venueId, venueId))
    .orderBy(desc(bookings.eventDate));
  return rows;
}

export type BookingPayment = {
  id: number;
  paidOn: string;
  amount: number;
  method: string;
  note: string | null;
};

export type BookingExpense = {
  id: number;
  entryDate: string;
  type: string;
  category: string | null;
  amount: number;
  qty: number;
  note: string | null;
  staffName: string | null;
};

export type BookingDetail = BookingRow & {
  venueId: number;
  startTime: string | null;
  endTime: string | null;
  requirements: string | null;
  clientId: number | null;
  packageId: number | null;
  menuDishes: { id: number; dishId: number; qty: number; perGuest: boolean }[];
  payments: BookingPayment[];
  expenses: BookingExpense[];
  // Actual money from the day register for this event's date.
  actual: { income: number; wages: number; expenses: number };
  incomeTaxPct: number;
};

export async function getBookingDetail(
  venueId: number,
  id: number,
): Promise<BookingDetail | null> {
  const [b] = await db
    .select({
      id: bookings.id,
      venueId: bookings.venueId,
      title: bookings.title,
      eventType: bookings.eventType,
      eventDate: bookings.eventDate,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      guestCount: bookings.guestCount,
      pricePerGuest: bookings.pricePerGuest,
      extraCharges: bookings.extraCharges,
      discount: bookings.discount,
      status: bookings.status,
      notes: bookings.notes,
      requirements: bookings.requirements,
      clientId: bookings.clientId,
      packageId: bookings.packageId,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .where(and(eq(bookings.id, id), eq(bookings.venueId, venueId)));
  if (!b) return null;

  const [pays, exps, menu, dayAgg, incomeTaxPct] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, id))
      .orderBy(desc(payments.paidOn), desc(payments.id)),
    db
      .select({
        id: ledger.id,
        entryDate: ledger.entryDate,
        type: ledger.type,
        category: ledger.category,
        amount: ledger.amount,
        qty: ledger.qty,
        note: ledger.note,
        staffName: staff.name,
      })
      .from(ledger)
      .leftJoin(staff, eq(ledger.staffId, staff.id))
      // payment mirrors are shown in the payments panel, not here
      .where(and(eq(ledger.bookingId, id), isNull(ledger.paymentId)))
      .orderBy(desc(ledger.entryDate), desc(ledger.id)),
    db.select().from(bookingDishes).where(eq(bookingDishes.bookingId, id)),
    db
      .select({
        income: sql<number>`coalesce(sum(case when ${ledger.type} = 'income' then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
        wages: sql<number>`coalesce(sum(case when ${ledger.type} = 'wage' then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
        expenses: sql<number>`coalesce(sum(case when ${ledger.type} = 'expense' then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
      })
      .from(ledger)
      .where(and(eq(ledger.venueId, venueId), eq(ledger.entryDate, b.eventDate))),
    getIncomeTaxPct(venueId),
  ]);

  const paidTotal = pays.reduce((s, p) => s + p.amount, 0);

  return {
    ...b,
    paidTotal,
    payments: pays.map((p) => ({
      id: p.id,
      paidOn: p.paidOn,
      amount: p.amount,
      method: p.method,
      note: p.note,
    })),
    expenses: exps.map((e) => ({
      id: e.id,
      entryDate: e.entryDate,
      type: e.type,
      category: e.category,
      amount: e.amount,
      qty: e.qty,
      note: e.note,
      staffName: e.staffName,
    })),
    menuDishes: menu.map((m) => ({
      id: m.id,
      dishId: m.dishId,
      qty: m.qty,
      perGuest: m.perGuest,
    })),
    actual: {
      income: dayAgg[0]?.income ?? 0,
      wages: dayAgg[0]?.wages ?? 0,
      expenses: dayAgg[0]?.expenses ?? 0,
    },
    incomeTaxPct,
  };
}

// ---------- suppliers / purchases ----------

export type SupplierRow = {
  id: number;
  name: string;
  category: string | null;
  contactPerson: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  totalPurchased: number;
  totalPaid: number;
  debt: number;
  purchaseCount: number;
};

export type PurchaseRow = {
  id: number;
  supplierId: number | null;
  supplierName: string | null;
  purchaseDate: string;
  total: number;
  paid: number;
  status: string;
  note: string | null;
};

export async function getSuppliers(venueId: number): Promise<SupplierRow[]> {
  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      category: suppliers.category,
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
      notes: suppliers.notes,
      active: suppliers.active,
      totalPurchased: sql<number>`coalesce(sum(${purchases.total}), 0)::float`,
      totalPaid: sql<number>`coalesce(sum(${purchases.paid}), 0)::float`,
      purchaseCount: sql<number>`count(${purchases.id})::int`,
    })
    .from(suppliers)
    .leftJoin(purchases, eq(purchases.supplierId, suppliers.id))
    .where(eq(suppliers.venueId, venueId))
    .groupBy(suppliers.id)
    .orderBy(desc(suppliers.active), asc(suppliers.name));

  return rows.map((r) => ({
    ...r,
    debt: r.totalPurchased - r.totalPaid,
  }));
}

export async function getPurchases(venueId: number): Promise<PurchaseRow[]> {
  const rows = await db
    .select({
      id: purchases.id,
      supplierId: purchases.supplierId,
      supplierName: suppliers.name,
      purchaseDate: purchases.purchaseDate,
      total: purchases.total,
      paid: purchases.paid,
      status: purchases.status,
      note: purchases.note,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(eq(purchases.venueId, venueId))
    .orderBy(desc(purchases.purchaseDate), desc(purchases.id));
  return rows;
}

// ---------- daily register ----------

export type LedgerEntry = {
  id: number;
  entryDate: string;
  type: string;
  category: string | null;
  amount: number;
  qty: number;
  note: string | null;
  staffId: number | null;
  staffName: string | null;
  bookingId: number | null;
  bookingTitle: string | null;
};

export type StaffMember = {
  id: number;
  name: string;
  role: string | null;
  phone: string | null;
  dailyRate: number;
  active: boolean;
};

export type DayCloseRow = {
  closeDate: string;
  openingBalance: number;
  income: number;
  wages: number;
  expenses: number;
  net: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  notes: string | null;
};

export type RegisterDay = {
  date: string;
  entries: LedgerEntry[];
  income: number;
  wages: number;
  expenses: number;
  net: number;
  openingBalance: number;
  expectedCash: number;
  close: DayCloseRow | null;
  staff: StaffMember[];
  bookings: { id: number; title: string; eventDate: string }[];
};

export const entryTotal = (e: { amount: number; qty: number }) =>
  e.amount * e.qty;

export async function getStaff(venueId: number): Promise<StaffMember[]> {
  const rows = await db
    .select()
    .from(staff)
    .where(eq(staff.venueId, venueId))
    .orderBy(desc(staff.active), asc(staff.name));
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    phone: s.phone,
    dailyRate: s.dailyRate,
    active: s.active,
  }));
}

async function openingBalanceFor(
  venueId: number,
  date: string,
): Promise<number> {
  const [prior] = await db
    .select()
    .from(dayCloses)
    .where(and(eq(dayCloses.venueId, venueId), lt(dayCloses.closeDate, date)))
    .orderBy(desc(dayCloses.closeDate))
    .limit(1);
  if (!prior) return 0;
  return prior.countedCash ?? prior.expectedCash;
}

export async function getRegisterDay(
  venueId: number,
  date: string,
): Promise<RegisterDay> {
  const [entryRows, staffList, closeRows, bookingRows, opening] =
    await Promise.all([
      db
        .select({
          id: ledger.id,
          entryDate: ledger.entryDate,
          type: ledger.type,
          category: ledger.category,
          amount: ledger.amount,
          qty: ledger.qty,
          note: ledger.note,
          staffId: ledger.staffId,
          staffName: staff.name,
          bookingId: ledger.bookingId,
          bookingTitle: bookings.title,
        })
        .from(ledger)
        .leftJoin(staff, eq(ledger.staffId, staff.id))
        .leftJoin(bookings, eq(ledger.bookingId, bookings.id))
        .where(and(eq(ledger.venueId, venueId), eq(ledger.entryDate, date)))
        .orderBy(desc(ledger.id)),
      getStaff(venueId),
      db
        .select()
        .from(dayCloses)
        .where(
          and(eq(dayCloses.venueId, venueId), eq(dayCloses.closeDate, date)),
        )
        .limit(1),
      db
        .select({
          id: bookings.id,
          title: bookings.title,
          eventDate: bookings.eventDate,
        })
        .from(bookings)
        .where(eq(bookings.venueId, venueId))
        .orderBy(desc(bookings.eventDate))
        .limit(200),
      openingBalanceFor(venueId, date),
    ]);

  let income = 0;
  let wages = 0;
  let expenses = 0;
  for (const e of entryRows) {
    const t = entryTotal(e);
    if (e.type === "income") income += t;
    else if (e.type === "wage") wages += t;
    else expenses += t;
  }
  const net = income - wages - expenses;
  const expectedCash = opening + net;
  const existing = closeRows[0];

  return {
    date,
    entries: entryRows,
    income,
    wages,
    expenses,
    net,
    openingBalance: opening,
    expectedCash,
    staff: staffList,
    bookings: bookingRows,
    close: existing
      ? {
          closeDate: existing.closeDate,
          openingBalance: existing.openingBalance,
          income: existing.income,
          wages: existing.wages,
          expenses: existing.expenses,
          net: existing.net,
          expectedCash: existing.expectedCash,
          countedCash: existing.countedCash,
          difference: existing.difference,
          notes: existing.notes,
        }
      : null,
  };
}

export type MonthSummary = {
  income: number;
  wages: number;
  expenses: number;
  net: number;
  dailyNet: { day: number; net: number }[];
  wagesByStaff: { name: string; total: number }[];
  expensesByCategory: { category: string; total: number }[];
  closedDays: number;
  daysInMonth: number;
};

export async function getMonthSummary(
  venueId: number,
  year: number,
  month: number,
): Promise<MonthSummary> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();
  const start = `${year}-${pad(month)}-01`;
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const [rows, closes] = await Promise.all([
    db
      .select({
        entryDate: ledger.entryDate,
        type: ledger.type,
        category: ledger.category,
        amount: ledger.amount,
        qty: ledger.qty,
        staffName: staff.name,
      })
      .from(ledger)
      .leftJoin(staff, eq(ledger.staffId, staff.id))
      .where(
        and(
          eq(ledger.venueId, venueId),
          gte(ledger.entryDate, start),
          lte(ledger.entryDate, end),
        ),
      ),
    db
      .select({ closeDate: dayCloses.closeDate })
      .from(dayCloses)
      .where(
        and(
          eq(dayCloses.venueId, venueId),
          gte(dayCloses.closeDate, start),
          lte(dayCloses.closeDate, end),
        ),
      ),
  ]);

  let income = 0;
  let wages = 0;
  let expenses = 0;
  const dailyNet = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    net: 0,
  }));
  const wagesByStaff = new Map<string, number>();
  const expensesByCategory = new Map<string, number>();

  for (const r of rows) {
    const t = r.amount * r.qty;
    const day = Number(r.entryDate.slice(8, 10));
    const cell = dailyNet[day - 1];
    if (r.type === "income") {
      income += t;
      if (cell) cell.net += t;
    } else if (r.type === "wage") {
      wages += t;
      if (cell) cell.net -= t;
      const name = r.staffName ?? "სხვა";
      wagesByStaff.set(name, (wagesByStaff.get(name) ?? 0) + t);
    } else {
      expenses += t;
      if (cell) cell.net -= t;
      const cat = r.category ?? "სხვა";
      expensesByCategory.set(cat, (expensesByCategory.get(cat) ?? 0) + t);
    }
  }

  return {
    income,
    wages,
    expenses,
    net: income - wages - expenses,
    dailyNet,
    wagesByStaff: [...wagesByStaff.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total),
    expensesByCategory: [...expensesByCategory.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    closedDays: closes.length,
    daysInMonth,
  };
}

// ---------- analytics ----------

export type AnalyticsData = {
  months: {
    ym: string; // YYYY-MM
    label: string; // "ივლ 26"
    income: number; // ledger income (real money)
    net: number; // ledger income − costs
    events: number; // non-cancelled bookings that month
    bookedDays: number; // distinct dates with an event
    daysInMonth: number;
  }[];
  totals: {
    events: number;
    income: number;
    net: number;
    avgEventValue: number; // income / events
    occupancyPct: number; // bookedDays / daysInMonth over the window
    bestMonth: { label: string; income: number } | null;
  };
  eventTypes: { type: string; count: number }[];
  upcomingEvents: number;
};

/** Last `monthsBack` months (default 12) of event + money trends. */
export async function getAnalytics(
  venueId: number,
  monthsBack = 12,
): Promise<AnalyticsData> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const startY = now.getFullYear();
  const startM = now.getMonth() + 1; // 1-based, current month
  // window start = first day of the earliest month in range
  const first = new Date(startY, startM - monthsBack, 1);
  const startISO = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`;
  const todayStr = todayISO();

  const [ledgerRows, bookingRows] = await Promise.all([
    db
      .select({
        entryDate: ledger.entryDate,
        type: ledger.type,
        amount: ledger.amount,
        qty: ledger.qty,
      })
      .from(ledger)
      .where(and(eq(ledger.venueId, venueId), gte(ledger.entryDate, startISO))),
    db
      .select({
        eventDate: bookings.eventDate,
        eventType: bookings.eventType,
        status: bookings.status,
      })
      .from(bookings)
      .where(and(eq(bookings.venueId, venueId), gte(bookings.eventDate, startISO))),
  ]);

  const KA_MONTHS = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];
  // build the ordered month buckets
  const months: AnalyticsData["months"] = [];
  const idx = new Map<string, number>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(startY, startM - 1 - i, 1);
    const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    idx.set(ym, months.length);
    months.push({
      ym,
      label: `${KA_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      income: 0,
      net: 0,
      events: 0,
      bookedDays: 0,
      daysInMonth: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    });
  }

  for (const r of ledgerRows) {
    const ym = r.entryDate.slice(0, 7);
    const i = idx.get(ym);
    if (i == null) continue;
    const t = r.amount * r.qty;
    if (r.type === "income") {
      months[i].income += t;
      months[i].net += t;
    } else {
      months[i].net -= t;
    }
  }

  const bookedDaySets = months.map(() => new Set<string>());
  const eventTypeMap = new Map<string, number>();
  let upcomingEvents = 0;
  for (const b of bookingRows) {
    if (b.status === "cancelled") continue;
    const ym = b.eventDate.slice(0, 7);
    const i = idx.get(ym);
    if (i == null) continue;
    months[i].events += 1;
    bookedDaySets[i].add(b.eventDate);
    eventTypeMap.set(b.eventType, (eventTypeMap.get(b.eventType) ?? 0) + 1);
    if (b.eventDate >= todayStr) upcomingEvents += 1;
  }
  months.forEach((m, i) => (m.bookedDays = bookedDaySets[i].size));

  const totalEvents = months.reduce((s, m) => s + m.events, 0);
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalNet = months.reduce((s, m) => s + m.net, 0);
  const totalBooked = months.reduce((s, m) => s + m.bookedDays, 0);
  const totalDays = months.reduce((s, m) => s + m.daysInMonth, 0);
  const best = months.reduce<AnalyticsData["totals"]["bestMonth"]>((acc, m) => {
    if (m.income > 0 && (!acc || m.income > acc.income))
      return { label: m.label, income: m.income };
    return acc;
  }, null);

  return {
    months,
    totals: {
      events: totalEvents,
      income: totalIncome,
      net: totalNet,
      avgEventValue: totalEvents > 0 ? totalIncome / totalEvents : 0,
      occupancyPct: totalDays > 0 ? (totalBooked / totalDays) * 100 : 0,
      bestMonth: best,
    },
    eventTypes: [...eventTypeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    upcomingEvents,
  };
}

// ---------- forecast / business model ----------

export type ForecastData = {
  params: ModelParams;
  monthlyFixed: number;
  hasSavedParams: boolean;
  suggestions: {
    avgGuests: number | null;
    avgPrice: number | null;
    bookingsCount: number;
    avgFoodCostPerGuest: number | null;
  };
};

export async function getForecastData(venueId: number): Promise<ForecastData> {
  const [settingRows, fixedRows, bookingAgg, dishCosts] = await Promise.all([
    db.select().from(settings).where(eq(settings.venueId, venueId)),
    db
      .select({
        total: sql<number>`coalesce(sum(${fixedCosts.monthlyAmount}), 0)::float`,
      })
      .from(fixedCosts)
      .where(and(eq(fixedCosts.venueId, venueId), eq(fixedCosts.active, true))),
    db
      .select({
        avgGuests: sql<number>`avg(${bookings.guestCount})::float`,
        avgPrice: sql<number>`avg(nullif(${bookings.pricePerGuest}, 0))::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.venueId, venueId),
          sql`${bookings.status} <> 'cancelled'`,
        ),
      ),
    // per-dish recipe cost, averaged in JS as a rough food-cost proxy
    db
      .select({
        cost: sql<number>`coalesce(sum(${dishIngredients.qty} / 1000.0 * ${ingredients.pricePerUnit} * (1 + ${ingredients.wastePct} / 100.0)), 0)::float`,
      })
      .from(dishIngredients)
      .innerJoin(dishes, eq(dishes.id, dishIngredients.dishId))
      .innerJoin(ingredients, eq(ingredients.id, dishIngredients.ingredientId))
      .where(eq(dishes.venueId, venueId))
      .groupBy(dishIngredients.dishId),
  ]);

  const map = new Map(settingRows.map((s) => [s.key, s.value]));
  const hasSavedParams = PARAM_KEYS.some((k) => map.has(k));

  const avgDishCost = dishCosts.length
    ? dishCosts.reduce((s, d) => s + d.cost, 0) / dishCosts.length
    : null;

  const agg = bookingAgg[0];
  const suggestions = {
    avgGuests: agg?.avgGuests ? Math.round(agg.avgGuests) : null,
    avgPrice: agg?.avgPrice ? Math.round(agg.avgPrice) : null,
    bookingsCount: agg?.count ?? 0,
    avgFoodCostPerGuest: avgDishCost != null ? Math.round(avgDishCost) : null,
  };

  const num = (k: keyof ModelParams, def: number) =>
    map.has(k) ? Number(map.get(k)) : def;

  const params: ModelParams = {
    eventsPerMonth: num("eventsPerMonth", 4),
    avgGuests: num("avgGuests", suggestions.avgGuests ?? 150),
    pricePerGuest: num("pricePerGuest", suggestions.avgPrice ?? 80),
    foodCostPerGuest: num("foodCostPerGuest", suggestions.avgFoodCostPerGuest ?? 25),
    serviceCostPerEvent: num("serviceCostPerEvent", 0),
  };

  return {
    params,
    monthlyFixed: fixedRows[0]?.total ?? 0,
    hasSavedParams,
    suggestions,
  };
}

export async function getDashboardStats(venueId: number) {
  const today = todayISO();
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthStart = `${y}-${pad(m)}-01`;
  const monthEnd = `${y}-${pad(m)}-${pad(daysInMonth)}`;

  const [all, monthLedgerRows, closes, lowStockRows, forecast, supplierDebtRow] =
    await Promise.all([
      getBookings(venueId),
      db
        .select({
          entryDate: ledger.entryDate,
          type: ledger.type,
          amount: ledger.amount,
          qty: ledger.qty,
        })
        .from(ledger)
        .where(
          and(
            eq(ledger.venueId, venueId),
            gte(ledger.entryDate, monthStart),
            lte(ledger.entryDate, monthEnd),
          ),
        ),
      db
        .select({ closeDate: dayCloses.closeDate })
        .from(dayCloses)
        .where(
          and(
            eq(dayCloses.venueId, venueId),
            gte(dayCloses.closeDate, monthStart),
            lte(dayCloses.closeDate, monthEnd),
          ),
        ),
      db
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.venueId, venueId),
            sql`${inventoryItems.minQty} is not null and ${inventoryItems.quantity} < ${inventoryItems.minQty}`,
          ),
        ),
      getForecastData(venueId),
      db
        .select({
          debt: sql<number>`coalesce(sum(greatest(${purchases.total} - ${purchases.paid}, 0)), 0)::float`,
        })
        .from(purchases)
        .where(eq(purchases.venueId, venueId)),
    ]);

  const active = all.filter((b) => b.status !== "cancelled");
  const upcoming = active
    .filter((b) => b.eventDate >= today && b.status !== "completed")
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const todayEvents = active.filter((b) => b.eventDate === today);
  const monthEventsCount = active.filter(
    (b) => b.eventDate >= monthStart && b.eventDate <= monthEnd,
  ).length;

  const pipeline = upcoming.reduce((s, b) => s + bookingTotal(b), 0);
  const withBalance = active.filter(
    (b) => bookingTotal(b) - b.paidTotal > 0.01,
  );
  const outstanding = withBalance.reduce(
    (s, b) => s + (bookingTotal(b) - b.paidTotal),
    0,
  );

  // month cash flow + daily net
  const dailyNet = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    net: 0,
  }));
  let monthIncome = 0;
  let monthSpent = 0;
  let todayNet = 0;
  const activeDates = new Set<string>();
  for (const r of monthLedgerRows) {
    const t = r.amount * r.qty;
    const dayNum = Number(r.entryDate.slice(8, 10));
    const cell = dailyNet[dayNum - 1];
    const signed = r.type === "income" ? t : -t;
    if (r.type === "income") monthIncome += t;
    else monthSpent += t;
    if (cell) cell.net += signed;
    if (r.entryDate === today) todayNet += signed;
    activeDates.add(r.entryDate);
  }

  const closedSet = new Set(closes.map((c) => c.closeDate));
  const unclosedDaysCount = [...activeDates].filter(
    (d) => d < today && !closedSet.has(d),
  ).length;

  const contribution = contributionPerEvent(forecast.params);
  const breakEven = breakEvenEvents(forecast.params, forecast.monthlyFixed);

  return {
    upcoming: upcoming.slice(0, 6),
    upcomingCount: upcoming.length,
    totalBookings: active.length,
    todayEvents,
    monthEventsCount,
    pipeline,
    outstanding,
    outstandingCount: withBalance.length,
    monthIncome,
    monthSpent,
    monthNet: monthIncome - monthSpent,
    todayNet,
    dailyNet,
    today,
    lowStockCount: lowStockRows.length,
    unclosedDaysCount,
    supplierDebt: supplierDebtRow[0]?.debt ?? 0,
    breakEven,
    contribution,
    monthlyFixed: forecast.monthlyFixed,
    hasModel: forecast.hasSavedParams,
  };
}
