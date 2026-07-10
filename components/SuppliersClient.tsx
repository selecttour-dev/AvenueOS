"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  Plus,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import {
  createPurchase,
  createSupplier,
  deletePurchase,
  deleteSupplier,
  settlePurchase,
  updatePurchase,
  updateSupplier,
} from "@/lib/actions";
import type { SupplierRow, PurchaseRow } from "@/lib/queries";
import { gel, fmtDateShort, todayISO } from "@/lib/format";
import { PageHeader, Section, StatCard, EmptyState } from "@/components/ui";

const PURCHASE_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  paid: { label: "გადახდილი", bg: "var(--green-soft)", fg: "var(--green)" },
  partial: { label: "ნაწილობრივი", bg: "var(--amber-soft)", fg: "var(--amber)" },
  unpaid: { label: "გადაუხდელი", bg: "var(--red-soft)", fg: "var(--red)" },
};

export default function SuppliersClient({
  suppliers,
  purchases,
}: {
  suppliers: SupplierRow[];
  purchases: PurchaseRow[];
}) {
  const [tab, setTab] = useState<"suppliers" | "purchases">("suppliers");

  const totalDebt = suppliers.reduce((s, x) => s + Math.max(x.debt, 0), 0);
  const totalPurchased = suppliers.reduce((s, x) => s + x.totalPurchased, 0);
  const withDebt = suppliers.filter((s) => s.debt > 0.01).length;

  return (
    <>
      <PageHeader
        title="მომწოდებლები"
        subtitle="მომწოდებლების ბაზა, შესყიდვები და ვალების კონტროლი"
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Truck} label="მომწოდებლები" value={String(suppliers.length)} tone="primary" />
        <StatCard icon={CircleDollarSign} label="სულ ნაყიდი" value={gel(totalPurchased)} tone="gold" />
        <StatCard
          icon={Wallet}
          label="ვალი"
          value={gel(totalDebt)}
          hint={withDebt > 0 ? `${withDebt} მომწოდებელს` : "ვალი არ არის"}
          tone={totalDebt > 0 ? "red" : "green"}
        />
      </div>

      <div className="mb-5 flex gap-2">
        <TabButton active={tab === "suppliers"} onClick={() => setTab("suppliers")} label={`მომწოდებლები (${suppliers.length})`} />
        <TabButton active={tab === "purchases"} onClick={() => setTab("purchases")} label={`შესყიდვები (${purchases.length})`} />
      </div>

      {tab === "suppliers" ? (
        <SuppliersTab suppliers={suppliers} />
      ) : (
        <PurchasesTab suppliers={suppliers} purchases={purchases} />
      )}
    </>
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

// ---------------- Suppliers ----------------

function SuppliersTab({ suppliers }: { suppliers: SupplierRow[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", category: "", contactPerson: "", phone: "" });

  const categories = useMemo(
    () => [...new Set(suppliers.map((s) => s.category).filter(Boolean))] as string[],
    [suppliers],
  );

  return (
    <>
      <Section title="ახალი მომწოდებელი" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="label">დასახელება</label>
            <input className="input" placeholder="მაგ. ნიკორა" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">კატეგორია</label>
            <input className="input" list="sup-cats" placeholder="მაგ. პროდუქტი" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <datalist id="sup-cats">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="label">კონტაქტი</label>
            <input className="input" placeholder="სახელი" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">ტელეფონი</label>
              <input className="input" placeholder="5xx…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <button
              className="btn btn-primary"
              disabled={pending || !form.name.trim()}
              onClick={() =>
                startTransition(async () => {
                  await createSupplier(form);
                  setForm({ name: "", category: form.category, contactPerson: "", phone: "" });
                })
              }
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </Section>

      <Section>
        {suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="მომწოდებლები არ არის"
            text="დაამატე მომწოდებლები კატეგორიებით — მერე შესყიდვებს მიაბამ და ვალებს გააკონტროლებ."
          />
        ) : (
          <div className="table-wrap -m-5">
            <table className="table">
              <thead>
                <tr>
                  <th>დასახელება</th>
                  <th>კატეგორია</th>
                  <th>კონტაქტი</th>
                  <th>ნაყიდი</th>
                  <th>გადახდილი</th>
                  <th>ვალი</th>
                  <th>სტატუსი</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <SupplierRowView key={s.id} s={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function SupplierRowView({ s }: { s: SupplierRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <tr style={s.active ? undefined : { opacity: 0.5 }}>
      <td className="font-semibold">{s.name}</td>
      <td style={{ color: "var(--text-2)" }}>{s.category ?? "—"}</td>
      <td style={{ color: "var(--text-2)" }}>
        {s.contactPerson || s.phone ? (
          <div>
            {s.contactPerson && <div className="text-sm">{s.contactPerson}</div>}
            {s.phone && <div className="text-xs" style={{ color: "var(--text-3)" }}>{s.phone}</div>}
          </div>
        ) : (
          "—"
        )}
      </td>
      <td>{gel(s.totalPurchased)}</td>
      <td style={{ color: "var(--green)" }}>{gel(s.totalPaid)}</td>
      <td className="font-bold" style={{ color: s.debt > 0.01 ? "var(--red)" : "var(--text-3)" }}>
        {s.debt > 0.01 ? gel(s.debt) : "—"}
      </td>
      <td>
        <button
          className="badge cursor-pointer"
          style={s.active ? { background: "var(--green-soft)", color: "var(--green)" } : { background: "var(--surface-2)", color: "var(--text-3)" }}
          disabled={pending}
          onClick={() => startTransition(() => updateSupplier(s.id, { active: !s.active }))}
        >
          {s.active ? "აქტიური" : "გათიშული"}
        </button>
      </td>
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            disabled={pending || s.purchaseCount > 0}
            title={s.purchaseCount > 0 ? "ჯერ შესყიდვები წაშალე" : "წაშლა"}
            onClick={() => {
              if (confirm(`წავშალო „${s.name}"?`)) startTransition(() => deleteSupplier(s.id));
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------- Purchases ----------------

function PurchasesTab({ suppliers, purchases }: { suppliers: SupplierRow[]; purchases: PurchaseRow[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    supplierId: "",
    purchaseDate: todayISO(),
    total: "",
    paid: "",
    note: "",
  });

  return (
    <>
      <Section title="ახალი შესყიდვა" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="label">მომწოდებელი</label>
            <select className="select" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">— აირჩიე —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">თარიღი</label>
            <input type="date" className="input" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          </div>
          <div>
            <label className="label">ჯამი ₾</label>
            <input type="number" className="input" placeholder="0.00" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
          </div>
          <div>
            <label className="label">გადახდილი ₾</label>
            <input type="number" className="input" placeholder="0.00" value={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button
              className="btn btn-primary w-full"
              disabled={pending || !(Number(form.total) > 0)}
              onClick={() =>
                startTransition(async () => {
                  await createPurchase({
                    supplierId: form.supplierId ? Number(form.supplierId) : null,
                    purchaseDate: form.purchaseDate,
                    total: Number(form.total) || 0,
                    paid: Number(form.paid) || 0,
                    note: form.note,
                  });
                  setForm({ ...form, total: "", paid: "", note: "" });
                })
              }
            >
              <Plus size={16} /> დამატება
            </button>
          </div>
        </div>
      </Section>

      <Section>
        {purchases.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="შესყიდვები არ არის"
            text="დაამატე შესყიდვა — ჯამი და გადახდილი; სისტემა თავად დაითვლის ვალს და სტატუსს."
          />
        ) : (
          <div className="table-wrap -m-5">
            <table className="table">
              <thead>
                <tr>
                  <th>თარიღი</th>
                  <th>მომწოდებელი</th>
                  <th>ჯამი</th>
                  <th>გადახდილი</th>
                  <th>ვალი</th>
                  <th>სტატუსი</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <PurchaseRowView key={p.id} p={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function PurchaseRowView({ p }: { p: PurchaseRow }) {
  const [pending, startTransition] = useTransition();
  const [paid, setPaid] = useState(String(p.paid));
  const debt = Math.max(p.total - p.paid, 0);
  const meta = PURCHASE_STATUS[p.status] ?? PURCHASE_STATUS.unpaid;

  return (
    <tr>
      <td className="whitespace-nowrap font-semibold">{fmtDateShort(p.purchaseDate)}</td>
      <td>{p.supplierName ?? "—"}{p.note && <div className="text-xs" style={{ color: "var(--text-3)" }}>{p.note}</div>}</td>
      <td className="font-semibold">{gel(p.total)}</td>
      <td>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className="input !w-24 !py-1.5"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            onBlur={() => {
              const v = Number(paid);
              if (!Number.isNaN(v) && v !== p.paid) startTransition(() => updatePurchase(p.id, { paid: v }));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>₾</span>
        </div>
      </td>
      <td className="font-bold" style={{ color: debt > 0.01 ? "var(--red)" : "var(--text-3)" }}>
        {debt > 0.01 ? gel(debt) : "—"}
      </td>
      <td>
        <span className="badge" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
      </td>
      <td>
        <div className="flex items-center justify-end gap-1">
          {debt > 0.01 && (
            <button
              className="btn btn-ghost !px-2.5 !py-1.5"
              title="სრულად გადახდა"
              disabled={pending}
              onClick={() => startTransition(() => settlePurchase(p.id))}
            >
              <CheckCircle2 size={15} />
            </button>
          )}
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            disabled={pending}
            onClick={() => {
              if (confirm("წავშალო შესყიდვა?")) startTransition(() => deletePurchase(p.id));
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}
