"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  CalendarHeart,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import {
  addLedgerEntry,
  closeDay,
  createStaff,
  deleteLedgerEntry,
  deleteStaff,
  logAllStaffShift,
  reopenDay,
  updateLedgerEntry,
  updateStaff,
} from "@/lib/actions";
import type {
  DebtRow,
  MonthSummary,
  PartnerAdvance,
  RegisterDay,
  StaffMember,
} from "@/lib/queries";
import { addAdvanceRepayment, addDebtRepayment } from "@/lib/actions";
import { EXPENSE_CATEGORIES } from "@/lib/booking-shared";
import { gel, fmtDate, monthNameKa, todayISO } from "@/lib/format";
import { PageHeader, Section, StatCard, EmptyState } from "@/components/ui";

const TYPE_LABELS: Record<string, string> = {
  income: "შემოსავალი",
  expense: "ხარჯი",
  wage: "ხელფასი",
};

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type PartnerLite = { id: number; name: string; sharePct: number };

export default function RegisterClient({
  day,
  month,
  monthLabel,
  incomeTaxPct,
  partners,
  advances,
  debtList,
}: {
  day: RegisterDay;
  month: MonthSummary;
  monthLabel: { year: number; month: number };
  incomeTaxPct: number;
  partners: PartnerLite[];
  advances: PartnerAdvance[];
  debtList: DebtRow[];
}) {
  const [tab, setTab] = useState<"day" | "staff" | "month">("day");

  return (
    <>
      <PageHeader
        title="დღის რეესტრი"
        subtitle="ყოველდღიური შემოსავალი, ხარჯი, ხელფასი და დღის დახურვა"
      />

      <div className="mb-5 flex gap-2">
        <TabButton active={tab === "day"} onClick={() => setTab("day")} label="დღე" />
        <TabButton
          active={tab === "staff"}
          onClick={() => setTab("staff")}
          label={`თანამშრომლები (${day.staff.length})`}
        />
        <TabButton
          active={tab === "month"}
          onClick={() => setTab("month")}
          label="თვის ანალიზი"
        />
      </div>

      {tab === "day" && (
        <DayTab day={day} partners={partners} advances={advances} debtList={debtList} />
      )}
      {tab === "staff" && <StaffTab staff={day.staff} />}
      {tab === "month" && (
        <MonthTab
          month={month}
          label={monthLabel}
          incomeTaxPct={incomeTaxPct}
          partners={partners}
        />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className="btn"
      style={
        active
          ? { background: "var(--text)", color: "var(--surface)" }
          : {
              background: "var(--surface)",
              color: "var(--text-2)",
              border: "1px solid var(--border)",
            }
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ---------------- Day ----------------

function DayTab({
  day,
  partners,
  advances,
  debtList,
}: {
  day: RegisterDay;
  partners: PartnerLite[];
  advances: PartnerAdvance[];
  debtList: DebtRow[];
}) {
  const router = useRouter();
  const locked = !!day.close;

  const go = (iso: string) => router.push(`/register?date=${iso}`);

  // Events happening on this exact day → entries default-link to them.
  const dayEvents = day.bookings.filter((b) => b.eventDate === day.date);
  const eventTotals = new Map<number, { income: number; cost: number }>();
  for (const e of day.entries) {
    if (e.bookingId == null) continue;
    const t = e.amount * e.qty;
    const cur = eventTotals.get(e.bookingId) ?? { income: 0, cost: 0 };
    if (e.type === "income") cur.income += t;
    else cur.cost += t;
    eventTotals.set(e.bookingId, cur);
  }

  return (
    <>
      {/* date navigation */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost !px-2.5" onClick={() => go(shiftDate(day.date, -1))}>
          <ChevronLeft size={16} />
        </button>
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <CalendarDays size={16} style={{ color: "var(--text-3)" }} />
          <span className="font-bold">{fmtDate(day.date)}</span>
          {locked && (
            <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
              <Lock size={11} /> დახურული
            </span>
          )}
        </div>
        <button className="btn btn-ghost !px-2.5" onClick={() => go(shiftDate(day.date, 1))}>
          <ChevronRight size={16} />
        </button>
        <input
          type="date"
          className="input !w-auto"
          value={day.date}
          onChange={(e) => e.target.value && go(e.target.value)}
        />
        {day.date !== todayISO() && (
          <button className="btn btn-ghost" onClick={() => go(todayISO())}>
            დღეს
          </button>
        )}
      </div>

      {dayEvents.length > 0 && (
        <div
          className="mb-5 rounded-xl px-4 py-3"
          style={{ background: "var(--primary-soft)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--primary-strong)" }}>
            <CalendarHeart size={16} /> ამ დღეს ივენთია
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {dayEvents.map((b) => {
              const t = eventTotals.get(b.id);
              return (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/bookings/${b.id}`}
                    className="font-semibold underline"
                    style={{ color: "var(--primary-strong)" }}
                  >
                    {b.title}
                  </Link>
                  <span className="text-xs" style={{ color: "var(--text-2)" }}>
                    {t
                      ? `ამ დღეს დაფიქსირდა: შემოსავალი ${gel(t.income)} · ხარჯი ${gel(t.cost)}`
                      : "ჩანაწერები ავტომ. მიება ამ ივენთს"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--text-3)" }}>
            ქვემოთ დამატებული შემოსავალი/ხარჯი ავტომატურად ერთვის ამ ივენთს — ჩანს
            ჯავშნის გვერდზეც.
          </p>
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ArrowUpCircle} label="შემოსავალი" value={gel(day.income)} tone="green" />
        <StatCard icon={UsersRound} label="ხელფასი" value={gel(day.wages)} tone="red" />
        <StatCard icon={ArrowDownCircle} label="ხარჯი" value={gel(day.expenses)} tone="red" />
        <StatCard
          icon={Wallet}
          label="სუფთა"
          value={gel(day.net)}
          tone={day.net >= 0 ? "green" : "red"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          {!locked && (
            <QuickAddPanel key={day.date} day={day} dayEvents={dayEvents} />
          )}
          <EntriesPanel day={day} locked={locked} />
        </div>
        <div className="grid gap-6">
          <ZReportPanel day={day} partners={partners} />
          <DeductPanel key={day.date} advances={advances} debtList={debtList} day={day} net={day.net} />
        </div>
      </div>
    </>
  );
}

type DeductTarget = { key: string; kind: "advance" | "debt"; id: number; name: string; remaining: number };

/** Deduct part of the day's leftover toward a partner advance OR a general debt. */
function DeductPanel({
  advances,
  debtList,
  day,
  net,
}: {
  advances: PartnerAdvance[];
  debtList: DebtRow[];
  day: RegisterDay;
  net: number;
}) {
  const targets: DeductTarget[] = [
    ...advances
      .filter((a) => a.remaining > 0)
      .map((a) => ({ key: `a${a.id}`, kind: "advance" as const, id: a.id, name: `${a.name} (ავანსი)`, remaining: a.remaining })),
    ...debtList
      .filter((d) => d.remaining > 0)
      .map((d) => ({ key: `d${d.id}`, kind: "debt" as const, id: d.id, name: d.name, remaining: d.remaining })),
  ];
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState(targets[0]?.key ?? "");
  const [amount, setAmount] = useState("");

  if (targets.length === 0) return null;

  const sel = targets.find((t) => t.key === key) ?? targets[0];
  const amt = Number(amount) || 0;
  const leftover = net - amt;

  return (
    <Section title="ვალის გაქვითვა დღიდან">
      <p className="mb-3 text-sm" style={{ color: "var(--text-2)" }}>
        დღეს დარჩა <b>{gel(net)}</b>. გაქვითე ავანსიდან ან ვალიდან — დარჩენილს სხვას
        მოახმარ.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">რას ვქვითავთ</label>
          <select className="select" value={sel.key} onChange={(e) => setKey(e.target.value)}>
            {targets.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} — {gel(t.remaining)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">თანხა ₾</label>
          <input
            type="number"
            className="input"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            className="btn btn-primary w-full"
            disabled={pending || !(amt > 0)}
            onClick={() =>
              startTransition(async () => {
                if (sel.kind === "advance") {
                  await addAdvanceRepayment({ partnerId: sel.id, amount: amt, repayDate: day.date, note: "დღის მოგებიდან" });
                } else {
                  await addDebtRepayment({ debtId: sel.id, amount: amt, repayDate: day.date, note: "დღის მოგებიდან" });
                }
                setAmount("");
              })
            }
          >
            გაქვითვა
          </button>
        </div>
      </div>
      {amt > 0 && (
        <div className="mt-3 rounded-xl px-4 py-2.5 text-sm" style={{ background: "var(--surface-2)" }}>
          {sel.name}: {gel(sel.remaining)} → <b>{gel(Math.max(sel.remaining - amt, 0))}</b>
          {"  ·  "}დღიდან დარჩება: <b style={{ color: leftover >= 0 ? "var(--green)" : "var(--red)" }}>{gel(leftover)}</b>
        </div>
      )}
    </Section>
  );
}

function QuickAddPanel({
  day,
  dayEvents,
}: {
  day: RegisterDay;
  dayEvents: RegisterDay["bookings"];
}) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<"income" | "expense" | "wage">("income");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("1");
  const [staffId, setStaffId] = useState("");
  // If exactly one event happens this day, attach entries to it by default.
  const [bookingId, setBookingId] = useState(
    dayEvents.length === 1 ? String(dayEvents[0].id) : "",
  );
  const [note, setNote] = useState("");

  const activeStaff = day.staff.filter((s) => s.active);
  const otherBookings = day.bookings.filter(
    (b) => !dayEvents.some((e) => e.id === b.id),
  );

  const add = () =>
    startTransition(async () => {
      await addLedgerEntry({
        entryDate: day.date,
        type,
        category: category || (type === "wage" ? "ხელფასი" : undefined),
        amount: Number(amount) || 0,
        qty: Number(qty) || 1,
        staffId: type === "wage" && staffId ? Number(staffId) : null,
        bookingId: bookingId ? Number(bookingId) : null,
        note,
      });
      setAmount("");
      setQty("1");
      setCategory("");
      setNote("");
    });

  return (
    <Section title="ჩანაწერის დამატება">
      <div className="mb-3 flex gap-2">
        {(["income", "expense", "wage"] as const).map((t) => (
          <button
            key={t}
            className="badge cursor-pointer"
            style={
              type === t
                ? {
                    background:
                      t === "income" ? "var(--green)" : "var(--red)",
                    color: "#fff",
                  }
                : {
                    background: "var(--surface)",
                    color: "var(--text-2)",
                    border: "1px solid var(--border)",
                  }
            }
            onClick={() => setType(t)}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {type === "wage" ? (
          <div>
            <label className="label">თანამშრომელი</label>
            <select
              className="select"
              value={staffId}
              onChange={(e) => {
                setStaffId(e.target.value);
                const s = activeStaff.find((x) => x.id === Number(e.target.value));
                if (s && s.dailyRate > 0) setAmount(String(s.dailyRate));
              }}
            >
              <option value="">— აირჩიე —</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.dailyRate > 0 ? ` (${gel(s.dailyRate)})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">კატეგორია</label>
            <input
              className="input"
              list="reg-cats"
              placeholder={type === "income" ? "მაგ. ივენთი" : "მაგ. პროდუქტი"}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="reg-cats">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">თანხა ₾</label>
            <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">რაოდ.</label>
            <input type="number" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">
            ივენთი {dayEvents.length ? "" : "(არასავალდებულო)"}
          </label>
          <select className="select" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
            <option value="">— არცერთი —</option>
            {dayEvents.length > 0 && (
              <optgroup label="ამ დღის ივენთები">
                {dayEvents.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </optgroup>
            )}
            {otherBookings.length > 0 && (
              <optgroup label="სხვა ჯავშნები">
                {otherBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} · {fmtDate(b.eventDate)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div>
          <label className="label">შენიშვნა</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn btn-primary"
          disabled={pending || !(Number(amount) > 0)}
          onClick={add}
        >
          <Plus size={16} /> დამატება
        </button>
        {day.staff.some((s) => s.active && s.dailyRate > 0) && (
          <button
            className="btn btn-ghost"
            disabled={pending}
            title="ყველა აქტიური თანამშრომლის დღიური ცვლის დაფიქსირება"
            onClick={() =>
              startTransition(async () => {
                await logAllStaffShift(day.date);
              })
            }
          >
            <Users size={15} /> ცვლა ყველა თანამშრომელზე
          </button>
        )}
      </div>
    </Section>
  );
}

function EntriesPanel({ day, locked }: { day: RegisterDay; locked: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Section title={`დღის ჩანაწერები (${day.entries.length})`}>
      {day.entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="ჩანაწერები არ არის"
          text="დაამატე ამ დღის შემოსავალი, ხარჯი ან ხელფასი."
        />
      ) : (
        <div className="table-wrap -m-5">
          <table className="table">
            <thead>
              <tr>
                <th>ტიპი</th>
                <th>აღწერა</th>
                <th>თანხა</th>
                {!locked && <th></th>}
              </tr>
            </thead>
            <tbody>
              {day.entries.map((e) => (
                <EntryRow key={e.id} e={e} locked={locked} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function EntryRow({ e, locked }: { e: RegisterDay["entries"][number]; locked: boolean }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [cat, setCat] = useState(e.category ?? "");
  const [amount, setAmount] = useState(String(e.amount));
  const total = e.amount * e.qty;
  const income = e.type === "income";

  const save = () =>
    startTransition(async () => {
      await updateLedgerEntry(e.id, { category: cat, amount: Number(amount) || 0 });
      setEditing(false);
    });

  return (
    <tr>
      <td>
        <span
          className="badge"
          style={
            income
              ? { background: "var(--green-soft)", color: "var(--green)" }
              : { background: "var(--red-soft)", color: "var(--red)" }
          }
        >
          {TYPE_LABELS[e.type]}
        </span>
      </td>
      {editing ? (
        <>
          <td>
            <input className="input !py-1.5" value={cat} onChange={(ev) => setCat(ev.target.value)} placeholder="აღწერა" />
          </td>
          <td>
            <input
              type="number"
              className="input !w-28 !py-1.5"
              value={amount}
              onChange={(ev) => setAmount(ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && save()}
            />
          </td>
          <td>
            <div className="flex justify-end gap-1">
              <button className="btn btn-primary !px-2 !py-1.5" disabled={pending} onClick={save}>
                <Check size={14} />
              </button>
              <button className="btn btn-ghost !px-2 !py-1.5" disabled={pending} onClick={() => setEditing(false)}>
                <X size={14} />
              </button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td>
            <div className="font-semibold">{e.staffName ?? e.category ?? TYPE_LABELS[e.type]}</div>
            <div className="text-xs" style={{ color: "var(--text-3)" }}>
              {e.qty !== 1 ? `${e.qty} × ${gel(e.amount, 2)}` : ""}
              {e.bookingTitle ? ` · ` : ""}
              {e.bookingTitle && (
                <Link href={`/bookings/${e.bookingId}`} className="underline" style={{ color: "var(--primary)" }}>
                  {e.bookingTitle}
                </Link>
              )}
              {e.note ? ` ${e.note}` : ""}
            </div>
          </td>
          <td className="whitespace-nowrap font-bold" style={{ color: income ? "var(--green)" : "var(--red)" }}>
            {income ? "+" : "−"}
            {gel(total)}
          </td>
          {!locked && (
            <td>
              <div className="flex justify-end gap-1">
                <button className="btn btn-ghost !px-2 !py-1.5" disabled={pending} onClick={() => setEditing(true)} title="რედაქტირება">
                  <Pencil size={14} />
                </button>
                <button
                  className="btn btn-ghost !px-2 !py-1.5"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("წავშალო ჩანაწერი?")) startTransition(() => deleteLedgerEntry(e.id));
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          )}
        </>
      )}
    </tr>
  );
}

function ZReportPanel({ day, partners }: { day: RegisterDay; partners: PartnerLite[] }) {
  const [pending, startTransition] = useTransition();
  const [counted, setCounted] = useState(
    day.close?.countedCash != null ? String(day.close.countedCash) : "",
  );
  const locked = !!day.close;
  const expected = locked ? day.close!.expectedCash : day.expectedCash;
  const diff = counted !== "" ? Number(counted) - expected : null;

  return (
    <Section title="დღის დახურვა (Z-რეპორტი)">
      <div className="flex flex-col gap-2 text-sm">
        <ZLine label="საწყისი ნაშთი" value={gel(day.openingBalance)} />
        <ZLine label="+ შემოსავალი" value={gel(day.income)} color="var(--green)" />
        <ZLine label="− ხელფასი" value={gel(day.wages)} color="var(--red)" />
        <ZLine label="− ხარჯი" value={gel(day.expenses)} color="var(--red)" />
        <div style={{ borderTop: "1px solid var(--border)" }} className="mt-1 pt-2">
          <ZLine label="მოსალოდნელი ნაღდი" value={gel(expected)} strong />
        </div>
      </div>

      {partners.length > 0 && day.net !== 0 && (
        <div
          className="mt-4 rounded-xl px-4 py-3"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text-2)" }}>
            <Users size={13} /> დღის მოგების განაწილება
          </div>
          <div className="flex flex-col gap-1 text-sm">
            {partners.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span style={{ color: "var(--text-2)" }}>
                  {p.name} ({p.sharePct}%)
                </span>
                <span className="font-bold">{gel((day.net * p.sharePct) / 100)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="label">დათვლილი ნაღდი (ფაქტი)</label>
        <input
          type="number"
          className="input"
          placeholder="ჩაწერე რამდენი დარჩა სალაროში"
          value={counted}
          disabled={locked}
          onChange={(e) => setCounted(e.target.value)}
        />
      </div>

      {diff !== null && (
        <div
          className="mt-3 rounded-xl px-4 py-2.5 text-sm font-bold"
          style={
            Math.abs(diff) < 0.01
              ? { background: "var(--green-soft)", color: "var(--green)" }
              : { background: diff > 0 ? "var(--green-soft)" : "var(--red-soft)", color: diff > 0 ? "var(--green)" : "var(--red)" }
          }
        >
          {Math.abs(diff) < 0.01
            ? "ზუსტად ემთხვევა ✓"
            : diff > 0
              ? `ზედმეტი: ${gel(diff)}`
              : `დანაკლისი: ${gel(Math.abs(diff))}`}
        </div>
      )}

      <div className="mt-4">
        {locked ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
              <Lock size={12} /> დღე დახურულია
            </span>
            <button
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => startTransition(() => reopenDay(day.date))}
            >
              <LockOpen size={15} /> ხელახლა გახსნა
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await closeDay(day.date, counted === "" ? null : Number(counted));
              })
            }
          >
            <Lock size={15} /> დღის დახურვა
          </button>
        )}
      </div>

      <p className="mt-3 text-xs" style={{ color: "var(--text-3)" }}>
        დახურვისას მოსალოდნელი ნაღდი გადადის მეორე დღის საწყის ნაშთად.
      </p>
    </Section>
  );
}

function ZLine({
  label,
  value,
  color,
  strong,
}: {
  label: string;
  value: string;
  color?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span className={strong ? "text-base font-extrabold" : "font-semibold"} style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

// ---------------- Staff ----------------

function StaffTab({ staff }: { staff: StaffMember[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", role: "", phone: "", rate: "" });

  return (
    <>
      <Section title="ახალი თანამშრომელი" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="label">სახელი</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">როლი</label>
            <input className="input" placeholder="მიმტანი" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </div>
          <div>
            <label className="label">დღიური ₾</label>
            <input type="number" className="input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button
              className="btn btn-primary w-full"
              disabled={pending || !form.name.trim()}
              onClick={() =>
                startTransition(async () => {
                  await createStaff({
                    name: form.name,
                    role: form.role,
                    phone: form.phone,
                    dailyRate: Number(form.rate) || 0,
                  });
                  setForm({ name: "", role: "", phone: "", rate: "" });
                })
              }
            >
              <Plus size={16} /> დამატება
            </button>
          </div>
        </div>
      </Section>

      <Section>
        {staff.length === 0 ? (
          <EmptyState
            icon={Users}
            title="თანამშრომლები არ არის"
            text="დაამატე პერსონალი დღიური განაკვეთით — მერე ერთი კლიკით დააფიქსირებ მთელი დღის ცვლას."
          />
        ) : (
          <div className="table-wrap -m-5">
            <table className="table">
              <thead>
                <tr>
                  <th>სახელი</th>
                  <th>როლი</th>
                  <th>დღიური</th>
                  <th>სტატუსი</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <StaffRow key={s.id} s={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function StaffRow({ s }: { s: StaffMember }) {
  const [pending, startTransition] = useTransition();
  const [rate, setRate] = useState(String(s.dailyRate));

  return (
    <tr style={s.active ? undefined : { opacity: 0.5 }}>
      <td className="font-semibold">{s.name}</td>
      <td style={{ color: "var(--text-2)" }}>{s.role ?? "—"}</td>
      <td>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className="input !w-24 !py-1.5"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => {
              const v = Number(rate);
              if (!Number.isNaN(v) && v !== s.dailyRate)
                startTransition(() => updateStaff(s.id, { dailyRate: v }));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>₾</span>
        </div>
      </td>
      <td>
        <button
          className="badge cursor-pointer"
          style={
            s.active
              ? { background: "var(--green-soft)", color: "var(--green)" }
              : { background: "var(--surface-2)", color: "var(--text-3)" }
          }
          disabled={pending}
          onClick={() => startTransition(() => updateStaff(s.id, { active: !s.active }))}
        >
          {s.active ? "აქტიური" : "გათიშული"}
        </button>
      </td>
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            disabled={pending}
            onClick={() => {
              if (confirm(`წავშალო „${s.name}"?`))
                startTransition(() => deleteStaff(s.id));
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------- Month ----------------

function MonthTab({
  month,
  label,
  incomeTaxPct,
  partners,
}: {
  month: MonthSummary;
  label: { year: number; month: number };
  incomeTaxPct: number;
  partners: PartnerLite[];
}) {
  const router = useRouter();
  const maxNet = useMemo(
    () => Math.max(1, ...month.dailyNet.map((d) => Math.abs(d.net))),
    [month.dailyNet],
  );
  const tax = (month.income * incomeTaxPct) / 100;
  const netAfterTax = month.net - tax;

  const goMonth = (delta: number) => {
    let y = label.year;
    let m = label.month + delta;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    router.push(`/register?date=${y}-${String(m).padStart(2, "0")}-01`);
  };

  return (
    <>
      <div className="mb-5 flex items-center gap-2">
        <button className="btn btn-ghost !px-2.5" onClick={() => goMonth(-1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-lg font-extrabold">
          {monthNameKa(label.month - 1)} {label.year}
        </span>
        <button className="btn btn-ghost !px-2.5" onClick={() => goMonth(1)}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ArrowUpCircle} label="შემოსავალი" value={gel(month.income)} tone="green" />
        <StatCard icon={ArrowDownCircle} label="ხარჯი + ხელფასი" value={gel(month.expenses + month.wages)} tone="red" />
        {incomeTaxPct > 0 ? (
          <StatCard
            icon={Wallet}
            label={`სუფთა (გადასახ. წინ)`}
            value={gel(month.net)}
            hint={`გადასახადი ${incomeTaxPct}%: ${gel(tax)}`}
            tone={month.net >= 0 ? "green" : "red"}
          />
        ) : (
          <StatCard icon={UsersRound} label="ხელფასი" value={gel(month.wages)} tone="red" />
        )}
        <StatCard
          icon={Wallet}
          label={incomeTaxPct > 0 ? "სუფთა (გადასახ. შემდეგ)" : "სუფთა"}
          value={gel(netAfterTax)}
          hint={`დახურული დღეები: ${month.closedDays}/${month.daysInMonth}`}
          tone={netAfterTax >= 0 ? "green" : "red"}
        />
      </div>

      {partners.length > 0 && netAfterTax !== 0 && (
        <div
          className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--surface-2)" }}
        >
          <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text-2)" }}>
            <Users size={13} /> თვის განაწილება:
          </span>
          {partners.map((p) => (
            <span key={p.id}>
              {p.name} ({p.sharePct}%):{" "}
              <b>{gel((netAfterTax * p.sharePct) / 100)}</b>
            </span>
          ))}
          <Link href="/finance" className="text-xs underline" style={{ color: "var(--primary)" }}>
            ბალანსები ფინანსებში →
          </Link>
        </div>
      )}

      <Section title="დღეების დინამიკა" className="mb-5">
        <div className="flex items-end gap-0.5" style={{ height: 120 }}>
          {month.dailyNet.map((d) => {
            const h = (Math.abs(d.net) / maxNet) * 100;
            const pos = d.net >= 0;
            return (
              <button
                key={d.day}
                title={`${d.day} — ${gel(d.net)}`}
                className="flex-1 rounded-sm"
                style={{
                  height: `${Math.max(h, d.net !== 0 ? 4 : 1)}%`,
                  background: d.net === 0 ? "var(--border)" : pos ? "var(--green)" : "var(--red)",
                  opacity: 0.85,
                }}
                onClick={() =>
                  router.push(
                    `/register?date=${label.year}-${String(label.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
                  )
                }
              />
            );
          })}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--text-3)" }}>
          თითო სვეტი — დღის სუფთა შედეგი. დააჭირე დღეზე გადასასვლელად.
        </p>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="ხელფასები თანამშრომლების მიხედვით">
          {month.wagesByStaff.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              ამ თვეში ხელფასი არ დაფიქსირებულა.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {month.wagesByStaff.map((w) => (
                <BreakdownRow key={w.name} label={w.name} value={w.total} total={month.wages} />
              ))}
            </div>
          )}
        </Section>
        <Section title="ხარჯები კატეგორიების მიხედვით">
          {month.expensesByCategory.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              ამ თვეში ხარჯი არ დაფიქსირებულა.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {month.expensesByCategory.map((c) => (
                <BreakdownRow key={c.category} label={c.category} value={c.total} total={month.expenses} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}

function BreakdownRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-sm font-medium">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
      </div>
      <span className="w-24 shrink-0 text-right text-sm font-bold">{gel(value)}</span>
    </div>
  );
}
