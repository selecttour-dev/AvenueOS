"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Plus, ReceiptText, Trash2, Wallet } from "lucide-react";
import {
  createFixedCost,
  deleteFixedCost,
  updateFixedCost,
} from "@/lib/actions";
import type { FixedCostRow } from "@/lib/queries";
import { gel } from "@/lib/format";
import { PageHeader, Section, EmptyState, StatCard } from "@/components/ui";

export default function FinanceClient({
  fixedCosts,
}: {
  fixedCosts: FixedCostRow[];
}) {
  const activeCosts = fixedCosts.filter((f) => f.active);
  const monthlyTotal = activeCosts.reduce((s, f) => s + f.monthlyAmount, 0);

  return (
    <>
      <PageHeader
        title="ფინანსები"
        subtitle="ფიქსირებული ხარჯები — თვის მუდმივი ვალდებულებები ამ ობიექტზე"
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={ReceiptText}
          label="აქტიური ხარჯები"
          value={String(activeCosts.length)}
          tone="primary"
        />
        <StatCard
          icon={Wallet}
          label="ჯამი / თვე"
          value={gel(monthlyTotal)}
          tone={monthlyTotal > 0 ? "red" : "default"}
        />
        <StatCard
          icon={CalendarDays}
          label="დღეში"
          value={gel(monthlyTotal / 30)}
          hint={"ამდენს „წვავს“ ობიექტი უქმე დღესაც"}
          tone="gold"
        />
      </div>

      <FixedCostsSection fixedCosts={fixedCosts} monthlyTotal={monthlyTotal} />

      <div
        className="mt-5 rounded-xl px-4 py-3 text-sm leading-relaxed"
        style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
      >
        💡 ეს ხარჯები კერძების კალკულაციაში <b>არ</b> ერევა — კერძი მხოლოდ
        პროდუქტის ღირებულებას ითვლის. ფიქსირებულ ხარჯებს პროგნოზების მოდული
        გამოიყენებს: break-even (თვეში რამდენი ივენთი/გაყიდვაა საჭირო ნულზე
        გასასვლელად) და რეალური მოგება P&L-ში.
      </div>
    </>
  );
}

function FixedCostsSection({
  fixedCosts,
  monthlyTotal,
}: {
  fixedCosts: FixedCostRow[];
  monthlyTotal: number;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", amount: "" });

  return (
    <Section
      title="ფიქსირებული ხარჯები"
      action={
        <span className="text-sm font-bold" style={{ color: "var(--red)" }}>
          {gel(monthlyTotal)} / თვე
        </span>
      }
    >
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label">დასახელება</label>
          <input
            className="input"
            placeholder="მაგ. იჯარა"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && form.name.trim())
                startTransition(async () => {
                  await createFixedCost({
                    name: form.name,
                    monthlyAmount: Number(form.amount) || 0,
                  });
                  setForm({ name: "", amount: "" });
                });
            }}
          />
        </div>
        <div>
          <label className="label">თანხა / თვე ₾</label>
          <input
            type="number"
            className="input !w-36"
            placeholder="5000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <button
          className="btn btn-primary"
          disabled={pending || !form.name.trim()}
          onClick={() =>
            startTransition(async () => {
              await createFixedCost({
                name: form.name,
                monthlyAmount: Number(form.amount) || 0,
              });
              setForm({ name: "", amount: "" });
            })
          }
        >
          <Plus size={16} /> დამატება
        </button>
      </div>

      {fixedCosts.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="ფიქსირებული ხარჯები არ არის"
          text="ჩაწერე თვის მუდმივი ხარჯები — იჯარა, კომუნალური, დაცვა, ინტერნეტი, ბუღალტერია…"
        />
      ) : (
        <div className="table-wrap -mx-5 -mb-5">
          <table className="table">
            <thead>
              <tr>
                <th>დასახელება</th>
                <th>თანხა / თვე</th>
                <th>წილი</th>
                <th>სტატუსი</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fixedCosts.map((fc) => (
                <FixedCostRowView
                  key={fc.id}
                  fc={fc}
                  share={
                    monthlyTotal > 0 && fc.active
                      ? (fc.monthlyAmount / monthlyTotal) * 100
                      : 0
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function FixedCostRowView({ fc, share }: { fc: FixedCostRow; share: number }) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(fc.monthlyAmount));

  const saveAmount = () => {
    const v = Number(amount);
    if (!Number.isNaN(v) && v !== fc.monthlyAmount)
      startTransition(() => updateFixedCost(fc.id, { monthlyAmount: v }));
  };

  return (
    <tr style={fc.active ? undefined : { opacity: 0.5 }}>
      <td className="font-semibold">{fc.name}</td>
      <td>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className="input !w-28 !py-1.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={saveAmount}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>₾</span>
        </div>
      </td>
      <td>
        {fc.active && share > 0 ? (
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 w-20 overflow-hidden rounded-full"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(share, 100)}%`, background: "var(--red)" }}
              />
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
              {share.toFixed(0)}%
            </span>
          </div>
        ) : (
          "—"
        )}
      </td>
      <td>
        <button
          className="badge cursor-pointer"
          style={
            fc.active
              ? { background: "var(--green-soft)", color: "var(--green)" }
              : { background: "var(--surface-2)", color: "var(--text-3)" }
          }
          disabled={pending}
          onClick={() =>
            startTransition(() => updateFixedCost(fc.id, { active: !fc.active }))
          }
        >
          {fc.active ? "აქტიური" : "გათიშული"}
        </button>
      </td>
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            disabled={pending}
            onClick={() => {
              if (confirm(`წავშალო „${fc.name}"?`))
                startTransition(() => deleteFixedCost(fc.id));
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}
