"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarHeart, Plus, Trash2, X, HandCoins } from "lucide-react";
import {
  createBooking,
  updateBookingStatus,
  deleteBooking,
  addPayment,
} from "@/lib/actions";
import { bookingTotal, type BookingRow } from "@/lib/booking-shared";
import { gel, fmtDate, todayISO } from "@/lib/format";
import {
  PageHeader,
  Section,
  EmptyState,
  StatusBadge,
  EVENT_TYPE_LABELS,
} from "@/components/ui";

const STATUSES = [
  "inquiry",
  "tentative",
  "confirmed",
  "completed",
  "cancelled",
] as const;

const STATUS_LABELS: Record<string, string> = {
  inquiry: "მოთხოვნა",
  tentative: "წინასწარი",
  confirmed: "დადასტურებული",
  completed: "ჩატარებული",
  cancelled: "გაუქმებული",
};

const FILTERS = [
  { key: "all", label: "ყველა" },
  { key: "upcoming", label: "მომავალი" },
  { key: "confirmed", label: "დადასტურებული" },
  { key: "completed", label: "ჩატარებული" },
  { key: "cancelled", label: "გაუქმებული" },
];

export default function BookingsClient({ bookings }: { bookings: BookingRow[] }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [payFor, setPayFor] = useState<BookingRow | null>(null);
  const [pending, startTransition] = useTransition();

  const today = todayISO();
  const filtered = useMemo(() => {
    switch (filter) {
      case "upcoming":
        return bookings.filter(
          (b) => b.eventDate >= today && b.status !== "cancelled" && b.status !== "completed",
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
        subtitle="ივენთების ჯავშნები, სტატუსები და გადახდები"
        action={
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "დახურვა" : "ახალი ჯავშანი"}
          </button>
        }
      />

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
                ? { background: "var(--primary)", color: "#fff" }
                : { background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }
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
            title="ჯავშნები არ არის"
            text="დაამატე პირველი ჯავშანი — მიუთითე ივენთის ტიპი, თარიღი, სტუმრების რაოდენობა და ფასი."
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
                    <tr key={b.id}>
                      <td className="whitespace-nowrap font-semibold">{fmtDate(b.eventDate)}</td>
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
                        <select
                          className="select !w-auto !py-1.5 !text-xs"
                          value={b.status}
                          onChange={(e) =>
                            startTransition(() => updateBookingStatus(b.id, e.target.value))
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn btn-ghost !px-2.5 !py-1.5"
                            title="გადახდის დამატება"
                            onClick={() => setPayFor(b)}
                          >
                            <HandCoins size={15} />
                          </button>
                          <button
                            className="btn btn-danger !px-2.5 !py-1.5"
                            title="წაშლა"
                            disabled={pending}
                            onClick={() => {
                              if (confirm(`წავშალო „${b.title}"?`))
                                startTransition(() => deleteBooking(b.id));
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {payFor && <PaymentModal booking={payFor} onClose={() => setPayFor(null)} />}
    </>
  );
}

function NewBookingForm({ onDone }: { onDone: () => void }) {
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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const estimate =
    (Number(form.guestCount) || 0) * (Number(form.pricePerGuest) || 0);

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
              else onDone();
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

function PaymentModal({
  booking,
  onClose,
}: {
  booking: BookingRow;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [paidOn, setPaidOn] = useState(todayISO());
  const left = Math.max(bookingTotal(booking) - booking.paidTotal, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(23 24 43 / 0.4)" }}
      onClick={onClose}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold">გადახდა — {booking.title}</h3>
          <button className="btn btn-ghost !px-2 !py-1.5" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-2)" }}>
          გადახდილია {gel(booking.paidTotal)} · დარჩენილი {gel(left)}
        </p>
        <div className="mt-4 grid gap-3">
          <div>
            <label className="label">თანხა (₾)</label>
            <input
              type="number"
              className="input"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">თარიღი</label>
              <input type="date" className="input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div>
              <label className="label">მეთოდი</label>
              <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">ნაღდი</option>
                <option value="transfer">გადარიცხვა</option>
                <option value="card">ბარათი</option>
              </select>
            </div>
          </div>
          <button
            className="btn btn-primary mt-1"
            disabled={pending || !Number(amount)}
            onClick={() =>
              startTransition(async () => {
                await addPayment(booking.id, Number(amount), paidOn, method);
                onClose();
              })
            }
          >
            <HandCoins size={16} /> გადახდის დამატება
          </button>
        </div>
      </div>
    </div>
  );
}
