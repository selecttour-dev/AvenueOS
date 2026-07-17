"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Send,
  Sheet as SheetIcon,
} from "lucide-react";
import {
  connectTelegram,
  disconnectTelegram,
  duplicateVenueData,
  runSheetSync,
  saveSheetId,
  sendTestReminder,
  updateVenue,
} from "@/lib/actions";
import { PageHeader, Section } from "@/components/ui";

type Venue = {
  id: number;
  name: string;
  address: string | null;
  capacity: number | null;
};

type TelegramStatus = { connected: boolean; hasToken: boolean; chatId: string };

export default function SettingsClient({
  venue,
  otherVenues,
  sheetId,
  telegram,
}: {
  venue: Venue;
  otherVenues: { id: number; name: string }[];
  sheetId: string;
  telegram: TelegramStatus;
}) {
  return (
    <>
      <PageHeader
        title="პარამეტრები"
        subtitle={`ობიექტი: ${venue.name}`}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <TelegramSection status={telegram} />
        <SheetSyncSection initialSheetId={sheetId} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <VenueInfoSection venue={venue} />
        <DuplicateSection venue={venue} otherVenues={otherVenues} />
      </div>
    </>
  );
}

function TelegramSection({ status }: { status: TelegramStatus }) {
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const connect = () =>
    startTransition(async () => {
      setMsg(null);
      const res = await connectTelegram(token);
      if (res?.ok) setMsg({ ok: true, text: "დაკავშირდა ✓ — სატესტო შეტყობინება გაიგზავნა Telegram-ში." });
      else setMsg({ ok: false, text: res?.error ?? "ვერ დაუკავშირდა" });
    });

  return (
    <Section
      title="Telegram შეხსენებები"
      action={<Send size={18} style={{ color: "var(--text-3)" }} />}
    >
      {status.connected ? (
        <>
          <div
            className="mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: "var(--green-soft)", color: "var(--green)" }}
          >
            <Check size={16} /> დაკავშირებულია · chat {status.chatId}
          </div>
          <p className="mb-3 text-sm" style={{ color: "var(--text-2)" }}>
            ივენთამდე <b>2 და 1 დღით ადრე</b> მიიღებ შეხსენებას დამკვეთის სურვილებით.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await sendTestReminder();
                  setMsg(r?.ok ? { ok: true, text: "სატესტო შეტყობინება გაიგზავნა ✓" } : { ok: false, text: r?.error ?? "ვერ გაიგზავნა" });
                })
              }
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              სატესტო შეტყობინება
            </button>
            <button
              className="btn btn-danger"
              disabled={pending}
              onClick={() => {
                if (confirm("გავთიშო Telegram?")) startTransition(() => disconnectTelegram());
              }}
            >
              გათიშვა
            </button>
          </div>
        </>
      ) : (
        <>
          <ol className="mb-3 ml-4 list-decimal text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            <li>Telegram-ში მოძებნე <b>@BotFather</b> → <code>/newbot</code> → მიიღებ <b>token</b>-ს.</li>
            <li>მოძებნე შენი ახალი ბოტი და მისწერე <code>/start</code>.</li>
            <li>ჩასვი token აქ და დააჭირე „დაკავშირებას“.</li>
          </ol>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <label className="label">ბოტის Token</label>
              <input
                className="input"
                placeholder="123456789:AA..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" disabled={pending || !token.trim()} onClick={connect}>
              {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              დაკავშირება
            </button>
          </div>
        </>
      )}

      {msg && (
        <div
          className="mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={
            msg.ok
              ? { background: "var(--green-soft)", color: "var(--green)" }
              : { background: "var(--red-soft)", color: "var(--red)" }
          }
        >
          {msg.text}
        </div>
      )}
    </Section>
  );
}

type SyncResult = {
  ok: boolean;
  error?: string;
  added: number;
  updated: number;
  skipped: number;
  tabsRead: string[];
  rows: number;
};

function SheetSyncSection({ initialSheetId }: { initialSheetId: string }) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialSheetId);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const sync = () =>
    startTransition(async () => {
      setResult(null);
      await saveSheetId(value);
      const res = await runSheetSync(value);
      setResult(res);
      setSaved(true);
    });

  return (
    <Section
      title="Google Sheets სინქრონი"
      action={<SheetIcon size={18} style={{ color: "var(--text-3)" }} />}
    >
      <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        ჩასვი შენი Google Sheet-ის ბმული. აპი ავტომატურად წაიკითხავs თვის ტაბებს
        (მაისი, ივნისი…) და დაამატებს/განაახლებს ჯავშნებს. არსებულ ჯავშანს არ
        შლის და აპში ჩაწერილ ფასს არ გადააწერს.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <label className="label">Google Sheet-ის ბმული</label>
          <input
            className="input"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <button
          className="btn btn-primary"
          disabled={pending || !value.trim()}
          onClick={sync}
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          ახლავე დასინქრონება
        </button>
      </div>

      {result && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={
            result.ok
              ? { background: "var(--green-soft)", color: "var(--text)" }
              : { background: "var(--red-soft)", color: "var(--red)" }
          }
        >
          {result.ok ? (
            <>
              <div className="font-bold" style={{ color: "var(--green)" }}>
                ✓ სინქრონი დასრულდა
              </div>
              <div className="mt-1" style={{ color: "var(--text-2)" }}>
                დაემატა <b>{result.added}</b> · განახლდა <b>{result.updated}</b> ·
                გამოტოვდა <b>{result.skipped}</b>
                {result.tabsRead.length > 0 && (
                  <> · ტაბები: {result.tabsRead.join(", ")}</>
                )}
              </div>
            </>
          ) : (
            <div className="font-semibold">{result.error}</div>
          )}
        </div>
      )}

      <div
        className="mt-4 rounded-xl px-4 py-3 text-xs leading-relaxed"
        style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
      >
        💡 ცხრილი უნდა იყოს გაზიარებული <b>„ნებისმიერს ბმულით — ნახვა“</b>.
        დღიური რეესტრები და ხარჯების ტაბები არ ისინქრონდება — ისინი აპში იწარმოება.
        {saved && <> ბმული შენახულია.</>}
      </div>
    </Section>
  );
}

function VenueInfoSection({ venue }: { venue: Venue }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: venue.name,
    address: venue.address ?? "",
    capacity: venue.capacity == null ? "" : String(venue.capacity),
  });

  return (
    <Section title="ობიექტის მონაცემები">
      <div className="grid gap-4">
        <div>
          <label className="label">სახელი</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">მისამართი</label>
          <input
            className="input"
            placeholder="—"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div>
          <label className="label">ტევადობა (სტუმარი)</label>
          <input
            type="number"
            className="input"
            placeholder="200"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn btn-primary"
            disabled={pending || !form.name.trim()}
            onClick={() =>
              startTransition(async () => {
                await updateVenue(venue.id, {
                  name: form.name,
                  address: form.address,
                  capacity: form.capacity === "" ? null : Number(form.capacity),
                });
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
              })
            }
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            შენახვა
          </button>
          {saved && (
            <span className="text-sm font-semibold" style={{ color: "var(--green)" }}>
              შენახულია ✓
            </span>
          )}
        </div>
      </div>
    </Section>
  );
}

function DuplicateSection({
  venue,
  otherVenues,
}: {
  venue: Venue;
  otherVenues: { id: number; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [targetId, setTargetId] = useState(
    otherVenues.length === 1 ? String(otherVenues[0].id) : "",
  );
  const [result, setResult] = useState<{
    error?: string;
    counts?: Record<string, number>;
    targetName?: string;
  } | null>(null);

  const targetName = otherVenues.find((v) => v.id === Number(targetId))?.name;

  return (
    <Section title="მონაცემების დუბლირება სხვა ობიექტზე">
      <p className="mb-4 text-sm" style={{ color: "var(--text-2)" }}>
        გადაიტანს <b>{venue.name}</b>-ის მენიუს (კატეგორიები, ინგრედიენტები,
        კერძები რეცეპტებით), ინვენტარს, მომწოდებლებს, სერვისებს, თანამშრომლებს,
        ფიქსირებულ ხარჯებს და პაკეტებს. <b>ჯავშნები, კლიენტები და ფინანსური
        ჩანაწერები არ კოპირდება.</b> რაც სამიზნეზე უკვე არსებობს (იგივე
        სახელით), არ დუბლირდება — ე.ი. ღილაკის ხელახლა დაჭერა უსაფრთხოა.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label">სამიზნე ობიექტი</label>
          <select
            className="select"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">— აირჩიე —</option>
            {otherVenues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary"
          disabled={pending || !targetId}
          onClick={() => {
            if (!confirm(`გადავიტანო „${venue.name}"-ის მონაცემები → „${targetName}"?`))
              return;
            startTransition(async () => {
              const res = await duplicateVenueData(Number(targetId));
              setResult(res ?? null);
            });
          }}
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
          დუბლირება
        </button>
      </div>

      {result?.error && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ background: "var(--red-soft)", color: "var(--red)" }}
        >
          {result.error}
        </div>
      )}

      {result?.counts && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--green-soft)", color: "var(--green)" }}
        >
          <div className="mb-1 flex items-center gap-2 font-bold">
            <Check size={15} /> გადატანილია „{result.targetName}"-ზე:
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(result.counts).map(([k, v]) => (
              <span key={k}>
                {k}: <b>{v}</b>
              </span>
            ))}
          </div>
          {Object.values(result.counts).every((v) => v === 0) && (
            <div className="mt-1" style={{ color: "var(--text-2)" }}>
              ყველაფერი უკვე არსებობდა — ახალი არაფერი დამატებულა.
            </div>
          )}
        </div>
      )}

      <div
        className="mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-xs leading-relaxed"
        style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
      >
        <Building2 size={14} className="mt-0.5 shrink-0" />
        გადატანის შემდეგ მონაცემები დამოუკიდებელია — ერთ ობიექტზე ფასის შეცვლა
        მეორეზე აღარ აისახება.
      </div>
    </Section>
  );
}
