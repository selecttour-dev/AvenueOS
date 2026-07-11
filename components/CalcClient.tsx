"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Calculator,
  Carrot,
  ChevronDown,
  ChevronRight,
  Copy,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingDown,
  UtensilsCrossed,
  Wand2,
  X,
} from "lucide-react";
import {
  addDishInventory,
  addPackageDish,
  addRecipeLine,
  createDish,
  createDishCategory,
  createIngredient,
  createPackage,
  deleteDish,
  deleteDishCategory,
  deleteDishInventory,
  deleteIngredient,
  deletePackage,
  deletePackageDish,
  deleteRecipeLine,
  duplicateDish,
  saveTargetFoodCostPct,
  updateDish,
  updateDishInventory,
  updateIngredient,
  updatePackage,
  updatePackageDish,
  updateRecipeLine,
} from "@/lib/actions";
import {
  QTY_LABELS,
  UNIT_LABELS,
  dishCost,
  foodCostPct,
  lineCost,
  packageCostPerGuest,
  suggestedPrice,
  type InventoryItem,
  type MenuCategory,
  type MenuDish,
  type MenuIngredient,
  type MenuPackage,
} from "@/lib/menu-shared";
import { gel } from "@/lib/format";
import { PageHeader, Section, EmptyState, StatCard } from "@/components/ui";

type Props = {
  ingredients: MenuIngredient[];
  categories: MenuCategory[];
  dishes: MenuDish[];
  inventoryItems: InventoryItem[];
  packages: MenuPackage[];
  targetPct: number;
};

export default function CalcClient({
  ingredients,
  categories,
  dishes,
  inventoryItems,
  packages,
  targetPct,
}: Props) {
  const [tab, setTab] = useState<"dishes" | "ingredients" | "packages">("dishes");
  const ingredientsById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );
  const dishesById = useMemo(
    () => new Map(dishes.map((d) => [d.id, d])),
    [dishes],
  );

  const overview = useMemo(() => {
    let fcSum = 0;
    let fcCount = 0;
    let unprofitable = 0;
    for (const d of dishes) {
      const cost = dishCost(d.lines, ingredientsById);
      const fc = foodCostPct(cost, d.sellPrice);
      if (fc != null) {
        fcSum += fc;
        fcCount += 1;
      }
      if (d.sellPrice > 0 && d.sellPrice - cost < 0) unprofitable += 1;
    }
    return {
      avgFc: fcCount ? Math.round(fcSum / fcCount) : null,
      unprofitable,
    };
  }, [dishes, ingredientsById]);

  return (
    <>
      <PageHeader
        title="კალკულაციები"
        subtitle="ინგრედიენტი → კერძი → პაკეტი → თვითღირებულება ავტომატურად"
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={UtensilsCrossed} label="კერძები" value={String(dishes.length)} tone="primary" />
        <StatCard icon={Carrot} label="ინგრედიენტები" value={String(ingredients.length)} tone="gold" />
        <StatCard
          icon={Target}
          label="საშ. food-cost"
          value={overview.avgFc != null ? `${overview.avgFc}%` : "—"}
          hint={`სამიზნე: ${targetPct}%`}
          tone={overview.avgFc == null ? "default" : overview.avgFc <= targetPct ? "green" : "red"}
        />
        <StatCard
          icon={TrendingDown}
          label="წამგებიანი კერძი"
          value={String(overview.unprofitable)}
          hint={overview.unprofitable > 0 ? "ფასი < ღირებულება" : "ყველა მომგებიანია"}
          tone={overview.unprofitable > 0 ? "red" : "green"}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <TabButton
          active={tab === "dishes"}
          onClick={() => setTab("dishes")}
          label={`კერძები (${dishes.length})`}
        />
        <TabButton
          active={tab === "ingredients"}
          onClick={() => setTab("ingredients")}
          label={`ინგრედიენტები (${ingredients.length})`}
        />
        <TabButton
          active={tab === "packages"}
          onClick={() => setTab("packages")}
          label={`პაკეტები (${packages.length})`}
        />
        <div className="ml-auto">
          <TargetPctControl targetPct={targetPct} />
        </div>
      </div>

      {tab === "ingredients" && (
        <IngredientsTab ingredients={ingredients} dishes={dishes} />
      )}
      {tab === "dishes" && (
        <DishesTab
          ingredients={ingredients}
          ingredientsById={ingredientsById}
          categories={categories}
          dishes={dishes}
          inventoryItems={inventoryItems}
          targetPct={targetPct}
          goToIngredients={() => setTab("ingredients")}
        />
      )}
      {tab === "packages" && (
        <PackagesTab
          packages={packages}
          dishes={dishes}
          dishesById={dishesById}
          ingredientsById={ingredientsById}
          goToDishes={() => setTab("dishes")}
        />
      )}
    </>
  );
}

function TargetPctControl({ targetPct }: { targetPct: number }) {
  const [pending, startTransition] = useTransition();
  const [val, setVal] = useState(String(targetPct));
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-1.5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <Target size={14} style={{ color: "var(--text-3)" }} />
      <span className="text-xs" style={{ color: "var(--text-2)" }}>
        სამიზნე food-cost
      </span>
      <input
        type="number"
        className="input !w-16 !py-1 !text-sm"
        value={val}
        disabled={pending}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const v = Number(val);
          if (v > 0 && v !== targetPct)
            startTransition(() => saveTargetFoodCostPct(v));
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className="text-xs" style={{ color: "var(--text-3)" }}>%</span>
    </div>
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

// ---------------- Ingredients ----------------

function IngredientsTab({
  ingredients,
  dishes,
}: {
  ingredients: MenuIngredient[];
  dishes: MenuDish[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", unit: "kg", price: "", waste: "" });
  const [query, setQuery] = useState("");

  const usedCount = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of dishes)
      for (const l of d.lines) m.set(l.ingredientId, (m.get(l.ingredientId) ?? 0) + 1);
    return m;
  }, [dishes]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? ingredients.filter((i) => i.name.toLowerCase().includes(q))
    : ingredients;

  return (
    <>
      <Section title="ახალი ინგრედიენტი" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="label">დასახელება</label>
            <input
              className="input"
              placeholder="მაგ. ლობიო"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">ერთეული</label>
            <select
              className="select"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              <option value="kg">კილოგრამი</option>
              <option value="l">ლიტრი</option>
              <option value="pc">ცალი</option>
            </select>
          </div>
          <div>
            <label className="label">ფასი ({UNIT_LABELS[form.unit]}) ₾</label>
            <input
              type="number"
              className="input"
              placeholder="10.00"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">დანაკარგი %</label>
              <input
                type="number"
                className="input"
                placeholder="0"
                value={form.waste}
                onChange={(e) => setForm({ ...form, waste: e.target.value })}
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={pending || !form.name.trim()}
              onClick={() =>
                startTransition(async () => {
                  await createIngredient({
                    name: form.name,
                    unit: form.unit,
                    pricePerUnit: Number(form.price) || 0,
                    wastePct: Number(form.waste) || 0,
                  });
                  setForm({ name: "", unit: form.unit, price: "", waste: "" });
                })
              }
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </Section>

      {ingredients.length > 0 && (
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
          <input
            className="input !pl-9"
            placeholder="ინგრედიენტის ძებნა…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <Section>
        {ingredients.length === 0 ? (
          <EmptyState
            icon={Carrot}
            title="ინგრედიენტები არ არის"
            text="დაამატე პროდუქტები ფასებით — ეს არის კალკულაციის საფუძველი. მაგ: ლობიო · კგ · 10₾"
          />
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-3)" }}>
            „{query}“ ვერ მოიძებნა.
          </p>
        ) : (
          <div className="table-wrap -m-5">
            <table className="table">
              <thead>
                <tr>
                  <th>დასახელება</th>
                  <th>ერთეული</th>
                  <th>ფასი</th>
                  <th>დანაკარგი %</th>
                  <th>კერძებში</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((ing) => (
                  <IngredientRow key={ing.id} ing={ing} used={usedCount.get(ing.id) ?? 0} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function IngredientRow({ ing, used }: { ing: MenuIngredient; used: number }) {
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(String(ing.pricePerUnit));
  const [waste, setWaste] = useState(String(ing.wastePct));

  const savePrice = () => {
    const v = Number(price);
    if (!Number.isNaN(v) && v !== ing.pricePerUnit)
      startTransition(() => updateIngredient(ing.id, { pricePerUnit: v }));
  };
  const saveWaste = () => {
    const v = Number(waste);
    if (!Number.isNaN(v) && v !== ing.wastePct)
      startTransition(() => updateIngredient(ing.id, { wastePct: v }));
  };

  return (
    <tr>
      <td className="font-semibold">{ing.name}</td>
      <td style={{ color: "var(--text-2)" }}>{UNIT_LABELS[ing.unit]}</td>
      <td>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className="input !w-24 !py-1.5"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={savePrice}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            ₾/{UNIT_LABELS[ing.unit]}
          </span>
        </div>
      </td>
      <td>
        <input
          type="number"
          className="input !w-20 !py-1.5"
          value={waste}
          onChange={(e) => setWaste(e.target.value)}
          onBlur={saveWaste}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </td>
      <td style={{ color: "var(--text-2)" }}>{used > 0 ? `${used} კერძი` : "—"}</td>
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            title={used > 0 ? "ჯერ ამოიღე კერძებიდან" : "წაშლა"}
            disabled={pending || used > 0}
            onClick={() => {
              if (confirm(`წავშალო „${ing.name}"?`))
                startTransition(() => deleteIngredient(ing.id));
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------- Dishes ----------------

function DishesTab({
  ingredients,
  ingredientsById,
  categories,
  dishes,
  inventoryItems,
  targetPct,
  goToIngredients,
}: {
  ingredients: MenuIngredient[];
  ingredientsById: Map<number, MenuIngredient>;
  categories: MenuCategory[];
  dishes: MenuDish[];
  inventoryItems: InventoryItem[];
  targetPct: number;
  goToIngredients: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [catFilter, setCatFilter] = useState<number | "all">("all");
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [form, setForm] = useState({ name: "", categoryId: "", sellPrice: "" });
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = dishes.filter(
    (d) =>
      (catFilter === "all" || d.categoryId === catFilter) &&
      (!q || d.name.toLowerCase().includes(q)),
  );

  const dishCountByCat = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of dishes)
      if (d.categoryId != null) m.set(d.categoryId, (m.get(d.categoryId) ?? 0) + 1);
    return m;
  }, [dishes]);

  if (ingredients.length === 0) {
    return (
      <Section>
        <EmptyState
          icon={Carrot}
          title="ჯერ ინგრედიენტები დაამატე"
          text="კერძის კალკულაციას ინგრედიენტების ფასები სჭირდება. მაგ: ლობიო · კგ · 10₾, ფქვილი · კგ · 5₾."
          action={
            <button className="btn btn-primary" onClick={goToIngredients}>
              <Plus size={16} /> ინგრედიენტების დამატება
            </button>
          }
        />
      </Section>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CategoryChip
          label={`ყველა (${dishes.length})`}
          active={catFilter === "all"}
          onClick={() => setCatFilter("all")}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c.id}
            label={`${c.name} (${dishCountByCat.get(c.id) ?? 0})`}
            active={catFilter === c.id}
            onClick={() => setCatFilter(c.id)}
            onDelete={
              (dishCountByCat.get(c.id) ?? 0) === 0
                ? () => {
                    if (confirm(`წავშალო კატეგორია „${c.name}"?`)) {
                      if (catFilter === c.id) setCatFilter("all");
                      startTransition(() => deleteDishCategory(c.id));
                    }
                  }
                : undefined
            }
          />
        ))}
        {addingCat ? (
          <span className="flex items-center gap-1.5">
            <input
              className="input !w-40 !py-1.5"
              placeholder="მაგ. ცომეული"
              value={newCat}
              autoFocus
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCat.trim())
                  startTransition(async () => {
                    await createDishCategory(newCat);
                    setNewCat("");
                    setAddingCat(false);
                  });
                if (e.key === "Escape") setAddingCat(false);
              }}
            />
            <button
              className="btn btn-primary !px-2.5 !py-1.5"
              disabled={pending || !newCat.trim()}
              onClick={() =>
                startTransition(async () => {
                  await createDishCategory(newCat);
                  setNewCat("");
                  setAddingCat(false);
                })
              }
            >
              <Plus size={15} />
            </button>
          </span>
        ) : (
          <button
            className="badge cursor-pointer"
            style={{
              background: "var(--surface)",
              color: "var(--text-3)",
              border: "1px dashed var(--border-strong)",
            }}
            onClick={() => setAddingCat(true)}
          >
            <Plus size={13} /> კატეგორია
          </button>
        )}
      </div>

      <Section title="ახალი კერძი" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">კერძის სახელი</label>
            <input
              className="input"
              placeholder="მაგ. ლობიანი"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">კატეგორია</label>
            <select
              className="select"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">— კატეგორიის გარეშე —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">გასაყიდი ფასი ₾ (არასავალდებულო)</label>
            <input
              type="number"
              className="input"
              placeholder="0.00"
              value={form.sellPrice}
              onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button
              className="btn btn-primary w-full"
              disabled={pending || !form.name.trim()}
              onClick={() =>
                startTransition(async () => {
                  await createDish({
                    name: form.name,
                    categoryId: form.categoryId ? Number(form.categoryId) : null,
                    sellPrice: Number(form.sellPrice) || 0,
                  });
                  setForm({ name: "", categoryId: form.categoryId, sellPrice: "" });
                })
              }
            >
              <Plus size={16} /> დამატება
            </button>
          </div>
        </div>
      </Section>

      {dishes.length > 0 && (
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
          <input
            className="input !pl-9"
            placeholder="კერძის ძებნა…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <Section>
          <EmptyState
            icon={UtensilsCrossed}
            title={dishes.length === 0 ? "კერძები არ არის" : "ვერ მოიძებნა"}
            text={
              dishes.length === 0
                ? "დაამატე კერძი, გახსენი და ჩაუწერე რეცეპტი — თვითღირებულება ავტომატურად დაითვლება."
                : "შეცვალე ძებნა ან კატეგორია."
            }
          />
        </Section>
      ) : (
        <div className="grid gap-4">
          {visible.map((d) => (
            <DishCard
              key={d.id}
              dish={d}
              categories={categories}
              ingredients={ingredients}
              ingredientsById={ingredientsById}
              inventoryItems={inventoryItems}
              targetPct={targetPct}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  onDelete,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <span
      className="badge cursor-pointer select-none"
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
      {onDelete && (
        <X
          size={12}
          className="opacity-60 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        />
      )}
    </span>
  );
}

function DishCard({
  dish,
  categories,
  ingredients,
  ingredientsById,
  inventoryItems,
  targetPct,
}: {
  dish: MenuDish;
  categories: MenuCategory[];
  ingredients: MenuIngredient[];
  ingredientsById: Map<number, MenuIngredient>;
  inventoryItems: InventoryItem[];
  targetPct: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sellPrice, setSellPrice] = useState(String(dish.sellPrice || ""));
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(dish.name);

  const cost = dishCost(dish.lines, ingredientsById);
  const fc = foodCostPct(cost, dish.sellPrice);
  const suggested = suggestedPrice(cost, targetPct);
  const catName = categories.find((c) => c.id === dish.categoryId)?.name;

  const saveSellPrice = () => {
    const v = Number(sellPrice) || 0;
    if (v !== dish.sellPrice) startTransition(() => updateDish(dish.id, { sellPrice: v }));
  };
  const saveName = () => {
    const v = name.trim();
    setEditingName(false);
    if (v && v !== dish.name) startTransition(() => updateDish(dish.id, { name: v }));
  };

  return (
    <div className="card">
      <div
        className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: "var(--text-3)" }}>
          {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </span>
        <div className="min-w-40 flex-1" onClick={(e) => editingName && e.stopPropagation()}>
          {editingName ? (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                className="input !py-1"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") { setName(dish.name); setEditingName(false); }
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{dish.name}</span>
              <button
                className="rounded p-0.5 opacity-50 hover:opacity-100"
                style={{ color: "var(--text-3)" }}
                title="სახელის შეცვლა"
                onClick={(e) => {
                  e.stopPropagation();
                  setName(dish.name);
                  setEditingName(true);
                }}
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
          <div className="text-xs" style={{ color: "var(--text-3)" }}>
            {catName ?? "კატეგორიის გარეშე"} · {dish.lines.length} ინგრედიენტი
          </div>
        </div>
        <Metric label="თვითღირებულება" value={gel(cost, 2)} strong />
        <Metric
          label="food-cost"
          value={fc != null ? `${fc.toFixed(0)}%` : "—"}
          color={
            fc == null
              ? undefined
              : fc <= targetPct
                ? "var(--green)"
                : "var(--red)"
          }
        />
        <Metric
          label="მოგება / პორცია"
          value={dish.sellPrice ? gel(dish.sellPrice - cost, 2) : "—"}
        />
        <Metric
          label="მარჟა %"
          value={
            dish.sellPrice
              ? `${(((dish.sellPrice - cost) / dish.sellPrice) * 100).toFixed(0)}%`
              : "—"
          }
          color={
            !dish.sellPrice
              ? undefined
              : dish.sellPrice - cost <= 0
                ? "var(--red)"
                : "var(--green)"
          }
        />
        <div onClick={(e) => e.stopPropagation()}>
          <div className="label !mb-1">გასაყიდი ფასი</div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              className="input !w-24 !py-1.5"
              placeholder="0.00"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              onBlur={saveSellPrice}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <span className="text-xs" style={{ color: "var(--text-3)" }}>₾</span>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn-ghost !px-2.5 !py-1.5"
            title="კერძის დუბლირება (ვარიანტის შესაქმნელად)"
            disabled={pending}
            onClick={() => startTransition(() => duplicateDish(dish.id))}
          >
            <Copy size={15} />
          </button>
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            title="კერძის წაშლა"
            disabled={pending}
            onClick={() => {
              if (confirm(`წავშალო „${dish.name}"?`))
                startTransition(() => deleteDish(dish.id));
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {open && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border)" }}>
          <RecipeEditor
            dish={dish}
            cost={cost}
            suggested={suggested}
            targetPct={targetPct}
            ingredients={ingredients}
            ingredientsById={ingredientsById}
          />
          <ServingInventoryEditor dish={dish} inventoryItems={inventoryItems} />
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  strong,
  color,
}: {
  label: string;
  value: string;
  strong?: boolean;
  color?: string;
}) {
  return (
    <div className="min-w-24">
      <div className="label !mb-1">{label}</div>
      <div
        className={strong ? "text-base font-extrabold" : "text-sm font-semibold"}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function RecipeEditor({
  dish,
  cost,
  suggested,
  targetPct,
  ingredients,
  ingredientsById,
}: {
  dish: MenuDish;
  cost: number;
  suggested: number;
  targetPct: number;
  ingredients: MenuIngredient[];
  ingredientsById: Map<number, MenuIngredient>;
}) {
  const [pending, startTransition] = useTransition();
  const [newIngId, setNewIngId] = useState("");
  const [newQty, setNewQty] = useState("");

  const available = ingredients.filter(
    (i) => !dish.lines.some((l) => l.ingredientId === i.id),
  );
  const selectedIng = newIngId ? ingredientsById.get(Number(newIngId)) : null;

  return (
    <div className="pt-4">
      {dish.lines.length > 0 && (
        <div className="table-wrap mb-4">
          <table className="table">
            <thead>
              <tr>
                <th>ინგრედიენტი</th>
                <th>რაოდენობა / პორცია</th>
                <th>ფასი</th>
                <th>ჯდება</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dish.lines.map((line) => {
                const ing = ingredientsById.get(line.ingredientId);
                if (!ing) return null;
                return (
                  <RecipeLineRow key={line.id} line={line} ing={ing} />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label">ინგრედიენტის დამატება</label>
          <select
            className="select"
            value={newIngId}
            onChange={(e) => setNewIngId(e.target.value)}
          >
            <option value="">— აირჩიე —</option>
            {available.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({gel(i.pricePerUnit, 2)}/{UNIT_LABELS[i.unit]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">
            რაოდენობა {selectedIng ? `(${QTY_LABELS[selectedIng.unit]})` : ""}
          </label>
          <input
            type="number"
            className="input !w-32"
            placeholder={selectedIng?.unit === "pc" ? "მაგ. 2" : "მაგ. 300"}
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newIngId && Number(newQty) > 0)
                startTransition(async () => {
                  await addRecipeLine(dish.id, Number(newIngId), Number(newQty));
                  setNewIngId("");
                  setNewQty("");
                });
            }}
          />
        </div>
        <button
          className="btn btn-primary"
          disabled={pending || !newIngId || !(Number(newQty) > 0)}
          onClick={() =>
            startTransition(async () => {
              await addRecipeLine(dish.id, Number(newIngId), Number(newQty));
              setNewIngId("");
              setNewQty("");
            })
          }
        >
          <Plus size={16} /> დამატება
        </button>
      </div>

      <div
        className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-4 py-3"
        style={{ background: "var(--surface-2)" }}
      >
        <span className="text-sm">
          თვითღირებულება/პორცია:{" "}
          <b style={{ color: "var(--gold)" }}>{gel(cost, 2)}</b>
        </span>
        {cost > 0 && (
          <span className="flex items-center gap-2 text-sm">
            რეკომენდებული ფასი ({targetPct}% food-cost):{" "}
            <b>{gel(suggested, 2)}</b>
            <button
              className="btn btn-ghost !px-2 !py-1"
              title="ფასის გადატანა გასაყიდ ფასში"
              disabled={pending}
              onClick={() =>
                startTransition(() =>
                  updateDish(dish.id, {
                    sellPrice: Math.round(suggested * 100) / 100,
                  }),
                )
              }
            >
              <Wand2 size={14} />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

function ServingInventoryEditor({
  dish,
  inventoryItems,
}: {
  dish: MenuDish;
  inventoryItems: InventoryItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");

  const itemsById = useMemo(
    () => new Map(inventoryItems.map((i) => [i.id, i])),
    [inventoryItems],
  );
  const available = inventoryItems.filter(
    (i) => !dish.invLines.some((l) => l.itemId === i.id),
  );

  return (
    <div className="mt-5">
      <div className="label !mb-2">
        სერვირების ინვენტარი (რაზე გადის — მაგ. ლობიანი → 1 თეფში)
      </div>

      {dish.invLines.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {dish.invLines.map((line) => {
            const item = itemsById.get(line.itemId);
            if (!item) return null;
            return (
              <InvLineChip key={line.id} line={line} item={item} />
            );
          })}
        </div>
      )}

      {inventoryItems.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          ინვენტარი ჯერ ცარიელია — ჯერ „ინვენტარიზაციაში" შეიყვანე თეფშები,
          ჭიქები და ა.შ.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <select
              className="select"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">— აირჩიე ინვენტარი —</option>
              {available.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (მარაგში {i.quantity} {i.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="number"
              className="input !w-24"
              placeholder="1"
              title="რაოდენობა პორციაზე"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <button
            className="btn btn-ghost"
            disabled={pending || !itemId || !(Number(qty) > 0)}
            onClick={() =>
              startTransition(async () => {
                await addDishInventory(dish.id, Number(itemId), Number(qty));
                setItemId("");
                setQty("1");
              })
            }
          >
            <Plus size={15} /> მიბმა
          </button>
        </div>
      )}
    </div>
  );
}

function InvLineChip({
  line,
  item,
}: {
  line: { id: number; itemId: number; qtyPerPortion: number };
  item: InventoryItem;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(line.qtyPerPortion));

  return (
    <span
      className="badge"
      style={{
        background: "var(--blue-soft)",
        color: "var(--blue)",
      }}
    >
      {item.name} ×
      {editing ? (
        <input
          type="number"
          className="input !w-16 !px-1.5 !py-0.5 !text-xs"
          value={qty}
          autoFocus
          onChange={(e) => setQty(e.target.value)}
          onBlur={() => {
            const v = Number(qty);
            if (v > 0 && v !== line.qtyPerPortion)
              startTransition(() => updateDishInventory(line.id, v));
            setEditing(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <b className="cursor-pointer" onClick={() => setEditing(true)}>
          {line.qtyPerPortion}
        </b>
      )}
      /პორცია
      <X
        size={12}
        className="cursor-pointer opacity-60 hover:opacity-100"
        onClick={() => !pending && startTransition(() => deleteDishInventory(line.id))}
      />
    </span>
  );
}

function RecipeLineRow({
  line,
  ing,
}: {
  line: { id: number; ingredientId: number; qty: number };
  ing: MenuIngredient;
}) {
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(String(line.qty));

  const saveQty = () => {
    const v = Number(qty);
    if (v > 0 && v !== line.qty) startTransition(() => updateRecipeLine(line.id, v));
  };

  return (
    <tr>
      <td className="font-semibold">{ing.name}</td>
      <td>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className="input !w-24 !py-1.5"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={saveQty}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {QTY_LABELS[ing.unit]}
          </span>
        </div>
      </td>
      <td style={{ color: "var(--text-2)" }}>
        {gel(ing.pricePerUnit, 2)}/{UNIT_LABELS[ing.unit]}
        {ing.wastePct > 0 && (
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {" "}
            +{ing.wastePct}% დანაკარგი
          </span>
        )}
      </td>
      <td className="font-bold">{gel(lineCost(ing, line.qty), 2)}</td>
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            disabled={pending}
            onClick={() => startTransition(() => deleteRecipeLine(line.id))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------- Packages ----------------

function PackagesTab({
  packages,
  dishes,
  dishesById,
  ingredientsById,
  goToDishes,
}: {
  packages: MenuPackage[];
  dishes: MenuDish[];
  dishesById: Map<number, MenuDish>;
  ingredientsById: Map<number, MenuIngredient>;
  goToDishes: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", price: "" });

  if (dishes.length === 0) {
    return (
      <Section>
        <EmptyState
          icon={UtensilsCrossed}
          title="ჯერ კერძები დაამატე"
          text="პაკეტი კერძებისგან იწყობა. ჯერ „კერძები“ ტაბზე დაამატე კერძები რეცეპტებით."
          action={
            <button className="btn btn-primary" onClick={goToDishes}>
              <Plus size={16} /> კერძებზე გადასვლა
            </button>
          }
        />
      </Section>
    );
  }

  return (
    <>
      <Section title="ახალი პაკეტი" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label">პაკეტის სახელი</label>
            <input
              className="input"
              placeholder="მაგ. სტანდარტული მენიუ"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">ფასი სტუმარზე ₾</label>
            <input
              type="number"
              className="input"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button
              className="btn btn-primary w-full"
              disabled={pending || !form.name.trim()}
              onClick={() =>
                startTransition(async () => {
                  await createPackage({
                    name: form.name,
                    pricePerGuest: Number(form.price) || 0,
                  });
                  setForm({ name: "", price: "" });
                })
              }
            >
              <Plus size={16} /> დამატება
            </button>
          </div>
        </div>
      </Section>

      {packages.length === 0 ? (
        <Section>
          <EmptyState
            icon={PackageOpen}
            title="პაკეტები არ არის"
            text="შექმენი პაკეტი, გახსენი და ჩაუწყვე კერძები პორცია/სტუმარით — ღირებულება ავტომატურად დაითვლება."
          />
        </Section>
      ) : (
        <div className="grid gap-4">
          {packages.map((p) => (
            <PackageCard
              key={p.id}
              pkg={p}
              dishes={dishes}
              dishesById={dishesById}
              ingredientsById={ingredientsById}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PackageCard({
  pkg,
  dishes,
  dishesById,
  ingredientsById,
}: {
  pkg: MenuPackage;
  dishes: MenuDish[];
  dishesById: Map<number, MenuDish>;
  ingredientsById: Map<number, MenuIngredient>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(String(pkg.pricePerGuest || ""));
  const [newDishId, setNewDishId] = useState("");
  const [newQty, setNewQty] = useState("1");

  const cost = packageCostPerGuest(pkg, dishesById, ingredientsById);
  const margin = pkg.pricePerGuest - cost;
  const marginPct = pkg.pricePerGuest ? (margin / pkg.pricePerGuest) * 100 : null;
  const available = dishes.filter(
    (d) => !pkg.dishes.some((pd) => pd.dishId === d.id),
  );

  return (
    <div className="card">
      <div
        className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: "var(--text-3)" }}>
          {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </span>
        <div className="min-w-40 flex-1">
          <div className="font-bold">{pkg.name}</div>
          <div className="text-xs" style={{ color: "var(--text-3)" }}>
            {pkg.dishes.length} კერძი
          </div>
        </div>
        <Metric label="ღირ./სტუმარი" value={gel(cost, 2)} strong />
        <Metric
          label="მარჟა"
          value={pkg.pricePerGuest ? `${marginPct!.toFixed(0)}%` : "—"}
          color={
            !pkg.pricePerGuest
              ? undefined
              : margin >= 0
                ? "var(--green)"
                : "var(--red)"
          }
        />
        <div onClick={(e) => e.stopPropagation()}>
          <div className="label !mb-1">ფასი/სტუმარი</div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              className="input !w-24 !py-1.5"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => {
                const v = Number(price) || 0;
                if (v !== pkg.pricePerGuest)
                  startTransition(() => updatePackage(pkg.id, { pricePerGuest: v }));
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <span className="text-xs" style={{ color: "var(--text-3)" }}>₾</span>
          </div>
        </div>
        <button
          className="btn btn-danger !px-2.5 !py-1.5"
          title="პაკეტის წაშლა"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`წავშალო პაკეტი „${pkg.name}“?`))
              startTransition(() => deletePackage(pkg.id));
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {open && (
        <div className="px-5 pb-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          {pkg.dishes.length > 0 && (
            <div className="table-wrap mb-4">
              <table className="table">
                <thead>
                  <tr>
                    <th>კერძი</th>
                    <th>პორცია / სტუმარი</th>
                    <th>ღირ. / სტუმარი</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pkg.dishes.map((pd) => {
                    const dish = dishesById.get(pd.dishId);
                    if (!dish) return null;
                    return (
                      <PackageDishRow
                        key={pd.id}
                        line={pd}
                        dish={dish}
                        ingredientsById={ingredientsById}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className="label">კერძის დამატება</label>
              <select className="select" value={newDishId} onChange={(e) => setNewDishId(e.target.value)}>
                <option value="">— აირჩიე —</option>
                {available.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({gel(dishCost(d.lines, ingredientsById), 2)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">პორცია/სტუმარი</label>
              <input
                type="number"
                className="input !w-32"
                placeholder="1"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={pending || !newDishId || !(Number(newQty) > 0)}
              onClick={() =>
                startTransition(async () => {
                  await addPackageDish(pkg.id, Number(newDishId), Number(newQty));
                  setNewDishId("");
                  setNewQty("1");
                })
              }
            >
              <Plus size={16} /> დამატება
            </button>
          </div>

          <div
            className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-4 py-3 text-sm"
            style={{ background: "var(--surface-2)" }}
          >
            <span>
              ღირებულება/სტუმარი: <b style={{ color: "var(--gold)" }}>{gel(cost, 2)}</b>
            </span>
            {pkg.pricePerGuest > 0 && (
              <span>
                მოგება/სტუმარი:{" "}
                <b style={{ color: margin >= 0 ? "var(--green)" : "var(--red)" }}>
                  {gel(margin, 2)}
                </b>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PackageDishRow({
  line,
  dish,
  ingredientsById,
}: {
  line: { id: number; dishId: number; qtyPerGuest: number };
  dish: MenuDish;
  ingredientsById: Map<number, MenuIngredient>;
}) {
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(String(line.qtyPerGuest));
  const perGuestCost = dishCost(dish.lines, ingredientsById) * line.qtyPerGuest;

  return (
    <tr>
      <td className="font-semibold">{dish.name}</td>
      <td>
        <input
          type="number"
          className="input !w-24 !py-1.5"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={() => {
            const v = Number(qty);
            if (v > 0 && v !== line.qtyPerGuest)
              startTransition(() => updatePackageDish(line.id, v));
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </td>
      <td className="font-bold">{gel(perGuestCost, 2)}</td>
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-danger !px-2.5 !py-1.5"
            disabled={pending}
            onClick={() => startTransition(() => deletePackageDish(line.id))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}
