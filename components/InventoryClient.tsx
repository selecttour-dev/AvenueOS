"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
} from "@/lib/actions";
import {
  inventoryNeeds,
  type InventoryItem,
  type MenuDish,
} from "@/lib/menu-shared";
import { gel } from "@/lib/format";
import { PageHeader, Section, EmptyState, StatCard } from "@/components/ui";
import { Package2, CircleDollarSign } from "lucide-react";

type OrderRow = { dishId: number; portions: number };

export default function InventoryClient({
  items,
  dishes,
}: {
  items: InventoryItem[];
  dishes: MenuDish[];
}) {
  const [tab, setTab] = useState<"stock" | "check">("stock");

  const totalValue = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const lowCount = items.filter(
    (i) => i.minQty != null && i.quantity < i.minQty,
  ).length;

  return (
    <>
      <PageHeader
        title="ინვენტარიზაცია"
        subtitle="ჭურჭელი, ტექნიკა, მარაგები — და შეკვეთამდე დანაკლისის შემოწმება"
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Package2}
          label="პოზიციები"
          value={String(items.length)}
          tone="primary"
        />
        <StatCard
          icon={CircleDollarSign}
          label="ჯამური ღირებულება"
          value={gel(totalValue)}
          tone="gold"
        />
        <StatCard
          icon={AlertTriangle}
          label="დაბალი მარაგი"
          value={String(lowCount)}
          hint={lowCount > 0 ? "მინიმალურ ზღვარს ქვემოთ" : "ყველაფერი რიგზეა"}
          tone={lowCount > 0 ? "red" : "green"}
        />
      </div>

      <div className="mb-5 flex gap-2">
        <TabButton
          active={tab === "stock"}
          onClick={() => setTab("stock")}
          label="მარაგები"
        />
        <TabButton
          active={tab === "check"}
          onClick={() => setTab("check")}
          label="შეკვეთის შემოწმება"
        />
      </div>

      {tab === "stock" ? (
        <StockTab items={items} />
      ) : (
        <OrderCheckTab items={items} dishes={dishes} />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className="btn"
      style={
        active
          ? { background: "var(--text)", color: "var(--surface)" }
          : {
              background: "var(--surface)",
              color: "var(--text-2)",
              border: "1px solid var(--border)",
            }
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ---------------- Stock ----------------

function StockTab({ items }: { items: InventoryItem[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    category: "",
    unit: "ცალი",
    quantity: "",
    unitPrice: "",
    minQty: "",
  });

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))] as string[],
    [items],
  );

  return (
    <>
      <Section title="ახალი პოზიცია" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="label">დასახელება</label>
            <input
              className="input"
              placeholder="მაგ. თეფში (დიდი)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">კატეგორია</label>
            <input
              className="input"
              placeholder="მაგ. ჭურჭელი"
              list="inv-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <datalist id="inv-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">რაოდენობა</label>
            <input
              type="number"
              className="input"
              placeholder="200"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div>
            <label className="label">ერთ. ფასი ₾</label>
            <input
              type="number"
              className="input"
              placeholder="0.00"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">მინ. ზღვარი</label>
              <input
                type="number"
                className="input"
                placeholder="—"
                value={form.minQty}
                onChange={(e) => setForm({ ...form, minQty: e.target.value })}
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={pending || !form.name.trim()}
              onClick={() =>
                startTransition(async () => {
                  await createInventoryItem({
                    name: form.name,
                    category: form.category,
                    unit: form.unit,
                    quantity: Number(form.quantity) || 0,
                    unitPrice: Number(form.unitPrice) || 0,
                    minQty: form.minQty === "" ? null : Number(form.minQty),
                  });
                  setForm({
                    name: "",
                    category: form.category,
                    unit: form.unit,
                    quantity: "",
                    unitPrice: "",
                    minQty: "",
                  });
                })
              }
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </Section>

      <Section>
        {items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="ინვენტარი ცარიელია"
            text="შეიყვანე რაც გაქვს — თეფშები, ჭიქები, დანა-ჩანგალი, ტექნიკა. მაგ: თეფში (დიდი) · 200 ცალი."
          />
        ) : (
          <div className="table-wrap -m-5">
            <table className="table">
              <thead>
                <tr>
                  <th>დასახელება</th>
                  <th>კატეგორია</th>
                  <th>რაოდენობა</th>
                  <th>ერთ. ფასი</th>
                  <th>ღირებულება</th>
                  <th>მინ. ზღვარი</th>
                  <th>სტატუსი</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function ItemRow({ item }: { item: InventoryItem }) {
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unitPrice));
  const [min, setMin] = useState(item.minQty == null ? "" : String(item.minQty));

  const low = item.minQty != null && item.quantity < item.minQty;

  const save =
    (
      field: "quantity" | "unitPrice" | "minQty",
      raw: string,
      current: number | null,
    ) =>
    () => {
      const v = raw === "" && field === "minQty" ? null : Number(raw);
      if (v !== null && Number.isNaN(v)) return;
      if (v !== current)
        startTransition(() => updateInventoryItem(item.id, { [field]: v }));
    };

  return (
    <tr>
      <td className="font-semibold">{item.name}</td>
      <td style={{ color: "var(--text-2)" }}>{item.category ?? "—"}</td>
      <td>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className="input !w-24 !py-1.5"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={save("quantity", qty, item.quantity)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {item.unit}
          </span>
        </div>
      </td>
      <td>
        <input
          type="number"
          className="input !w-24 !py-1.5"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={save("unitPrice", price, item.unitPrice)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </td>
      <td className="font-semibold">{gel(item.quantity * item.unitPrice)}</td>
      <td>
        <input
          type="number"
          className="input !w-20 !py-1.5"
          placeholder="—"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={save("minQty", min, item.minQty)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </td>
      <td>
        {low ? (
          <span className="badge" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
            <AlertTriangle size={12} /> შესავსებია
          </span>
        ) : (
          <span className="badge" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
            <CheckCircle2 size={12} /> რიგზეა
          </span>
        )}
      </td>
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            disabled={pending}
            onClick={() => {
              if (confirm(`წავშალო „${item.name}"?`))
                startTransition(() => deleteInventoryItem(item.id));
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------- Order check ----------------

function OrderCheckTab({
  items,
  dishes,
}: {
  items: InventoryItem[];
  dishes: MenuDish[];
}) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [dishId, setDishId] = useState("");
  const [portions, setPortions] = useState("");

  const dishById = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes]);

  const order = rows
    .map((r) => ({ dish: dishById.get(r.dishId)!, portions: r.portions }))
    .filter((r) => r.dish);
  const needs = inventoryNeeds(order, items);
  const missing = needs.filter((n) => n.missing > 0);
  const dishesWithoutLinks = order.filter((o) => o.dish.invLines.length === 0);

  const available = dishes.filter((d) => !rows.some((r) => r.dishId === d.id));

  return (
    <>
      <Section title="შეკვეთის აწყობა" className="mb-5">
        <p className="mb-4 text-sm" style={{ color: "var(--text-2)" }}>
          აირჩიე კერძები და პორციები — სისტემა დაითვლის რა ინვენტარი დაგჭირდება
          და რა გაკლია. (კერძს ინვენტარი „კალკულაციებში" მიუთითე — მაგ. ლობიანი →
          1 თეფში)
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="label">კერძი</label>
            <select
              className="select"
              value={dishId}
              onChange={(e) => setDishId(e.target.value)}
            >
              <option value="">— აირჩიე —</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.invLines.length === 0 ? " (ინვენტარი მიუთითებელია)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">პორცია</label>
            <input
              type="number"
              className="input !w-28"
              placeholder="150"
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            disabled={!dishId || !(Number(portions) > 0)}
            onClick={() => {
              setRows([...rows, { dishId: Number(dishId), portions: Number(portions) }]);
              setDishId("");
              setPortions("");
            }}
          >
            <Plus size={16} /> დამატება
          </button>
        </div>

        {rows.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {rows.map((r, idx) => (
              <span
                key={idx}
                className="badge"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                {dishById.get(r.dishId)?.name} × {r.portions}
                <Trash2
                  size={12}
                  className="cursor-pointer opacity-60 hover:opacity-100"
                  onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                />
              </span>
            ))}
          </div>
        )}
      </Section>

      {rows.length === 0 ? (
        <Section>
          <EmptyState
            icon={ClipboardList}
            title="შეკვეთა ცარიელია"
            text="დაამატე კერძები პორციებით და ნახე გეყოფა თუ არა ინვენტარი."
          />
        </Section>
      ) : (
        <>
          {dishesWithoutLinks.length > 0 && (
            <div
              className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
              style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
            >
              <AlertTriangle size={16} />
              {dishesWithoutLinks.map((d) => d.dish.name).join(", ")} — ინვენტარი
              მიუთითებელია, ვერ ჩავთვლი.
            </div>
          )}
          <Section
            title={
              missing.length > 0
                ? `აკლია ${missing.length} პოზიცია`
                : "ინვენტარი საკმარისია ✓"
            }
          >
            {needs.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="ინვენტარის საჭიროება ვერ დაითვალა"
                text="არჩეულ კერძებს ინვენტარი არ აქვთ მიბმული — კალკულაციებში კერძის ბარათზე მიუთითე."
              />
            ) : (
              <div className="table-wrap -m-5">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ინვენტარი</th>
                      <th>საჭიროა</th>
                      <th>მარაგშია</th>
                      <th>აკლია</th>
                    </tr>
                  </thead>
                  <tbody>
                    {needs.map(({ item, required, missing: miss }) => (
                      <tr key={item.id}>
                        <td className="font-semibold">{item.name}</td>
                        <td>
                          {required} {item.unit}
                        </td>
                        <td>
                          {item.quantity} {item.unit}
                        </td>
                        <td>
                          {miss > 0 ? (
                            <span
                              className="badge"
                              style={{ background: "var(--red-soft)", color: "var(--red)" }}
                            >
                              <AlertTriangle size={12} /> {miss} {item.unit}
                            </span>
                          ) : (
                            <span
                              className="badge"
                              style={{ background: "var(--green-soft)", color: "var(--green)" }}
                            >
                              <CheckCircle2 size={12} /> საკმარისია
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </>
  );
}
