"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarClock,
  Check,
  Landmark,
  Pencil,
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
          placeholder="მაგ. კარები, მაცივარი"
          totalLabel="სულ გახარჯული"
          withCategory
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

const SETUP_CATEGORIES = [
  "გარემონტება",
  "ავეჯი",
  "მუშები",
  "დეკორი",
  "ტექნიკა",
  "ელექტრობა",
  "სამზარეულო",
  "სანტექნიკა",
  "ინვენტარი",
  "იჯარა",
  "სესხი",
  "სხვა",
];

function ItemSection({
  kind,
  title,
  icon: Icon,
  items,
  total,
  placeholder,
  totalLabel,
  withCategory = false,
}: {
  kind: "funding" | "expense";
  title: string;
  icon: typeof Landmark;
  items: SetupItem[];
  total: number;
  placeholder: string;
  totalLabel: string;
  withCategory?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", amount: "", date: todayISO(), category: SETUP_CATEGORIES[0] });

  // Group by category (expenses only), preserving the category order above.
  const groups = new Map<string, SetupItem[]>();
  for (const it of items) {
    const cat = withCategory ? it.category || "სხვა" : "";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(it);
  }
  const orderedCats = withCategory
    ? [...groups.keys()].sort(
        (a, b) => (SETUP_CATEGORIES.indexOf(a) + 1 || 99) - (SETUP_CATEGORIES.indexOf(b) + 1 || 99),
      )
    : [""];

  return (
    <Section title={title} action={<Icon size={18} style={{ color: "var(--text-3)" }} />}>
      {withCategory && items.length > 0 && (
        <CategoryBreakdown groups={groups} orderedCats={orderedCats} total={total} />
      )}

      {items.length === 0 ? (
        <EmptyState icon={Icon} title="ცარიელია" text={`დაამატე პირველი ჩანაწერი (${placeholder}).`} />
      ) : (
        <div className="table-wrap -mx-1">
          <table className="table">
            <tbody>
              {orderedCats.map((cat) => {
                const rows = groups.get(cat) ?? [];
                const sub = rows.reduce((s, r) => s + r.amount, 0);
                return (
                  <Fragment key={cat || "all"}>
                    {withCategory && (
                      <tr style={{ background: "var(--surface-2)" }}>
                        <td className="font-bold" colSpan={2}>{cat}</td>
                        <td className="text-right font-bold">{gel(sub)}</td>
                        <td></td>
                      </tr>
                    )}
                    {rows.map((it) => (
                      <SetupRow key={it.id} it={it} withCategory={withCategory} pending={pending} startTransition={startTransition} />
                    ))}
                  </Fragment>
                );
              })}
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
        <div className="min-w-32 flex-1">
          <label className="label">დასახელება</label>
          <input className="input" placeholder={placeholder} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        {withCategory && (
          <div>
            <label className="label">კატეგორია</label>
            <select className="select !w-36" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {SETUP_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
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
              await addSetupItem({
                kind,
                name: form.name,
                amount: Number(form.amount) || 0,
                itemDate: form.date,
                category: withCategory ? form.category : undefined,
              });
              setForm({ ...form, name: "", amount: "" });
            })
          }
        >
          <Plus size={15} /> დამატება
        </button>
      </div>
    </Section>
  );
}

function CategoryBreakdown({
  groups,
  orderedCats,
  total,
}: {
  groups: Map<string, SetupItem[]>;
  orderedCats: string[];
  total: number;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      {orderedCats.map((cat) => {
        const sub = (groups.get(cat) ?? []).reduce((s, r) => s + r.amount, 0);
        const pct = total > 0 ? (sub / total) * 100 : 0;
        return (
          <div key={cat} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-semibold" style={{ color: "var(--text-2)" }}>{cat}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--red)" }} />
            </div>
            <span className="w-20 shrink-0 text-right text-xs font-bold">{gel(sub)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SetupRow({
  it,
  withCategory,
  pending,
  startTransition,
}: {
  it: SetupItem;
  withCategory: boolean;
  pending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    name: it.name,
    amount: String(it.amount),
    category: it.category || "სხვა",
    date: it.itemDate || "",
    note: it.note || "",
  });

  const save = () =>
    startTransition(async () => {
      await updateSetupItem(it.id, {
        name: f.name,
        amount: Number(f.amount) || 0,
        category: withCategory ? f.category : undefined,
        itemDate: f.date,
        note: f.note,
      });
      setEditing(false);
    });

  if (!editing) {
    return (
      <tr className="group">
        <td>
          <div className="font-semibold">{it.name}</div>
          {it.note && (
            <div className="text-xs" style={{ color: "var(--text-3)" }}>{it.note}</div>
          )}
        </td>
        <td className="whitespace-nowrap text-xs" style={{ color: "var(--text-3)" }}>
          {it.itemDate ? fmtDateShort(it.itemDate) : ""}
        </td>
        <td className="text-right font-bold whitespace-nowrap">{gel(it.amount)}</td>
        <td>
          <div className="flex justify-end">
            <button
              className="btn btn-ghost !px-2 !py-1.5 opacity-40 transition-opacity group-hover:opacity-100"
              disabled={pending}
              onClick={() => setEditing(true)}
              title="რედაქტირება"
            >
              <Pencil size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ background: "var(--surface-2)" }}>
      <td colSpan={4}>
        <div className="grid gap-2 py-1 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">დასახელება</label>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          {withCategory && (
            <div>
              <label className="label">კატეგორია</label>
              <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {SETUP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">თარიღი</label>
            <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
          <div>
            <label className="label">თანხა ₾</label>
            <input type="number" className="input" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="label">შენიშვნა / მიმწოდებელი</label>
            <input className="input" placeholder="მაგ. ვისგან, ინვოისი, დეტალი" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 pb-1">
          <button className="btn btn-primary !py-1.5 !text-sm" disabled={pending || !f.name.trim()} onClick={save}>
            <Check size={14} /> შენახვა
          </button>
          <button className="btn btn-ghost !py-1.5 !text-sm" disabled={pending} onClick={() => setEditing(false)}>
            გაუქმება
          </button>
          <button
            className="btn btn-danger !py-1.5 !text-sm"
            disabled={pending}
            onClick={() => {
              if (confirm(`ნამდვილად წავშალო „${it.name}" (${gel(it.amount)})?`))
                startTransition(() => deleteSetupItem(it.id));
            }}
          >
            <Trash2 size={14} /> წაშლა
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
