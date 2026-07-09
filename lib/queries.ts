import { and, asc, desc, eq, gte, lte, sql, sum } from "drizzle-orm";
import { db } from "./db";
import { bookings, clients, ledger, payments } from "@/db/schema";
import { todayISO } from "./format";

export type BookingRow = {
  id: number;
  title: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  pricePerGuest: number;
  extraCharges: number;
  discount: number;
  status: string;
  notes: string | null;
  clientName: string | null;
  clientPhone: string | null;
  paidTotal: number;
};

export function bookingTotal(b: {
  guestCount: number;
  pricePerGuest: number;
  extraCharges: number;
  discount: number;
}): number {
  return b.guestCount * b.pricePerGuest + b.extraCharges - b.discount;
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

export async function getDashboardStats(venueId: number) {
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const all = await getBookings(venueId);
  const active = all.filter((b) => b.status !== "cancelled");
  const upcoming = active
    .filter((b) => b.eventDate >= today && b.status !== "completed")
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const pipeline = upcoming.reduce((s, b) => s + bookingTotal(b), 0);
  const outstanding = active.reduce(
    (s, b) => s + Math.max(bookingTotal(b) - b.paidTotal, 0),
    0,
  );

  const [monthLedger] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${ledger.type} = 'income' then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
      spent: sql<number>`coalesce(sum(case when ${ledger.type} in ('expense','wage') then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
    })
    .from(ledger)
    .where(
      and(
        eq(ledger.venueId, venueId),
        gte(ledger.entryDate, monthStart),
        lte(ledger.entryDate, today),
      ),
    );

  return {
    upcoming: upcoming.slice(0, 6),
    upcomingCount: upcoming.length,
    pipeline,
    outstanding,
    monthIncome: monthLedger?.income ?? 0,
    monthSpent: monthLedger?.spent ?? 0,
    totalBookings: active.length,
  };
}
