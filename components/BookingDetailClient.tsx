"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  CircleDollarSign,
  HandCoins,
  Pencil,
  Plus,
  Receipt,
  Save,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  addBookingLedgerEntry,
  addPayment,
  deleteBooking,
  deleteBookingLedgerEntry,
  deletePayment,
  updateBooking,
  updateBookingStatus,
} from "@/lib/actions";
import {
  bookingTotal,
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/lib/booking-shared";
import type { BookingDetail } from "@/lib/queries";
import { gel, fmtDate, fmtDateShort, todayISO } from "@/lib/format";
import { PageHeader, Section, StatCard, StatusBadge, EVENT_TYPE_LABELS } from "@/components/ui";

export default function BookingDetailClient({
  booking,
}: {
  booking: BookingDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const planned = bookingTotal(booking);
  const paid = booking.paidTotal;
  const outstanding = Math.max(planned - paid, 0);

  const entryTotal = (e: { amount: number; qty: number }) => e.amount * e.qty;
  const costTotal = booking.expenses
    .filter((e) => e.type === "expense" || e.type === "wage")
    .reduce((s, e) => s + entryTotal(e), 0);
  const extraIncome = booking.expenses
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + entryTotal(e), 0);
  const profit = planned + extraIncome - costTotal;

  return (
    <>
      <Link
        href="/bookings"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: "var(--text-2)" }}
      >
        <ArrowLeft size={15} /> ჯავშნები
      </Link>

      <PageHeader
        title={booking.title}
        subtitle={`${EVENT_TYPE_LABELS[booking.eventType] ?? booking.eventType} · ${fmtDate(booking.eventDate)}${booking.startTime ? ` · ${booking.startTime}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <select
              className="select !w-auto !py-2"
              value={booking.status}
              onChange={(e) =>
                startTransition(() => updateBookingStatus(booking.id, e.target.value))
              }
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              className="btn btn-danger"
              disabled={pending}
              onClick={() => {
                if (confirm(`წავშალო ჯავშანი „${booking.title}"?`))
                  startTransition(async () => {
                    await deleteBooking(booking.id);
                    router.push("/bookings");
                  });
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CircleDollarSign}
          label="ღირებულება"
          value={gel(planned)}
          hint={`${booking.guestCount} სტუმარი × ${gel(booking.pricePerGuest, 2)}`}
          tone="gold"
        />
        <StatCard
          icon={HandCoins}
          label="მიღებული"
          value={gel(paid)}
          hint={outstanding > 0 ? `დარჩა ${gel(outstanding)}` : "სრულად გადახდილია"}
          tone={outstanding > 0 ? "default" : "green"}
        />
        <StatCard
          icon={Receipt}
          label="ხარჯი"
          value={gel(costTotal)}
          hint={extraIncome > 0 ? `+ დამატ. შემოსავალი ${gel(extraIncome)}` : "ღონისძიების ხარჯები"}
          tone={costTotal > 0 ? "red" : "default"}
        />
        <StatCard
          icon={TrendingUp}
          label="მოგება (გეგმ.)"
          value={gel(profit)}
          hint="ღირებულება − ხარჯი"
          tone={profit >= 0 ? "green" : "red"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DetailsPanel booking={booking} />
        <div className="grid gap-6">
          <PaymentsPanel booking={booking} outstanding={outstanding} />
          <ExpensesPanel booking={booking} />
        </div>
      </div>
    </>
  );
}

// ---------------- Details (editable) ----------------

function DetailsPanel({ booking }: { booking: BookingDetail }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: booking.title,
    eventType: booking.eventType,
    eventDate: booking.eventDate,
    startTime: booking.startTime ?? "",
    guestCount: String(booking.guestCount),
    pricePerGuest: String(booking.pricePerGuest),
    extraCharges: String(booking.extraCharges),
    discount: String(booking.discount),
    clientName: booking.clientName ?? "",
    clientPhone: booking.clientPhone ?? "",
    notes: booking.notes ?? "",
  });

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () =>
    startTransition(async () => {
      await updateBooking(booking.id, {
        title: form.title,
        eventType: form.eventType,
        eventDate: form.eventDate,
        startTime: form.startTime || null,
        guestCount: Number(form.guestCount) || 0,
        pricePerGuest: Number(form.pricePerGuest) || 0,
        extraCharges: Number(form.extraCharges) || 0,
        discount: Number(form.discount) || 0,
        clientName: form.clientName,
        clientPhone: form.clientPhone,
        notes: form.notes,
      });
      setEditing(false);
    });

  if (!editing) {
    return (
      <Section
        title="დეტალები"
        action={
          <button className="btn btn-ghost !py-1.5" onClick={() => setEditing(true)}>
            <Pencil size={14} /> რედაქტირება
          </button>
        }
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          <Field label="ტიპი" value={EVENT_TYPE_LABELS[booking.eventType] ?? booking.eventType} />
          <Field label="თარიღი" value={fmtDate(booking.eventDate)} />
          <Field label="დაწყება" value={booking.startTime || "—"} />
          <Field label="სტუმრები" value={String(booking.guestCount)} />
          <Field label="ფასი სტუმარზე" value={gel(booking.pricePerGuest, 2)} />
          <Field label="დამატ. საფასური" value={gel(booking.extraCharges)} />
          <Field label="ფასდაკლება" value={gel(booking.discount)} />
          <Field
            label="დამკვეთი"
            value={
              booking.clientName
                ? `${booking.clientName}${booking.clientPhone ? ` · ${booking.clientPhone}` : ""}`
                : "—"
            }
          />
          {booking.notes && (
            <div className="col-span-2">
              <dt className="label">შენიშვნა</dt>
              <dd className="mt-0.5">{booking.notes}</dd>
            </div>
          )}
        </dl>
      </Section>
    );
  }

  return (
    <Section title="დეტალების რედაქტირება">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">ივენთის სახელი</label>
          <input className="input" value={form.title} onChange={(e) => set("title")(e.target.value)} />
        </div>
        <div>
          <label className="label">ტიპი</label>
          <select className="select" value={form.eventType} onChange={(e) => set("eventType")(e.target.value)}>
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">თარიღი</label>
            <input type="date" className="input" value={form.eventDate} onChange={(e) => set("eventDate")(e.target.value)} />
          </div>
          <div>
            <label className="label">დაწყება</label>
            <input type="time" className="input" value={form.startTime} onChange={(e) => set("startTime")(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">სტუმრები</label>
          <input type="number" className="input" value={form.guestCount} onChange={(e) => set("guestCount")(e.target.value)} />
        </div>
        <div>
          <label className="label">ფასი სტუმარზე ₾</label>
          <input type="number" className="input" value={form.pricePerGuest} onChange={(e) => set("pricePerGuest")(e.target.value)} />
        </div>
        <div>
          <label className="label">დამატ. საფასური ₾</label>
          <input type="number" className="input" value={form.extraCharges} onChange={(e) => set("extraCharges")(e.target.value)} />
        </div>
        <div>
          <label className="label">ფასდაკლება ₾</label>
          <input type="number" className="input" value={form.discount} onChange={(e) => set("discount")(e.target.value)} />
        </div>
        <div>
          <label className="label">დამკვეთი</label>
          <input className="input" value={form.clientName} onChange={(e) => set("clientName")(e.target.value)} />
        </div>
        <div>
          <label className="label">ტელეფონი</label>
          <input className="input" value={form.clientPhone} onChange={(e) => set("clientPhone")(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">შენიშვნა</label>
          <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button className="btn btn-primary" disabled={pending} onClick={save}>
          <Save size={15} /> შენახვა
        </button>
        <button className="btn btn-ghost" onClick={() => setEditing(false)}>
          გაუქმება
        </button>
      </div>
    </Section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

// ---------------- Payments ----------------

function PaymentsPanel({
  booking,
  outstanding,
}: {
  booking: BookingDetail;
  outstanding: number;
}) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [paidOn, setPaidOn] = useState(todayISO());

  const add = () =>
    startTransition(async () => {
      await addPayment(booking.id, Number(amount), paidOn, method);
      setAmount("");
    });

  return (
    <Section
      title="გადახდები"
      action={
        outstanding > 0 ? (
          <span className="badge" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
            დარჩა {gel(outstanding)}
          </span>
        ) : booking.payments.length > 0 ? (
          <span className="badge" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
            სრულად
          </span>
        ) : null
      }
    >
      {booking.payments.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {booking.payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: "var(--surface-2)" }}
            >
              <div>
                <div className="font-bold" style={{ color: "var(--green)" }}>
                  {gel(p.amount)}
                </div>
                <div className="text-xs" style={{ color: "var(--text-3)" }}>
                  {fmtDateShort(p.paidOn)} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                </div>
              </div>
              <button
                className="btn btn-ghost !px-2 !py-1.5"
                disabled={pending}
                onClick={() => startTransition(() => deletePayment(p.id, booking.id))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-28">
          <label className="label">თანხა ₾</label>
          <input
            type="number"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="w-36">
          <label className="label">თარიღი</label>
          <input type="date" className="input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
        <div className="w-32">
          <label className="label">მეთოდი</label>
          <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">ნაღდი</option>
            <option value="transfer">გადარიცხვა</option>
            <option value="card">ბარათი</option>
          </select>
        </div>
        <button
          className="btn btn-primary"
          disabled={pending || !(Number(amount) > 0)}
          onClick={add}
        >
          <Plus size={16} /> გადახდა
        </button>
      </div>
    </Section>
  );
}

// ---------------- Event expenses (ledger) ----------------

function ExpensesPanel({ booking }: { booking: BookingDetail }) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("1");
  const [entryDate, setEntryDate] = useState(booking.eventDate || todayISO());
  const [note, setNote] = useState("");

  const entryTotal = (e: { amount: number; qty: number }) => e.amount * e.qty;

  const add = () =>
    startTransition(async () => {
      await addBookingLedgerEntry({
        bookingId: booking.id,
        type,
        category,
        amount: Number(amount) || 0,
        qty: Number(qty) || 1,
        entryDate,
        note,
      });
      setAmount("");
      setQty("1");
      setCategory("");
      setNote("");
    });

  return (
    <Section title="ღონისძიების ხარჯები">
      <p className="mb-4 text-xs" style={{ color: "var(--text-3)" }}>
        აქ დამატებული ჩანაწერი დღის რეესტრშიც აისახება თარიღის მიხედვით.
      </p>

      {booking.expenses.length > 0 && (
        <div className="table-wrap mb-4 -mx-1">
          <table className="table">
            <thead>
              <tr>
                <th>თარიღი</th>
                <th>კატეგორია</th>
                <th>თანხა</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {booking.expenses.map((e) => {
                const income = e.type === "income";
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-xs" style={{ color: "var(--text-2)" }}>
                      {fmtDateShort(e.entryDate)}
                    </td>
                    <td>
                      <div className="font-semibold">
                        {e.category ?? (income ? "შემოსავალი" : "ხარჯი")}
                      </div>
                      {(e.note || e.qty !== 1 || e.staffName) && (
                        <div className="text-xs" style={{ color: "var(--text-3)" }}>
                          {e.staffName ? `${e.staffName} · ` : ""}
                          {e.qty !== 1 ? `${e.qty} × ${gel(e.amount, 2)}` : ""}
                          {e.note ? ` ${e.note}` : ""}
                        </div>
                      )}
                    </td>
                    <td
                      className="whitespace-nowrap font-bold"
                      style={{ color: income ? "var(--green)" : "var(--red)" }}
                    >
                      {income ? "+" : "−"}
                      {gel(entryTotal(e))}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <button
                          className="btn btn-ghost !px-2 !py-1.5"
                          disabled={pending}
                          onClick={() =>
                            startTransition(() => deleteBookingLedgerEntry(e.id, booking.id))
                          }
                        >
                          <X size={14} />
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

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label">ტიპი</label>
          <select
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value as "expense" | "income")}
          >
            <option value="expense">ხარჯი</option>
            <option value="income">დამატ. შემოსავალი</option>
          </select>
        </div>
        <div>
          <label className="label">კატეგორია</label>
          <input
            className="input"
            list="expense-cats"
            placeholder="მაგ. პროდუქტი"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="expense-cats">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-2">
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
          <label className="label">თარიღი</label>
          <input type="date" className="input" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">შენიშვნა (არასავალდებულო)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <button
        className="btn btn-primary mt-3"
        disabled={pending || !(Number(amount) > 0)}
        onClick={add}
      >
        <Plus size={16} /> ჩანაწერის დამატება
      </button>
    </Section>
  );
}
