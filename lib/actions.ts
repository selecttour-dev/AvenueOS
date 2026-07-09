"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { VENUE_COOKIE, getActiveVenueId } from "./venue";
import { bookings, clients, payments, venues } from "@/db/schema";

// ---------- venues ----------

export async function setActiveVenue(venueId: number) {
  const store = await cookies();
  store.set(VENUE_COOKIE, String(venueId), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function createVenue(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.insert(venues).values({ name: trimmed });
  revalidatePath("/select");
}

export async function renameVenue(venueId: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(venues).set({ name: trimmed }).where(eq(venues.id, venueId));
  revalidatePath("/select");
  revalidatePath("/", "layout");
}

// ---------- bookings ----------

export type BookingInput = {
  title: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  pricePerGuest: number;
  clientName?: string;
  clientPhone?: string;
  notes?: string;
};

export async function createBooking(input: BookingInput) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  if (!input.title.trim() || !input.eventDate) {
    return { error: "სახელი და თარიღი სავალდებულოა" };
  }

  let clientId: number | null = null;
  if (input.clientName?.trim()) {
    const [client] = await db
      .insert(clients)
      .values({
        venueId,
        name: input.clientName.trim(),
        phone: input.clientPhone?.trim() || null,
      })
      .returning({ id: clients.id });
    clientId = client.id;
  }

  await db.insert(bookings).values({
    venueId,
    clientId,
    title: input.title.trim(),
    eventType: (input.eventType || "other") as typeof bookings.$inferInsert.eventType,
    eventDate: input.eventDate,
    guestCount: input.guestCount || 0,
    pricePerGuest: input.pricePerGuest || 0,
    notes: input.notes?.trim() || null,
  });

  revalidatePath("/bookings");
  revalidatePath("/");
  return { ok: true };
}

export async function updateBookingStatus(bookingId: number, status: string) {
  await db
    .update(bookings)
    .set({ status: status as typeof bookings.$inferInsert.status })
    .where(eq(bookings.id, bookingId));
  revalidatePath("/bookings");
  revalidatePath("/");
}

export async function deleteBooking(bookingId: number) {
  await db.delete(bookings).where(eq(bookings.id, bookingId));
  revalidatePath("/bookings");
  revalidatePath("/");
}

export async function addPayment(
  bookingId: number,
  amount: number,
  paidOn: string,
  method: string,
) {
  if (!amount || amount <= 0) return { error: "თანხა აუცილებელია" };
  await db.insert(payments).values({
    bookingId,
    amount,
    paidOn,
    method: method as typeof payments.$inferInsert.method,
  });
  revalidatePath("/bookings");
  revalidatePath("/");
  return { ok: true };
}
