"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarHeart,
  ChevronRight,
  CircleDollarSign,
  Hourglass,
  Plus,
  X,
} from "lucide-react";
import { createBooking } from "@/lib/actions";
import { bookingTotal, type BookingRow } from "@/lib/booking-shared";
import { gel, fmtDateShort, todayISO } from "@/lib/format";
import {
  PageHeader,
  Section,
  StatCard,
  EmptyState,
  StatusBadge,
  EVENT_TYPE_LABELS,
} from "@/components/ui";

const FILTERS = [
  { key: "upcoming", label: "მომავალი" },
  { key: "all", label: "ყველა" },
  { key: "confirmed", label: "დადასტურებული" },
  { key: "completed", label: "ჩატარებული" },
  { key: "cancelled", label: "გაუქმებული" },
];

export default function BookingsClient({ bookings }: { bookings: BookingRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("upcoming");

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
    switch (filter) {
      case "upcoming":
        return bookings.filter(
          (b) =>
            b.eventDate >= today &&
            b.status !== "cancelled" &&
            b.status !== "completed",
        );
      case "confirmed":
      case "completed":
      case "cancelled":
        return bookings.filter((b) => b.status === filter);
      default:
        return bookings;
    }
  }, [bookings, filter, today]);

  return (
    <>
      <PageHeader
        title="ჯავშნები"
        subtitle="ყოველ ჯავშანზე — გადახდები, ხარჯები და მოგება ერთ ადგილას"
        action={
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "დახურვა" : "ახალი ჯავშანი"}
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={CalendarHeart}
          label="მომავალი ივენთები"
          value={String(stats.upcomingCount)}
          tone="primary"
        />
        <StatCard
          icon={CircleDollarSign}
          label="მოსალოდნელი შემოსავალი"
          value={gel(stats.pipeline)}
          tone="gold"
        />
        <StatCard
          icon={Hourglass}
          label="მისაღები თანხა"
          value={gel(stats.outstanding)}
          tone={stats.outstanding > 0 ? "red" : "green"}
        />
      </div>

      {showForm && (
        <div className="mb-6">
          <NewBookingForm onDone={() => setShowForm(false)} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="badge cursor-pointer"
            style={
              filter === f.key
                ? { background: "var(--text)", color: "var(--surface)" }
                : {
                    background: "var(--surface)",
                    color: "var(--text-2)",
                    border: "1px solid var(--border)",
                  }
            }
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Section>
        {filtered.length === 0 ? (
          <EmptyState
            icon={CalendarHeart}
            title={filter === "upcoming" ? "მომავალი ივენთი არ არის" : "ჯავშნები არ არის"}
            text="დაამატე ჯავშანი — მიუთითე ივენთის ტიპი, თარიღი, სტუმრების რაოდენობა და ფასი."
            action={
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
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
                {filtered.map((b) => {
                  const total = bookingTotal(b);
                  const left = Math.max(total - b.paidTotal, 0);
                  return (
                    <tr
                      key={b.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/bookings/${b.id}`)}
                    >
                      <td className="whitespace-nowrap font-semibold">
                        {fmtDateShort(b.eventDate)}
                      </td>
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
                        <div className="font-semibold" style={{ color: "var(--green)" }}>
                          {gel(b.paidTotal)}
                        </div>
                        {left > 0 && (
                          <div className="text-xs" style={{ color: "var(--red)" }}>
                            დარჩა {gel(left)}
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={b.status} />
                      </td>
                      <td>
                        <span style={{ color: "var(--text-3)" }}>
                          <ChevronRight size={16} />
                        </span>
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

function NewBookingForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    eventType: "wedding",
    eventDate: "",
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
              <option key={k} value={k}>
                {v}
              </option>
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
          <div
            className="w-full rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
          >
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
      {error && (
        <p className="mt-3 text-sm font-semibold" style={{ color: "var(--red)" }}>
          {error}
        </p>
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
        <button className="btn btn-ghost" onClick={onDone}>
          გაუქმება
        </button>
      </div>
    </Section>
  );
}
