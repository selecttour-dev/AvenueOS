"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  Plus,
  ReceiptText,
  Trash2,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import {
  addPartnerDraw,
  createFixedCost,
  createOperationalExpense,
  createPartner,
  deleteFixedCost,
  deleteOperationalExpense,
  deletePartnerDraw,
  saveIncomeTaxPct,
  updateFixedCost,
  updateOperationalExpense,
  updatePartner,
} from "@/lib/actions";
import type {
  FixedCostRow,
  OperationalExpenseRow,
  PartnersData,
} from "@/lib/queries";
import { gel, fmtDateShort, todayISO } from "@/lib/format";
import { PageHeader, Section, EmptyState, StatCard } from "@/components/ui";
import { Percent } from "lucide-react";

export default function FinanceClient({
  fixedCosts,
  operational,
  incomeTaxPct,
  partnersData,
}: {
  fixedCosts: FixedCostRow[];
  operational: OperationalExpenseRow[];
  incomeTaxPct: number;
  partnersData: PartnersData;
}) {
  const [tab, setTab] = useState<"fixed" | "operational" | "partners">("fixed");
  const activeCosts = fixedCosts.filter((f) => f.active);
  const monthlyTotal = activeCosts.reduce((s, f) => s + f.monthlyAmount, 0);

  // Partner advances now live in the Partners tab; everything here is operational.
  const opCost = operational.reduce((s, o) => s + o.amount, 0);

  return (
    <>
      <PageHeader
        title="ფინანსები"
        subtitle="ფიქსირებული ხარჯები, საერთო ხარჯები და საშემოსავლო გადასახადი"
        action={<IncomeTaxControl incomeTaxPct={incomeTaxPct} />}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <TabButton active={tab === "fixed"} onClick={() => setTab("fixed")} label="ფიქსირებული ხარჯები" />
        <TabButton
          active={tab === "operational"}
          onClick={() => setTab("operational")}
          label={`საერთო ხარჯები (${operational.length})`}
        />
        <TabButton
          active={tab === "partners"}
          onClick={() => setTab("partners")}
          label={`პარტნიორები (${partnersData.partners.length})`}
        />
      </div>

      {tab === "partners" ? (
        <PartnersTab data={partnersData} />
      ) : tab === "fixed" ? (
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
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={TrendingDown}
              label="ოპერაციული ხარჯები"
              value={gel(opCost)}
              hint="საერთო მოგებიდან იქვითება"
              tone={opCost > 0 ? "red" : "default"}
            />
            <StatCard
              icon={ReceiptText}
              label="ჩანაწერების რაოდენობა"
              value={String(operational.length)}
              tone="default"
            />
          </div>
          <OperationalSection operational={operational} />
          <div
            className="mt-5 rounded-xl px-4 py-3 text-sm leading-relaxed"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            💡 <b>ოპერაციული / ერთჯერადი</b> ხარჯი (ჭურჭელი, ინვენტარი, ბუსტი,
            გაფორმება…) იქვითება საერთო მოგებიდან — ანუ ამცირებს პარტნიორებზე
            გასანაწილებელ თანხას. პარტნიორის მიერ წინასწარ აღებული ავანსი{" "}
            <b>„პარტნიორები"</b> ტაბშია.
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

function OperationalSection({
  operational,
}: {
  operational: OperationalExpenseRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", amount: "", category: "" });
  const opCost = operational.reduce((s, o) => s + o.amount, 0);

  return (
    <Section title="საერთო / ერთჯერადი ხარჯები">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  kind: "operational",
                  category: form.category,
                });
                setForm({ name: "", amount: "", category: "" });
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
          text="ჩაწერე ერთჯერადი/ოპერაციული ხარჯები — ჭურჭელი, ინვენტარი, ბუსტი, გაფორმება."
        />
      ) : (
        <div className="table-wrap -m-5">
          <table className="table">
            <thead>
              <tr>
                <th>დასახელება</th>
                <th className="text-right">თანხა</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {operational.map((o) => (
                <OpRow key={o.id} o={o} />
              ))}
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td className="font-bold">ჯამი</td>
                <td className="text-right font-extrabold">{gel(opCost)}</td>
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

  return (
    <tr>
      <td className="font-semibold">{o.name}</td>
      <td>
        <div className="flex items-center justify-end gap-1.5">
          <input
            type="number"
            className="input !w-28 !py-1.5 text-right"
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

// ---------------- Partners (profit split) ----------------

function PartnersTab({ data }: { data: PartnersData }) {
  const { partners, draws, totals } = data;
  const [pending, startTransition] = useTransition();
  const [drawForm, setDrawForm] = useState({
    partnerId: partners[0] ? String(partners[0].id) : "",
    drawDate: todayISO(),
    amount: "",
    note: "",
  });
  const [newPartner, setNewPartner] = useState({ name: "", pct: "" });

  return (
    <>
      {/* distributable profit breakdown */}
      <Section title="განაწილებადი მოგება" className="mb-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <Line label="შემოსავალი" value={gel(totals.income)} color="var(--green)" />
          <Line label="− ხარჯი/ხელფასი" value={gel(totals.costs)} color="var(--red)" />
          <Line label="− გადასახადი" value={gel(totals.tax)} color="var(--red)" />
          <Line label="− საერთო ხარჯები" value={gel(totals.operational)} color="var(--red)" />
          <Line
            label="= გასანაწილებელი"
            value={gel(totals.distributable)}
            color={totals.distributable >= 0 ? "var(--green)" : "var(--red)"}
            strong
          />
        </div>
      </Section>

      {/* partner cards */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        {partners.map((p) => (
          <PartnerCard key={p.id} p={p} />
        ))}
      </div>

      {/* add draw */}
      <Section title="თანხის გატანა (ავანსი/მოგების აღება)" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="label">პარტნიორი</label>
            <select
              className="select"
              value={drawForm.partnerId}
              onChange={(e) => setDrawForm({ ...drawForm, partnerId: e.target.value })}
            >
              {partners.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">თარიღი</label>
            <input
              type="date"
              className="input"
              value={drawForm.drawDate}
              onChange={(e) => setDrawForm({ ...drawForm, drawDate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">თანხა ₾</label>
            <input
              type="number"
              className="input"
              placeholder="0.00"
              value={drawForm.amount}
              onChange={(e) => setDrawForm({ ...drawForm, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">შენიშვნა</label>
            <input
              className="input"
              placeholder="მაგ. ავანსი"
              value={drawForm.note}
              onChange={(e) => setDrawForm({ ...drawForm, note: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button
              className="btn btn-primary w-full"
              disabled={pending || !drawForm.partnerId || !(Number(drawForm.amount) > 0)}
              onClick={() =>
                startTransition(async () => {
                  await addPartnerDraw({
                    partnerId: Number(drawForm.partnerId),
                    drawDate: drawForm.drawDate,
                    amount: Number(drawForm.amount) || 0,
                    note: drawForm.note,
                  });
                  setDrawForm({ ...drawForm, amount: "", note: "" });
                })
              }
            >
              <Plus size={16} /> გატანა
            </button>
          </div>
        </div>
      </Section>

      {/* draw history */}
      <Section title={`გატანების ისტორია (${draws.length})`} className="mb-5">
        {draws.length === 0 ? (
          <EmptyState
            icon={Users}
            title="გატანები არ არის"
            text="აქ დაფიქსირდება ყოველი თანხა, რომელსაც პარტნიორი იღებს — ავანსი თუ მოგების წილი."
          />
        ) : (
          <div className="table-wrap -m-5">
            <table className="table">
              <thead>
                <tr>
                  <th>თარიღი</th>
                  <th>პარტნიორი</th>
                  <th>შენიშვნა</th>
                  <th>თანხა</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap">{fmtDateShort(d.drawDate)}</td>
                    <td className="font-semibold">{d.partnerName}</td>
                    <td style={{ color: "var(--text-3)" }}>{d.note ?? "—"}</td>
                    <td className="font-bold">{gel(d.amount)}</td>
                    <td>
                      <div className="flex justify-end">
                        <button
                          className="btn btn-danger !px-2.5 !py-1.5"
                          disabled={pending}
                          onClick={() => {
                            if (confirm("წავშალო გატანა?"))
                              startTransition(() => deletePartnerDraw(d.id));
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* add partner */}
      <Section title="ახალი პარტნიორი">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <label className="label">სახელი</label>
            <input
              className="input"
              value={newPartner.name}
              onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">წილი %</label>
            <input
              type="number"
              className="input !w-24"
              placeholder="50"
              value={newPartner.pct}
              onChange={(e) => setNewPartner({ ...newPartner, pct: e.target.value })}
            />
          </div>
          <button
            className="btn btn-ghost"
            disabled={pending || !newPartner.name.trim()}
            onClick={() =>
              startTransition(async () => {
                await createPartner({
                  name: newPartner.name,
                  sharePct: Number(newPartner.pct) || 0,
                });
                setNewPartner({ name: "", pct: "" });
              })
            }
          >
            <Plus size={15} /> დამატება
          </button>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-3)" }}>
          წილების ჯამი:{" "}
          {partners.filter((p) => p.active).reduce((s, p) => s + p.sharePct, 0)}%
        </p>
      </Section>
    </>
  );
}

function Line({
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
    <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
      <div className="text-xs" style={{ color: "var(--text-3)" }}>{label}</div>
      <div
        className={`mt-1 font-extrabold ${strong ? "text-xl" : "text-lg"}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function PartnerCard({ p }: { p: PartnersData["partners"][number] }) {
  const [pending, startTransition] = useTransition();
  const [pct, setPct] = useState(String(p.sharePct));

  return (
    <div className="card p-5" style={p.active ? undefined : { opacity: 0.55 }}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-extrabold">{p.name}</div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className="input !w-20 !py-1"
            value={pct}
            disabled={pending}
            onChange={(e) => setPct(e.target.value)}
            onBlur={() => {
              const v = Number(pct);
              if (v >= 0 && v !== p.sharePct)
                startTransition(() => updatePartner(p.id, { sharePct: v }));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>%</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs" style={{ color: "var(--text-3)" }}>კუთვნილი</div>
          <div className="mt-0.5 font-bold">{gel(p.allocated)}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--text-3)" }}>გატანილი</div>
          <div className="mt-0.5 font-bold" style={{ color: "var(--red)" }}>{gel(p.drawn)}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--text-3)" }}>მისაღები</div>
          <div
            className="mt-0.5 text-lg font-extrabold"
            style={{ color: p.balance >= 0 ? "var(--green)" : "var(--red)" }}
          >
            {gel(p.balance)}
          </div>
        </div>
      </div>

      {p.balance < 0 && (
        <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
          ავანსით მეტი აქვს აღებული — სხვაობა მომავალი მოგებიდან გაიქვითება.
        </p>
      )}
    </div>
  );
}
