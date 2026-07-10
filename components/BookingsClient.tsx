"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Hourglass,
  LayoutList,
  Plus,
  Search,
  X,
} from "lucide-react";
import { createBooking } from "@/lib/actions";
import { bookingTotal, STATUS_LABELS, type BookingRow } from "@/lib/booking-shared";
import { gel, fmtDate, fmtDateShort, todayISO, monthNameKa } from "@/lib/format";
import {
  PageHeader,
  Section,
  StatCard,
  EmptyState,
  StatusBadge,
  EVENT_TYPE_LABELS,
} from "@/components/ui";

const STATUS_FILTERS = [
  { key: "upcoming", label: "მომავალი" },
  { key: "all", label: "ყველა" },
  { key: "confirmed", label: "დადასტურებული" },
  { key: "completed", label: "ჩატარებული" },
  { key: "cancelled", label: "გაუქმებული" },
];

const STATUS_DOT: Record<string, string> = {
  inquiry: "var(--blue)",
  tentative: "var(--amber)",
  confirmed: "var(--green)",
  completed: "var(--primary)",
  cancelled: "var(--text-3)",
};

const WEEKDAYS = ["ორ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვ"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function BookingsClient({ bookings }: { bookings: BookingRow[] }) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [filter, setFilter] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"date-asc" | "date-desc" | "value-desc">("date-asc");

  const today = todayISO();

  const stats = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "cancelled");
    const upcoming = active.filter(
      (b) => b.eventDate >= today && b.status !== "completed",
    );
    return {
      upcomingCount: upcoming.length,
      pipeline: upcoming.reduce((s, b) => s + bookingTotal(b), 0),
      outstanding: active.reduce(
        (s, b) => s + Math.max(bookingTotal(b) - b.paidTotal, 0),
        0,
      ),
    };
  }, [bookings, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = bookings.filter((b) => {
      if (filter === "upcoming") {
        if (!(b.eventDate >= today && b.status !== "cancelled" && b.status !== "completed"))
          return false;
      } else if (filter !== "all") {
        if (b.status !== filter) return false;
      }
      if (from && b.eventDate < from) return false;
      if (to && b.eventDate > to) return false;
      if (q) {
        const hay = `${b.title} ${b.clientName ?? ""} ${b.clientPhone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows = rows.slice().sort((a, b) => {
      if (sort === "value-desc") return bookingTotal(b) - bookingTotal(a);
      const cmp = a.eventDate.localeCompare(b.eventDate);
      return sort === "date-asc" ? cmp : -cmp;
    });
    return rows;
  }, [bookings, filter, search, from, to, sort, today]);

  const openCreate = (date?: string) => {
    setFormDate(date ?? "");
    setShowForm(true);
  };

  return (
    <>
      <PageHeader
        title="ჯავშნები"
        subtitle="ყოველ ჯავშანზე — გადახდები, ხარჯები და მოგება ერთ ადგილას"
        action={
          <button className="btn btn-primary" onClick={() => (showForm ? setShowForm(false) : openCreate())}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "დახურვა" : "ახალი ჯავშანი"}
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarHeart} label="მომავალი ივენთები" value={String(stats.upcomingCount)} tone="primary" />
        <StatCard icon={CircleDollarSign} label="მოსალოდნელი შემოსავალი" value={gel(stats.pipeline)} tone="gold" />
        <StatCard
          icon={Hourglass}
          label="მისაღები თანხა"
          value={gel(stats.outstanding)}
          tone={stats.outstanding > 0 ? "red" : "green"}
        />
      </div>

      {showForm && (
        <div className="mb-6">
          <NewBookingForm
            bookings={bookings}
            initialDate={formDate}
            onDone={() => setShowForm(false)}
          />
        </div>
      )}

      {/* view toggle */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex rounded-xl p-1" style={{ background: "var(--surface-2)" }}>
          <ViewTab active={view === "list"} onClick={() => setView("list")} icon={LayoutList} label="სია" />
          <ViewTab active={view === "calendar"} onClick={() => setView("calendar")} icon={CalendarDays} label="კალენდარი" />
        </div>
      </div>

      {view === "list" ? (
        <ListView
          rows={filtered}
          filter={filter}
          setFilter={setFilter}
          search={search}
          setSearch={setSearch}
          from={from}
          setFrom={setFrom}
          to={to}
          setTo={setTo}
          sort={sort}
          setSort={setSort}
          onCreate={() => openCreate()}
          onRow={(id) => router.push(`/bookings/${id}`)}
        />
      ) : (
        <CalendarView bookings={bookings} onDay={openCreate} today={today} />
      )}
    </>
  );
}

function ViewTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutList;
  label: string;
}) {
  return (
    <button
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
      style={
        active
          ? { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow-sm)" }
          : { background: "transparent", color: "var(--text-2)" }
      }
      onClick={onClick}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

// ---------------- List view ----------------

function ListView({
  rows,
  filter,
  setFilter,
  search,
  setSearch,
  from,
  setFrom,
  to,
  setTo,
  sort,
  setSort,
  onCreate,
  onRow,
}: {
  rows: BookingRow[];
  filter: string;
  setFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  sort: "date-asc" | "date-desc" | "value-desc";
  setSort: (v: "date-asc" | "date-desc" | "value-desc") => void;
  onCreate: () => void;
  onRow: (id: number) => void;
}) {
  const anyDateFilter = from || to;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
          <input
            className="input !pl-9"
            placeholder="ძებნა — ივენთი, კლიენტი, ტელეფონი"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input type="date" className="input !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} title="თარიღიდან" />
        <span style={{ color: "var(--text-3)" }}>—</span>
        <input type="date" className="input !w-auto" value={to} onChange={(e) => setTo(e.target.value)} title="თარიღამდე" />
        {anyDateFilter && (
          <button className="btn btn-ghost !px-2.5 !py-2" onClick={() => { setFrom(""); setTo(""); }} title="დიაპაზონის გასუფთავება">
            <X size={15} />
          </button>
        )}
        <select className="select !w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="date-asc">თარიღი ↑</option>
          <option value="date-desc">თარიღი ↓</option>
          <option value="value-desc">ღირებულება ↓</option>
        </select>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            className="badge cursor-pointer"
            style={
              filter === f.key
                ? { background: "var(--text)", color: "var(--surface)" }
                : { background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }
            }
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Section>
        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarHeart}
            title="ჯავშნები ვერ მოიძებნა"
            text="შეცვალე ფილტრი ან ძებნა, ან დაამატე ახალი ჯავშანი."
            action={
              <button className="btn btn-primary" onClick={onCreate}>
                <Plus size={16} /> ჯავშნის დამატება
              </button>
            }
          />
        ) : (
          <div className="table-wrap -m-5">
            <table className="table">
              <thead>
                <tr>
                  <th>თარიღი</th>
                  <th>ივენთი</th>
                  <th>ტიპი</th>
                  <th>სტუმარი</th>
                  <th>ღირებულება</th>
                  <th>გადახდილი</th>
                  <th>სტატუსი</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const total = bookingTotal(b);
                  const left = Math.max(total - b.paidTotal, 0);
                  return (
                    <tr key={b.id} className="cursor-pointer" onClick={() => onRow(b.id)}>
                      <td className="whitespace-nowrap font-semibold">{fmtDateShort(b.eventDate)}</td>
                      <td>
                        <div className="font-semibold">{b.title}</div>
                        {b.clientName && (
                          <div className="text-xs" style={{ color: "var(--text-3)" }}>
                            {b.clientName}
                            {b.clientPhone ? ` · ${b.clientPhone}` : ""}
                          </div>
                        )}
                      </td>
                      <td>{EVENT_TYPE_LABELS[b.eventType] ?? b.eventType}</td>
                      <td>{b.guestCount}</td>
                      <td className="font-semibold">{gel(total)}</td>
                      <td>
                        <div className="font-semibold" style={{ color: "var(--green)" }}>{gel(b.paidTotal)}</div>
                        {left > 0 && (
                          <div className="text-xs" style={{ color: "var(--red)" }}>დარჩა {gel(left)}</div>
                        )}
                      </td>
                      <td><StatusBadge status={b.status} /></td>
                      <td>
                        <span style={{ color: "var(--text-3)" }}><ChevronRight size={16} /></span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

// ---------------- Calendar view ----------------

function CalendarView({
  bookings,
  onDay,
  today,
}: {
  bookings: BookingRow[];
  onDay: (date: string) => void;
  today: string;
}) {
  const [ty, tm] = today.split("-").map(Number);
  const [cal, setCal] = useState({ y: ty, m: tm });

  const byDate = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const arr = map.get(b.eventDate) ?? [];
      arr.push(b);
      map.set(b.eventDate, arr);
    }
    return map;
  }, [bookings]);

  const daysInMonth = new Date(cal.y, cal.m, 0).getDate();
  const firstWeekday = (new Date(cal.y, cal.m - 1, 1).getDay() + 6) % 7; // Mon=0
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const shiftMonth = (d: number) => {
    let y = cal.y;
    let m = cal.m + d;
    if (m < 1) { m = 12; y--; }
    else if (m > 12) { m = 1; y++; }
    setCal({ y, m });
  };

  const monthEventCount = bookings.filter(
    (b) => b.status !== "cancelled" && b.eventDate.startsWith(`${cal.y}-${String(cal.m).padStart(2, "0")}`),
  ).length;

  return (
    <Section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost !px-2.5" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button>
          <span className="text-lg font-extrabold">{monthNameKa(cal.m - 1)} {cal.y}</span>
          <button className="btn btn-ghost !px-2.5" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--text-3)" }}>{monthEventCount} ივენთი</span>
          <button className="btn btn-ghost !py-1.5" onClick={() => setCal({ y: ty, m: tm })}>დღეს</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-xs font-bold" style={{ color: "var(--text-3)" }}>{w}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const date = iso(cal.y, cal.m, day);
          const events = byDate.get(date) ?? [];
          const isToday = date === today;
          const busy = events.length > 0;
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => onDay(date)}
              onKeyDown={(e) => e.key === "Enter" && onDay(date)}
              className="flex min-h-20 cursor-pointer flex-col gap-1 rounded-lg p-1.5 text-left transition-colors"
              style={{
                border: isToday ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                background: busy ? "var(--surface-2)" : "var(--surface)",
              }}
              title={busy ? "დაკავებულია — დააჭირე ახალი ჯავშნისთვის" : "თავისუფალია — დააჭირე დასაჯავშნად"}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: isToday ? "var(--primary-strong)" : "var(--text-2)" }}>
                  {day}
                </span>
                {events.length > 1 && (
                  <span className="badge !px-1.5 !py-0" style={{ background: "var(--red-soft)", color: "var(--red)", fontSize: 10 }}>
                    {events.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {events.slice(0, 2).map((e) => (
                  <Link
                    key={e.id}
                    href={`/bookings/${e.id}`}
                    onClick={(ev) => ev.stopPropagation()}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] font-semibold"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_DOT[e.status] }} />
                    <span className="truncate">{e.title}</span>
                  </Link>
                ))}
                {events.length > 2 && (
                  <span className="text-[10px]" style={{ color: "var(--text-3)" }}>+{events.length - 2} სხვა</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-2)" }}>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[k] }} /> {v}
          </span>
        ))}
      </div>
    </Section>
  );
}

// ---------------- New booking form (with conflict guard) ----------------

function NewBookingForm({
  bookings,
  initialDate,
  onDone,
}: {
  bookings: BookingRow[];
  initialDate: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    eventType: "wedding",
    eventDate: initialDate,
    guestCount: "",
    pricePerGuest: "",
    clientName: "",
    clientPhone: "",
    notes: "",
  });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const estimate = (Number(form.guestCount) || 0) * (Number(form.pricePerGuest) || 0);

  const conflicts = form.eventDate
    ? bookings.filter((b) => b.eventDate === form.eventDate && b.status !== "cancelled")
    : [];

  return (
    <Section title="ახალი ჯავშანი">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label className="label">ივენთის სახელი *</label>
          <input className="input" placeholder="მაგ. ნიკა & თეკლას ქორწილი" value={form.title} onChange={set("title")} />
        </div>
        <div>
          <label className="label">ტიპი</label>
          <select className="select" value={form.eventType} onChange={set("eventType")}>
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">თარიღი *</label>
          <input type="date" className="input" value={form.eventDate} onChange={set("eventDate")} />
        </div>
        <div>
          <label className="label">სტუმრების რაოდენობა</label>
          <input type="number" className="input" placeholder="150" value={form.guestCount} onChange={set("guestCount")} />
        </div>
        <div>
          <label className="label">ფასი სტუმარზე (₾)</label>
          <input type="number" className="input" placeholder="85" value={form.pricePerGuest} onChange={set("pricePerGuest")} />
        </div>
        <div className="flex items-end">
          <div className="w-full rounded-xl px-4 py-2.5 text-sm font-bold" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
            სავარაუდო ღირებულება: {gel(estimate)}
          </div>
        </div>
        <div>
          <label className="label">დამკვეთის სახელი</label>
          <input className="input" value={form.clientName} onChange={set("clientName")} />
        </div>
        <div>
          <label className="label">ტელეფონი</label>
          <input className="input" placeholder="5xx xx xx xx" value={form.clientPhone} onChange={set("clientPhone")} />
        </div>
        <div>
          <label className="label">შენიშვნა</label>
          <input className="input" value={form.notes} onChange={set("notes")} />
        </div>
      </div>

      {conflicts.length > 0 && (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <b>{fmtDate(form.eventDate)}</b> უკვე დაჯავშნილია:{" "}
            {conflicts.map((c, i) => (
              <span key={c.id}>
                {i > 0 ? ", " : ""}
                {c.title} ({STATUS_LABELS[c.status]})
              </span>
            ))}
            . დარწმუნდი, რომ ორმაგი ჯავშანი გინდა.
          </span>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await createBooking({
                title: form.title,
                eventType: form.eventType,
                eventDate: form.eventDate,
                guestCount: Number(form.guestCount) || 0,
                pricePerGuest: Number(form.pricePerGuest) || 0,
                clientName: form.clientName,
                clientPhone: form.clientPhone,
                notes: form.notes,
              });
              if (res?.error) setError(res.error);
              else {
                onDone();
                router.refresh();
              }
            })
          }
        >
          <Plus size={16} /> შენახვა
        </button>
        <button className="btn btn-ghost" onClick={onDone}>გაუქმება</button>
      </div>
    </Section>
  );
}
