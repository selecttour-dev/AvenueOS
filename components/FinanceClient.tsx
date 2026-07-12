"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  HandCoins,
  Plus,
  ReceiptText,
  Trash2,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import {
  createFixedCost,
  createOperationalExpense,
  deleteFixedCost,
  deleteOperationalExpense,
  saveIncomeTaxPct,
  updateFixedCost,
  updateOperationalExpense,
} from "@/lib/actions";
import type { FixedCostRow, OperationalExpenseRow } from "@/lib/queries";
import { gel } from "@/lib/format";
import { PageHeader, Section, EmptyState, StatCard } from "@/components/ui";
import { Percent } from "lucide-react";

export default function FinanceClient({
  fixedCosts,
  operational,
  incomeTaxPct,
}: {
  fixedCosts: FixedCostRow[];
  operational: OperationalExpenseRow[];
  incomeTaxPct: number;
}) {
  const [tab, setTab] = useState<"fixed" | "operational">("fixed");
  const activeCosts = fixedCosts.filter((f) => f.active);
  const monthlyTotal = activeCosts.reduce((s, f) => s + f.monthlyAmount, 0);

  const opCost = operational
    .filter((o) => o.kind !== "partner_advance")
    .reduce((s, o) => s + o.amount, 0);
  const partnerAdvance = operational
    .filter((o) => o.kind === "partner_advance")
    .reduce((s, o) => s + o.amount, 0);

  return (
    <>
      <PageHeader
        title="ფინანსები"
        subtitle="ფიქსირებული ხარჯები, საერთო ხარჯები და საშემოსავლო გადასახადი"
        action={<IncomeTaxControl incomeTaxPct={incomeTaxPct} />}
      />

      <div className="mb-5 flex gap-2">
        <TabButton active={tab === "fixed"} onClick={() => setTab("fixed")} label="ფიქსირებული ხარჯები" />
        <TabButton
          active={tab === "operational"}
          onClick={() => setTab("operational")}
          label={`საერთო ხარჯები (${operational.length})`}
        />
      </div>

      {tab === "fixed" ? (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <StatCard icon={ReceiptText} label="აქტიური ხარჯები" value={String(activeCosts.length)} tone="primary" />
            <StatCard icon={Wallet} label="ჯამი / თვე" value={gel(monthlyTotal)} tone={monthlyTotal > 0 ? "red" : "default"} />
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
            💡 ფიქსირებული ხარჯები (იჯარა, კომუნალური…) კერძების კალკულაციაში{" "}
            <b>არ</b> ერევა. პროგნოზების მოდული მათ იყენებს break-even-ისთვის.
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={TrendingDown}
              label="ოპერაციული (მოგებიდან)"
              value={gel(opCost)}
              hint="მოგებიდან იქვითება"
              tone="red"
            />
            <StatCard
              icon={Users}
              label="პარტნიორის ავანსი"
              value={gel(partnerAdvance)}
              hint="მომავალი მოგებიდან ამოსაღები"
              tone="gold"
            />
            <StatCard
              icon={HandCoins}
              label="სულ ავანსებიდან"
              value={gel(opCost + partnerAdvance)}
              tone="default"
            />
          </div>
          <OperationalSection operational={operational} opCost={opCost} partnerAdvance={partnerAdvance} />
          <div
            className="mt-5 rounded-xl px-4 py-3 text-sm leading-relaxed"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            💡 <b>ოპერაციული</b> ხარჯი (ჭურჭელი, ინვენტარი, ბუსტი…) იქვითება
            საერთო მოგებიდან. <b>პარტნიორის ავანსი</b> — რაც პარტნიორმა წინასწარ
            აიღო ავანსებიდან — მოგების განაწილებაა და მომავალი ღონისძიებების
            მოგებიდან ამოიღება (ხარჯად არ ითვლება).
          </div>
        </>
      )}
    </>
  );
}

function IncomeTaxControl({ incomeTaxPct }: { incomeTaxPct: number }) {
  const [pending, startTransition] = useTransition();
  const [val, setVal] = useState(String(incomeTaxPct));
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-1.5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      title="საშემოსავლო/ბრუნვის გადასახადი — % შემოსავალზე"
    >
      <Percent size={14} style={{ color: "var(--text-3)" }} />
      <span className="text-xs" style={{ color: "var(--text-2)" }}>
        საშემოსავლო
      </span>
      <input
        type="number"
        className="input !w-16 !py-1 !text-sm"
        value={val}
        disabled={pending}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const v = Number(val);
          if (v >= 0 && v !== incomeTaxPct)
            startTransition(() => saveIncomeTaxPct(v));
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className="text-xs" style={{ color: "var(--text-3)" }}>%</span>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className="btn"
      style={
        active
          ? { background: "var(--text)", color: "var(--surface)" }
          : { background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ---------------- Operational / common expenses ----------------

const KIND_LABELS: Record<string, string> = {
  operational: "ოპერაციული",
  partner_advance: "პარტნიორის ავანსი",
};

function OperationalSection({
  operational,
  opCost,
  partnerAdvance,
}: {
  operational: OperationalExpenseRow[];
  opCost: number;
  partnerAdvance: number;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", amount: "", kind: "operational", category: "" });

  return (
    <Section title="საერთო / ერთჯერადი ხარჯები">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="label">დასახელება</label>
          <input
            className="input"
            placeholder="მაგ. ჭურჭელი / ბუსტი"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">ტიპი</label>
          <select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="operational">ოპერაციული</option>
            <option value="partner_advance">პარტნიორის ავანსი</option>
          </select>
        </div>
        <div>
          <label className="label">თანხა ₾</label>
          <input
            type="number"
            className="input"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <button
            className="btn btn-primary w-full"
            disabled={pending || !form.name.trim()}
            onClick={() =>
              startTransition(async () => {
                await createOperationalExpense({
                  name: form.name,
                  amount: Number(form.amount) || 0,
                  kind: form.kind,
                  category: form.category,
                });
                setForm({ name: "", amount: "", kind: form.kind, category: "" });
              })
            }
          >
            <Plus size={16} /> დამატება
          </button>
        </div>
      </div>

      {operational.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="საერთო ხარჯები არ არის"
          text="ჩაწერე ერთჯერადი/ოპერაციული ხარჯები (ჭურჭელი, ინვენტარი, ბუსტი) და პარტნიორის ავანსით აღებული თანხები."
        />
      ) : (
        <div className="table-wrap -m-5">
          <table className="table">
            <thead>
              <tr>
                <th>დასახელება</th>
                <th>ტიპი</th>
                <th>თანხა</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {operational.map((o) => (
                <OpRow key={o.id} o={o} />
              ))}
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td colSpan={2} className="font-bold">
                  ჯამი: ოპერაციული {gel(opCost)} · ავანსი {gel(partnerAdvance)}
                </td>
                <td className="font-extrabold">{gel(opCost + partnerAdvance)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function OpRow({ o }: { o: OperationalExpenseRow }) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(o.amount));
  const partner = o.kind === "partner_advance";

  return (
    <tr>
      <td className="font-semibold">{o.name}</td>
      <td>
        <button
          className="badge cursor-pointer"
          style={
            partner
              ? { background: "var(--gold-soft)", color: "var(--gold)" }
              : { background: "var(--red-soft)", color: "var(--red)" }
          }
          disabled={pending}
          title="ტიპის შეცვლა"
          onClick={() =>
            startTransition(() =>
              updateOperationalExpense(o.id, {
                kind: partner ? "operational" : "partner_advance",
              }),
            )
          }
        >
          {KIND_LABELS[o.kind] ?? o.kind}
        </button>
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className="input !w-28 !py-1.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => {
              const v = Number(amount);
              if (!Number.isNaN(v) && v !== o.amount)
                startTransition(() => updateOperationalExpense(o.id, { amount: v }));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>₾</span>
        </div>
      </td>
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            disabled={pending}
            onClick={() => {
              if (confirm(`წავშალო „${o.name}"?`))
                startTransition(() => deleteOperationalExpense(o.id));
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
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
