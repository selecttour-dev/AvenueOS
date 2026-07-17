// Money-entry commands for the Telegram bot: log an expense/income into the
// day register, or a payment against a booking — straight from the phone.

import { and, asc, eq, ilike, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { bookings, clients, ledger, payments } from "@/db/schema";
import { EXPENSE_CATEGORIES } from "./booking-shared";

function gelKa(n: number): string {
  const r = Math.round(n * 100) / 100;
  const [i, d] = String(r).split(".");
  return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${d ? "." + d : ""} ₾`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Reuse a known expense category when the text matches one, else free text. */
function pickCategory(text: string): string {
  const t = text.trim().toLowerCase();
  const hit = EXPENSE_CATEGORIES.find(
    (c) => c.toLowerCase() === t || t.includes(c.toLowerCase()) || c.toLowerCase().includes(t),
  );
  return hit ?? text.trim();
}

/** `/ხარჯი 450 ბაზარი` → expense on today's register. */
export async function botAddExpense(
  venueId: number,
  amount: number,
  description: string,
  todayStr: string,
): Promise<string> {
  if (!(amount > 0)) return "❌ თანხა არასწორია. მაგ: <code>/ხარჯი 450 ბაზარი</code>";
  const category = description.trim() ? pickCategory(description) : "სხვა";
  await db.insert(ledger).values({
    venueId,
    entryDate: todayStr,
    type: "expense",
    category,
    amount,
    qty: 1,
    note: "Telegram",
  });
  const [sum] = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${ledger.type} in ('expense','wage') then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
    })
    .from(ledger)
    .where(and(eq(ledger.venueId, venueId), eq(ledger.entryDate, todayStr)));
  return [
    `✅ ხარჯი ჩაიწერა`,
    `💸 ${gelKa(amount)} · ${esc(category)}`,
    `📅 დღეს`,
    ``,
    `დღის ხარჯი სულ: <b>${gelKa(sum?.total ?? 0)}</b>`,
  ].join("\n");
}

/** `/შემოსავალი 300 ფოტოსესია` → income on today's register (not booking-linked). */
export async function botAddIncome(
  venueId: number,
  amount: number,
  description: string,
  todayStr: string,
): Promise<string> {
  if (!(amount > 0)) return "❌ თანხა არასწორია. მაგ: <code>/შემოსავალი 300 ფოტოსესია</code>";
  await db.insert(ledger).values({
    venueId,
    entryDate: todayStr,
    type: "income",
    category: description.trim() || "სხვა",
    amount,
    qty: 1,
    note: "Telegram",
  });
  const [sum] = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${ledger.type} = 'income' then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
    })
    .from(ledger)
    .where(and(eq(ledger.venueId, venueId), eq(ledger.entryDate, todayStr)));
  return [
    `✅ შემოსავალი ჩაიწერა`,
    `💰 ${gelKa(amount)} · ${esc(description.trim() || "სხვა")}`,
    `📅 დღეს`,
    ``,
    `დღის შემოსავალი სულ: <b>${gelKa(sum?.total ?? 0)}</b>`,
  ].join("\n");
}

/** `/გადახდა ნათია 2000` → payment on the matching booking (register row lands
 *  on that event's date, same rule as the app). */
export async function botAddPayment(
  venueId: number,
  query: string,
  amount: number,
  todayStr: string,
): Promise<string> {
  if (!(amount > 0)) return "❌ თანხა არასწორია. მაგ: <code>/გადახდა ნათია 2000</code>";
  if (!query.trim()) return "❌ მიუთითე ჯავშნის სახელი. მაგ: <code>/გადახდა ნათია 2000</code>";

  const matches = await db
    .select({
      id: bookings.id,
      title: bookings.title,
      eventDate: bookings.eventDate,
      guestCount: bookings.guestCount,
      pricePerGuest: bookings.pricePerGuest,
      extraCharges: bookings.extraCharges,
      discount: bookings.discount,
      paidTotal: sql<number>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.bookingId} = ${bookings.id}), 0)::float`,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.venueId, venueId),
        ne(bookings.status, "cancelled"),
        ilike(bookings.title, `%${query.trim()}%`),
      ),
    )
    .orderBy(asc(sql`abs(${bookings.eventDate} - ${todayStr}::date)`))
    .limit(6);

  if (matches.length === 0) return `❌ „${esc(query.trim())}“ — ასეთი ჯავშანი ვერ ვიპოვე.`;
  if (matches.length > 1) {
    const list = matches
      .map((m) => `• <b>${esc(m.title)}</b> — ${m.eventDate}`)
      .join("\n");
    return [
      `🤔 რამდენიმე ჯავშანი მოიძებნა — დააზუსტე სახელი:`,
      ``,
      list,
    ].join("\n");
  }

  const b = matches[0];
  const [pay] = await db
    .insert(payments)
    .values({ bookingId: b.id, amount, paidOn: todayStr, method: "cash" })
    .returning({ id: payments.id });

  // mirror on the EVENT's date (an advance belongs to its event)
  await db.insert(ledger).values({
    venueId,
    entryDate: b.eventDate,
    type: "income",
    category: "ჯავშნის გადახდა",
    bookingId: b.id,
    paymentId: pay.id,
    amount,
    qty: 1,
    note: "Telegram",
  });

  const total = b.guestCount * b.pricePerGuest + b.extraCharges - b.discount;
  const paid = b.paidTotal + amount;
  const left = total - paid;
  const lines = [
    `✅ გადახდა ჩაიწერა`,
    `🎉 <b>${esc(b.title)}</b> (${b.eventDate})`,
    `💰 +${gelKa(amount)}`,
    ``,
    `გადახდილი სულ: <b>${gelKa(paid)}</b>`,
  ];
  if (total > 0) {
    lines.push(left > 0 ? `დარჩა: <b>${gelKa(left)}</b>` : `✅ სრულად გადახდილია`);
  } else {
    lines.push(`(ჯამური ფასი ჯერ არ არის ჩაწერილი)`);
  }
  return lines.join("\n");
}

/** Parse "450 ბაზარი" → { amount: 450, rest: "ბაზარი" } */
export function parseAmountFirst(args: string): { amount: number; rest: string } {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const amount = Number((parts[0] ?? "").replace(",", "."));
  return { amount: Number.isFinite(amount) ? amount : 0, rest: parts.slice(1).join(" ") };
}

/** Parse "ნათია უგრეხელიძე 2000" → { name: "ნათია უგრეხელიძე", amount: 2000 } */
export function parseAmountLast(args: string): { name: string; amount: number } {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const last = Number((parts[parts.length - 1] ?? "").replace(",", "."));
  if (!Number.isFinite(last)) return { name: parts.join(" "), amount: 0 };
  return { name: parts.slice(0, -1).join(" "), amount: last };
}
