"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { VENUE_COOKIE, getActiveVenueId } from "./venue";
import {
  bookings,
  clients,
  dishCategories,
  dishes,
  dishIngredients,
  ingredients,
  payments,
  venues,
} from "@/db/schema";

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

// ---------- menu / calculations ----------

export async function createIngredient(input: {
  name: string;
  unit: string;
  pricePerUnit: number;
  wastePct?: number;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(ingredients).values({
    venueId,
    name: input.name.trim(),
    unit: input.unit as typeof ingredients.$inferInsert.unit,
    pricePerUnit: input.pricePerUnit || 0,
    wastePct: input.wastePct || 0,
  });
  revalidatePath("/calc");
}

export async function updateIngredient(
  id: number,
  input: { name?: string; pricePerUnit?: number; wastePct?: number },
) {
  await db
    .update(ingredients)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.pricePerUnit !== undefined
        ? { pricePerUnit: input.pricePerUnit }
        : {}),
      ...(input.wastePct !== undefined ? { wastePct: input.wastePct } : {}),
    })
    .where(eq(ingredients.id, id));
  revalidatePath("/calc");
}

export async function deleteIngredient(id: number) {
  await db.delete(ingredients).where(eq(ingredients.id, id));
  revalidatePath("/calc");
}

export async function createDishCategory(name: string) {
  const venueId = await getActiveVenueId();
  if (!venueId || !name.trim()) return;
  await db.insert(dishCategories).values({ venueId, name: name.trim() });
  revalidatePath("/calc");
}

export async function deleteDishCategory(id: number) {
  await db.delete(dishCategories).where(eq(dishCategories.id, id));
  revalidatePath("/calc");
}

export async function createDish(input: {
  name: string;
  categoryId: number | null;
  sellPrice: number;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(dishes).values({
    venueId,
    name: input.name.trim(),
    categoryId: input.categoryId,
    sellPrice: input.sellPrice || 0,
  });
  revalidatePath("/calc");
}

export async function updateDish(
  id: number,
  input: { name?: string; sellPrice?: number; categoryId?: number | null },
) {
  await db
    .update(dishes)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.sellPrice !== undefined ? { sellPrice: input.sellPrice } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    })
    .where(eq(dishes.id, id));
  revalidatePath("/calc");
}

export async function deleteDish(id: number) {
  await db.delete(dishes).where(eq(dishes.id, id));
  revalidatePath("/calc");
}

export async function addRecipeLine(
  dishId: number,
  ingredientId: number,
  qty: number,
) {
  if (!qty || qty <= 0) return;
  await db.insert(dishIngredients).values({ dishId, ingredientId, qty });
  revalidatePath("/calc");
}

export async function updateRecipeLine(lineId: number, qty: number) {
  if (!qty || qty <= 0) return;
  await db.update(dishIngredients).set({ qty }).where(eq(dishIngredients.id, lineId));
  revalidatePath("/calc");
}

export async function deleteRecipeLine(lineId: number) {
  await db.delete(dishIngredients).where(eq(dishIngredients.id, lineId));
  revalidatePath("/calc");
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
