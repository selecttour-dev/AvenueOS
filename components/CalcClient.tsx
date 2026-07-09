"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Calculator,
  Carrot,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  UtensilsCrossed,
  Wand2,
  X,
} from "lucide-react";
import {
  addDishInventory,
  addRecipeLine,
  createDish,
  createDishCategory,
  createIngredient,
  deleteDish,
  deleteDishCategory,
  deleteDishInventory,
  deleteIngredient,
  deleteRecipeLine,
  updateDish,
  updateDishInventory,
  updateIngredient,
  updateRecipeLine,
} from "@/lib/actions";
import {
  DEFAULT_TARGET_FOOD_COST_PCT,
  QTY_LABELS,
  UNIT_LABELS,
  dishCost,
  foodCostPct,
  lineCost,
  suggestedPrice,
  type InventoryItem,
  type MenuCategory,
  type MenuDish,
  type MenuIngredient,
} from "@/lib/menu-shared";
import { gel } from "@/lib/format";
import { PageHeader, Section, EmptyState } from "@/components/ui";

type Props = {
  ingredients: MenuIngredient[];
  categories: MenuCategory[];
  dishes: MenuDish[];
  inventoryItems: InventoryItem[];
};

export default function CalcClient({
  ingredients,
  categories,
  dishes,
  inventoryItems,
}: Props) {
  const [tab, setTab] = useState<"dishes" | "ingredients">("dishes");
  const ingredientsById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );

  return (
    <>
      <PageHeader
        title="კალკულაციები"
        subtitle="ინგრედიენტი → კერძი → თვითღირებულება ავტომატურად"
      />

      <div className="mb-5 flex gap-2">
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
      </div>

      {tab === "ingredients" ? (
        <IngredientsTab ingredients={ingredients} dishes={dishes} />
      ) : (
        <DishesTab
          ingredients={ingredients}
          ingredientsById={ingredientsById}
          categories={categories}
          dishes={dishes}
          inventoryItems={inventoryItems}
          goToIngredients={() => setTab("ingredients")}
        />
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

  const usedCount = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of dishes)
      for (const l of d.lines) m.set(l.ingredientId, (m.get(l.ingredientId) ?? 0) + 1);
    return m;
  }, [dishes]);

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

      <Section>
        {ingredients.length === 0 ? (
          <EmptyState
            icon={Carrot}
            title="ინგრედიენტები არ არის"
            text="დაამატე პროდუქტები ფასებით — ეს არის კალკულაციის საფუძველი. მაგ: ლობიო · კგ · 10₾"
          />
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
                {ingredients.map((ing) => (
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
  goToIngredients,
}: {
  ingredients: MenuIngredient[];
  ingredientsById: Map<number, MenuIngredient>;
  categories: MenuCategory[];
  dishes: MenuDish[];
  inventoryItems: InventoryItem[];
  goToIngredients: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [catFilter, setCatFilter] = useState<number | "all">("all");
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [form, setForm] = useState({ name: "", categoryId: "", sellPrice: "" });

  const visible =
    catFilter === "all" ? dishes : dishes.filter((d) => d.categoryId === catFilter);

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

      {visible.length === 0 ? (
        <Section>
          <EmptyState
            icon={UtensilsCrossed}
            title="კერძები არ არის"
            text="დაამატე კერძი, გახსენი და ჩაუწერე რეცეპტი — თვითღირებულება ავტომატურად დაითვლება."
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
}: {
  dish: MenuDish;
  categories: MenuCategory[];
  ingredients: MenuIngredient[];
  ingredientsById: Map<number, MenuIngredient>;
  inventoryItems: InventoryItem[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sellPrice, setSellPrice] = useState(String(dish.sellPrice || ""));

  const cost = dishCost(dish.lines, ingredientsById);
  const fc = foodCostPct(cost, dish.sellPrice);
  const suggested = suggestedPrice(cost, DEFAULT_TARGET_FOOD_COST_PCT);
  const catName = categories.find((c) => c.id === dish.categoryId)?.name;

  const saveSellPrice = () => {
    const v = Number(sellPrice) || 0;
    if (v !== dish.sellPrice) startTransition(() => updateDish(dish.id, { sellPrice: v }));
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
        <div className="min-w-40 flex-1">
          <div className="font-bold">{dish.name}</div>
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
              : fc <= DEFAULT_TARGET_FOOD_COST_PCT
                ? "var(--green)"
                : "var(--red)"
          }
        />
        <Metric
          label="მარჟა"
          value={dish.sellPrice ? gel(dish.sellPrice - cost, 2) : "—"}
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
        <button
          className="btn btn-danger !px-2.5 !py-1.5"
          title="კერძის წაშლა"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`წავშალო „${dish.name}"?`))
              startTransition(() => deleteDish(dish.id));
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {open && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border)" }}>
          <RecipeEditor
            dish={dish}
            cost={cost}
            suggested={suggested}
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
  ingredients,
  ingredientsById,
}: {
  dish: MenuDish;
  cost: number;
  suggested: number;
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
            რეკომენდებული ფასი ({DEFAULT_TARGET_FOOD_COST_PCT}% food-cost):{" "}
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
