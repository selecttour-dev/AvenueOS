import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings, telegramRecipients, venues } from "@/db/schema";
import { sendTelegram, upcomingEventsMessage } from "@/lib/reminders";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

const HELP = [
  "🤖 <b>AvenueOS ბოტი</b>",
  "",
  "/bookings (ან /ჯავშნები) — მომავალი ჯავშნების სრული სია",
  "/today (ან /დღეს) — დღევანდელი ივენთები",
  "/help — დახმარება",
  "",
  "ივენთამდე 2 და 1 დღით ადრე ავტომატურ შეხსენებას მიიღებ.",
].join("\n");

/** Which venue this bot serves (the one whose token matches / the first one). */
async function resolveVenue(): Promise<{ id: number; name: string; token: string } | null> {
  const rows = await db
    .select({ venueId: settings.venueId, value: settings.value })
    .from(settings)
    .where(eq(settings.key, "telegramBotToken"));
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  const pick = rows[0];
  const token = envToken || pick?.value;
  if (!token) return null;
  const venueId = pick?.venueId ?? (await db.select({ id: venues.id }).from(venues).limit(1))[0]?.id;
  if (!venueId) return null;
  const [v] = await db.select({ name: venues.name }).from(venues).where(eq(venues.id, venueId));
  return { id: venueId, name: v?.name ?? "AvenueOS", token };
}

async function expectedSecret(): Promise<string | null> {
  if (process.env.TELEGRAM_WEBHOOK_SECRET) return process.env.TELEGRAM_WEBHOOK_SECRET;
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "telegramWebhookSecret"));
  return row?.value ?? null;
}

export async function POST(req: Request) {
  // Telegram echoes the secret we set via setWebhook — reject anything else.
  const secret = await expectedSecret();
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message ?? update?.edited_message;
  const chat = msg?.chat;
  const text: string = (msg?.text ?? "").trim();
  if (!chat?.id || !text) return NextResponse.json({ ok: true });

  const venue = await resolveVenue();
  if (!venue) return NextResponse.json({ ok: true });
  const chatId = String(chat.id);
  const cmd = text.split(/\s+/)[0].replace(/@\w+$/, "").toLowerCase();

  // /start — self-register this chat as a reminder recipient
  if (cmd === "/start") {
    const existing = await db
      .select({ id: telegramRecipients.id })
      .from(telegramRecipients)
      .where(and(eq(telegramRecipients.venueId, venue.id), eq(telegramRecipients.chatId, chatId)));
    if (existing.length === 0) {
      const name =
        chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ") ?? chat.username ?? null;
      await db.insert(telegramRecipients).values({ venueId: venue.id, chatId, name });
      await sendTelegram(
        venue.token,
        chatId,
        `✅ <b>${venue.name}</b> — შეხსენებები ჩართულია.\n\n${HELP}`,
      );
    } else {
      await sendTelegram(venue.token, chatId, `უკვე ჩართული ხარ ✅\n\n${HELP}`);
    }
    return NextResponse.json({ ok: true });
  }

  if (cmd === "/ჯავშნები" || cmd === "/bookings") {
    const body = await upcomingEventsMessage(venue.id, venue.name, todayISO(), 12);
    await sendTelegram(venue.token, chatId, body);
    return NextResponse.json({ ok: true });
  }

  if (cmd === "/დღეს" || cmd === "/today") {
    const today = todayISO();
    const body = await upcomingEventsMessage(venue.id, venue.name, today, 12, today);
    await sendTelegram(venue.token, chatId, body);
    return NextResponse.json({ ok: true });
  }

  if (cmd === "/help") {
    await sendTelegram(venue.token, chatId, HELP);
    return NextResponse.json({ ok: true });
  }

  await sendTelegram(venue.token, chatId, HELP);
  return NextResponse.json({ ok: true });
}
