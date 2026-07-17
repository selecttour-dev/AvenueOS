import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings, telegramRecipients, venues } from "@/db/schema";
import { sendTelegram, upcomingEventsMessage } from "@/lib/reminders";
import {
  botAddExpense,
  botAddIncome,
  botAddPayment,
  botClientHistory,
  botCloseDay,
  parseAmountFirst,
  parseAmountLast,
} from "@/lib/bot-commands";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

const HELP = [
  "🤖 <b>AvenueOS ბოტი</b>",
  "",
  "<b>ნახვა</b>",
  "/bookings (ან /ჯავშნები) — მომავალი ჯავშნების სია",
  "/today (ან /დღეს) — დღევანდელი ივენთები",
  "/კლიენტი ნათია — კლიენტის ისტორია (სახელით/ტელეფონით)",
  "",
  "<b>ფულის ჩაწერა</b>",
  "/ხარჯი 450 ბაზარი — ხარჯი დღის რეესტრში",
  "/შემოსავალი 300 ფოტოსესია — შემოსავალი დღის რეესტრში",
  "/გადახდა ნათია 2000 — გადახდა ჯავშანზე",
  "/დახურვა 500 — დღის დახურვა დათვლილი ნაღდით",
  "",
  "ყოველ დილას მოგივა დაიჯესტი, ივენთამდე 2 და 1 დღით ადრე — შეხსენება.",
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

  // /start — self-register this chat as a reminder recipient.
  // When a join code is set, registration requires it: /start 4821
  if (cmd === "/start") {
    const existing = await db
      .select({ id: telegramRecipients.id })
      .from(telegramRecipients)
      .where(and(eq(telegramRecipients.venueId, venue.id), eq(telegramRecipients.chatId, chatId)));
    if (existing.length > 0) {
      await sendTelegram(venue.token, chatId, `უკვე ჩართული ხარ ✅\n\n${HELP}`);
      return NextResponse.json({ ok: true });
    }

    const [codeRow] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.venueId, venue.id), eq(settings.key, "telegramJoinCode")));
    const joinCode = codeRow?.value ?? "";
    const supplied = text.split(/\s+/)[1] ?? "";
    if (joinCode && supplied !== joinCode) {
      await sendTelegram(
        venue.token,
        chatId,
        "🔐 დასამატებლად საჭიროა კოდი: <code>/start XXXX</code>\nკოდი იკითხე ადმინისტრატორთან.",
      );
      return NextResponse.json({ ok: true });
    }

    const name =
      chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ") ?? chat.username ?? null;
    await db.insert(telegramRecipients).values({ venueId: venue.id, chatId, name });
    await sendTelegram(
      venue.token,
      chatId,
      `✅ <b>${venue.name}</b> — შეხსენებები ჩართულია.\n\n${HELP}`,
    );
    return NextResponse.json({ ok: true });
  }

  // Everything below writes or reveals business data — only registered staff.
  const known = await db
    .select({ id: telegramRecipients.id })
    .from(telegramRecipients)
    .where(and(eq(telegramRecipients.venueId, venue.id), eq(telegramRecipients.chatId, chatId)));
  if (known.length === 0) {
    await sendTelegram(venue.token, chatId, "დასაწყებად მისწერე /start");
    return NextResponse.json({ ok: true });
  }

  const args = text.slice(cmd.length).trim();
  const today = todayISO();

  if (cmd === "/ხარჯი" || cmd === "/expense") {
    const { amount, rest } = parseAmountFirst(args);
    await sendTelegram(venue.token, chatId, await botAddExpense(venue.id, amount, rest, today));
    return NextResponse.json({ ok: true });
  }

  if (cmd === "/შემოსავალი" || cmd === "/income") {
    const { amount, rest } = parseAmountFirst(args);
    await sendTelegram(venue.token, chatId, await botAddIncome(venue.id, amount, rest, today));
    return NextResponse.json({ ok: true });
  }

  if (cmd === "/გადახდა" || cmd === "/payment") {
    const { name, amount } = parseAmountLast(args);
    await sendTelegram(venue.token, chatId, await botAddPayment(venue.id, name, amount, today));
    return NextResponse.json({ ok: true });
  }

  if (cmd === "/დახურვა" || cmd === "/close") {
    const counted = args ? Number(args.replace(",", ".")) : NaN;
    await sendTelegram(
      venue.token,
      chatId,
      await botCloseDay(venue.id, Number.isFinite(counted) ? counted : null, today),
    );
    return NextResponse.json({ ok: true });
  }

  if (cmd === "/კლიენტი" || cmd === "/client") {
    await sendTelegram(venue.token, chatId, await botClientHistory(venue.id, args));
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
