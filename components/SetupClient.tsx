"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarClock,
  Landmark,
  Plus,
  Receipt,
  Rocket,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  addSetupItem,
  deleteSetupItem,
  saveExpectedMonthlyProfit,
  updateSetupItem,
} from "@/lib/actions";
import type { SetupBudget, SetupItem } from "@/lib/queries";
import { gel, fmtDateShort, todayISO } from "@/lib/format";
import { PageHeader, Section, StatCard, EmptyState } from "@/components/ui";

export default function SetupClient({
  venueName,
  budget,
}: {
  venueName: string;
  budget: SetupBudget;
}) {
  const { funding, expenses, totalFunding, totalSpent, balance, expectedMonthlyProfit, monthsToBreakEven } = budget;

  const breakEvenDate =
    monthsToBreakEven != null && monthsToBreakEven > 0
      ? (() => {
          const d = new Date();
          d.setMonth(d.getMonth() + Math.ceil(monthsToBreakEven));
          return d;
        })()
      : null;

  return (
    <>
      <PageHeader
        title="ახალი ობიექტის გახსნა"
        subtitle={`${venueName} — დაფინანსება, გახსნის ხარჯები და მოგებაზე გასვლა`}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} label="სულ დაფინანსება" value={gel(totalFunding)} tone="primary" />
        <StatCard icon={Receipt} label="გახარჯული" value={gel(totalSpent)} tone="red" />
        <StatCard
          icon={Wallet}
          label="ნაშთი (დასახარჯი)"
          value={gel(balance)}
          tone={balance >= 0 ? "green" : "red"}
        />
        <StatCard
          icon={Rocket}
          label="მოგებაზე გასვლა"
          value={monthsToBreakEven != null ? `${Math.ceil(monthsToBreakEven)} თვე` : "—"}
          hint={breakEvenDate ? `~${breakEvenDate.toLocaleDateString("ka-GE", { month: "long", year: "numeric" })}` : "დააყენე მოგება ქვემოთ"}
          tone="gold"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ItemSection
          kind="funding"
          title="დაფინანსება (საიდან მოდის ფული)"
          icon={Landmark}
          items={funding}
          total={totalFunding}
          placeholder="მაგ. სესხი, ფონდი, საკუთარი"
          totalLabel="სულ დაფინანსება"
        />
        <ItemSection
          kind="expense"
          title="გახსნის ხარჯები (რაში იხარჯება)"
          icon={Receipt}
          items={expenses}
          total={totalSpent}
          placeholder="მაგ. დეკორი, სამზარეულო, იჯარა"
          totalLabel="სულ გახარჯული"
        />
      </div>

      <BreakEvenSection
        totalSpent={totalSpent}
        expectedMonthlyProfit={expectedMonthlyProfit}
        monthsToBreakEven={monthsToBreakEven}
      />
    </>
  );
}

function ItemSection({
  kind,
  title,
  icon: Icon,
  items,
  total,
  placeholder,
  totalLabel,
}: {
  kind: "funding" | "expense";
  title: string;
  icon: typeof Landmark;
  items: SetupItem[];
  total: number;
  placeholder: string;
  totalLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", amount: "", date: todayISO() });

  return (
    <Section title={title} action={<Icon size={18} style={{ color: "var(--text-3)" }} />}>
      {items.length === 0 ? (
        <EmptyState icon={Icon} title="ცარიელია" text={`დაამატე პირველი ჩანაწერი (${placeholder}).`} />
      ) : (
        <div className="table-wrap -mx-1">
          <table className="table">
            <tbody>
              {items.map((it) => (
                <SetupRow key={it.id} it={it} pending={pending} startTransition={startTransition} />
              ))}
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td className="font-bold">{totalLabel}</td>
                <td></td>
                <td className="text-right text-lg font-extrabold">{gel(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-36 flex-1">
          <label className="label">დასახელება</label>
          <input className="input" placeholder={placeholder} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">თარიღი</label>
          <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <label className="label">თანხა ₾</label>
          <input type="number" className="input !w-28" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <button
          className="btn btn-primary"
          disabled={pending || !form.name.trim()}
          onClick={() =>
            startTransition(async () => {
              await addSetupItem({ kind, name: form.name, amount: Number(form.amount) || 0, itemDate: form.date });
              setForm({ name: "", amount: "", date: form.date });
            })
          }
        >
          <Plus size={15} /> დამატება
        </button>
      </div>
    </Section>
  );
}

function SetupRow({
  it,
  pending,
  startTransition,
}: {
  it: SetupItem;
  pending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const [amount, setAmount] = useState(String(it.amount));
  const [name, setName] = useState(it.name);

  return (
    <tr>
      <td>
        <input
          className="input !border-transparent !bg-transparent !px-1 !py-1 font-semibold hover:!border-[var(--border)] focus:!border-[var(--border)]"
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== it.name && startTransition(() => updateSetupItem(it.id, { name }))}
        />
      </td>
      <td className="whitespace-nowrap text-xs" style={{ color: "var(--text-3)" }}>
        {it.itemDate ? fmtDateShort(it.itemDate) : ""}
      </td>
      <td className="text-right">
        <input
          type="number"
          className="input !w-28 !py-1.5 text-right"
          value={amount}
          disabled={pending}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const v = Number(amount);
            if (v >= 0 && v !== it.amount) startTransition(() => updateSetupItem(it.id, { amount: v }));
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </td>
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-danger !px-2 !py-1.5"
            disabled={pending}
            onClick={() => {
              if (confirm(`წავშალო „${it.name}"?`)) startTransition(() => deleteSetupItem(it.id));
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function BreakEvenSection({
  totalSpent,
  expectedMonthlyProfit,
  monthsToBreakEven,
}: {
  totalSpent: number;
  expectedMonthlyProfit: number;
  monthsToBreakEven: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [val, setVal] = useState(String(expectedMonthlyProfit));

  return (
    <Section
      title="მოგებაზე გასვლა (break-even)"
      className="mt-5"
      action={<CalendarClock size={18} style={{ color: "var(--text-3)" }} />}
    >
      <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        როცა ობიექტი ამუშავდება, ჩაწერე მოსალოდნელი <b>თვიური სუფთა მოგება</b> — და
        დაინახავ, რამდენ თვეში დაიფარება გახსნის ინვესტიცია.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-xs" style={{ color: "var(--text-3)" }}>ინვესტიცია (გახარჯული)</div>
          <div className="mt-1 text-xl font-extrabold">{gel(totalSpent)}</div>
        </div>
        <div>
          <label className="label">მოსალოდნელი მოგება / თვე ₾</label>
          <input
            type="number"
            className="input"
            placeholder="მაგ. 8000"
            value={val}
            disabled={pending}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => {
              const v = Number(val);
              if (v >= 0 && v !== expectedMonthlyProfit) startTransition(() => saveExpectedMonthlyProfit(v));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--primary-soft)" }}>
          <div className="text-xs" style={{ color: "var(--primary-strong)" }}>დაფარვის ვადა</div>
          <div className="mt-1 text-xl font-extrabold" style={{ color: "var(--primary-strong)" }}>
            {monthsToBreakEven != null ? `${Math.ceil(monthsToBreakEven)} თვე` : "—"}
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
        💡 თვიური ფიქსირებული ხარჯები (იჯარა, კომუნალური, ხელფასები) ცალკე{" "}
        <Link href="/finance" className="underline" style={{ color: "var(--primary)" }}>ფინანსებში</Link>{" "}
        ჩაწერე — მოსალოდნელი მოგება = შემოსავალი − ფიქსირებული ხარჯები.
      </p>
    </Section>
  );
}
