"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Eye,
  EyeOff,
  HandCoins,
  Package as PackageIcon,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Save,
  Search,
  Trash2,
  TrendingUp,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  addBookingDish,
  addBookingLedgerEntry,
  addPayment,
  applyPackageToBookingMenu,
  deleteBooking,
  deleteBookingDish,
  deleteBookingLedgerEntry,
  deletePayment,
  setBookingPackage,
  updateBooking,
  updateBookingDish,
  updateBookingStatus,
} from "@/lib/actions";
import {
  bookingTotal,
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/lib/booking-shared";
import {
  bookingInventoryNeeds,
  bookingMenuOrder,
  bookingMenuSelling,
  bookingMenuTotalCost,
  dishCost,
  packageCostPerGuest,
  packageOrder,
  type InventoryItem,
  type InventoryNeed,
  type MenuCategory,
  type MenuDish,
  type MenuIngredient,
  type MenuPackage,
} from "@/lib/menu-shared";
import type { BookingDetail } from "@/lib/queries";
import { gel, fmtDate, fmtDateShort, todayISO } from "@/lib/format";
import { PageHeader, Section, StatCard, StatusBadge, EmptyState, EVENT_TYPE_LABELS } from "@/components/ui";

export default function BookingDetailClient({
  booking,
  venueName,
  packages,
  dishes,
  categories,
  ingredients,
  inventoryItems,
}: {
  booking: BookingDetail;
  venueName: string;
  packages: MenuPackage[];
  dishes: MenuDish[];
  categories: MenuCategory[];
  ingredients: MenuIngredient[];
  inventoryItems: InventoryItem[];
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

  // Actual money from the day register for this event's date.
  const a = booking.actual;
  const actualCost = a.wages + a.expenses;
  const actualTax = (a.income * booking.incomeTaxPct) / 100;
  const actualProfit = a.income - actualCost - actualTax;
  const hasActual = a.income > 0 || actualCost > 0;

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

      {hasActual && (
        <div className="mt-6">
          <Section
            title="ფაქტობრივი — დღის რეესტრიდან"
            action={
              <Link
                href={`/register?date=${booking.eventDate}`}
                className="text-sm font-semibold"
                style={{ color: "var(--primary)" }}
              >
                რეესტრში →
              </Link>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ActualBox label="ფაქტ. შემოსავალი" value={gel(a.income)} color="var(--green)" />
              <ActualBox
                label="ფაქტ. ხარჯი"
                value={gel(actualCost)}
                sub={a.wages > 0 ? `მათ შორის ხელფასი ${gel(a.wages)}` : undefined}
                color="var(--red)"
              />
              <ActualBox
                label={`საშემოსავლო (${booking.incomeTaxPct}%)`}
                value={gel(actualTax)}
                color="var(--red)"
              />
              <ActualBox
                label="ფაქტ. მოგება"
                value={gel(actualProfit)}
                sub="შემოს. − ხარჯი − გადასახადი"
                color={actualProfit >= 0 ? "var(--green)" : "var(--red)"}
                strong
              />
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--text-3)" }}>
              ეს ციფრები დღის რეესტრიდან მოდის ({fmtDate(booking.eventDate)}) —
              რეალური ფული, გეგმიურის ნაცვლად.
              {booking.incomeTaxPct === 0 && " საშემოსავლო % ფინანსებში დააყენე."}
            </p>
          </Section>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DetailsPanel booking={booking} />
        <div className="grid gap-6">
          <PaymentsPanel booking={booking} outstanding={outstanding} />
          <ExpensesPanel booking={booking} />
        </div>
      </div>

      <div className="mt-6">
        <MenuPanel
          booking={booking}
          venueName={venueName}
          packages={packages}
          dishes={dishes}
          categories={categories}
          ingredients={ingredients}
          inventoryItems={inventoryItems}
        />
      </div>
    </>
  );
}

// ---------------- Event menu (custom / package) + inventory needs ----------------

function MenuPanel({
  booking,
  venueName,
  packages,
  dishes,
  categories,
  ingredients,
  inventoryItems,
}: {
  booking: BookingDetail;
  venueName: string;
  packages: MenuPackage[];
  dishes: MenuDish[];
  categories: MenuCategory[];
  ingredients: MenuIngredient[];
  inventoryItems: InventoryItem[];
}) {
  const dishesById = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes]);
  const ingredientsById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );
  const [mode, setMode] = useState<"custom" | "package">(
    booking.packageId ? "package" : "custom",
  );
  // Costs/inventory hidden by default — a guest may be looking at the screen.
  const [showCost, setShowCost] = useState(false);

  if (dishes.length === 0) {
    return (
      <Section title="ივენთის მენიუ">
        <EmptyState
          icon={UtensilsCrossed}
          title="ჯერ კერძები დაამატე"
          text="მენიუ კერძებისგან იწყობა. „კალკულაციებში“ დაამატე კერძები რეცეპტებით — მერე აქ სწრაფად შეადგენ ივენთის მენიუს."
          action={
            <Link href="/calc" className="btn btn-ghost">
              კალკულაციები
            </Link>
          }
        />
      </Section>
    );
  }

  return (
    <Section
      title="ივენთის მენიუ"
      action={
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost !py-1.5"
            title={showCost ? "ღირებულების დამალვა" : "ღირებულების ჩვენება"}
            onClick={() => setShowCost((s) => !s)}
          >
            {showCost ? <EyeOff size={15} /> : <Eye size={15} />}
            {showCost ? "ღირ. დამალვა" : "ღირებულება"}
          </button>
          <div className="flex rounded-lg p-1" style={{ background: "var(--surface-2)" }}>
            {(["custom", "package"] as const).map((m) => (
              <button
                key={m}
                className="rounded-md px-3 py-1 text-sm font-semibold transition-colors"
                style={
                  mode === m
                    ? { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow-sm)" }
                    : { background: "transparent", color: "var(--text-2)" }
                }
                onClick={() => setMode(m)}
              >
                {m === "custom" ? "ინდივიდუალური" : "პაკეტი"}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {mode === "custom" ? (
        <CustomMenu
          booking={booking}
          venueName={venueName}
          dishes={dishes}
          categories={categories}
          dishesById={dishesById}
          ingredientsById={ingredientsById}
          inventoryItems={inventoryItems}
          showCost={showCost}
        />
      ) : (
        <PackageMenu
          booking={booking}
          venueName={venueName}
          packages={packages}
          categories={categories}
          dishesById={dishesById}
          ingredientsById={ingredientsById}
          inventoryItems={inventoryItems}
          showCost={showCost}
          onCustomized={() => setMode("custom")}
        />
      )}
    </Section>
  );
}

function CustomMenu({
  booking,
  venueName,
  dishes,
  categories,
  dishesById,
  ingredientsById,
  inventoryItems,
  showCost,
}: {
  booking: BookingDetail;
  venueName: string;
  dishes: MenuDish[];
  categories: MenuCategory[];
  dishesById: Map<number, MenuDish>;
  ingredientsById: Map<number, MenuIngredient>;
  inventoryItems: InventoryItem[];
  showCost: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const lines = booking.menuDishes;
  const lineByDish = useMemo(
    () => new Map(lines.map((l) => [l.dishId, l])),
    [lines],
  );
  const guests = booking.guestCount;
  const menuCost = bookingMenuTotalCost(lines, dishesById, ingredientsById, guests);
  const costPerGuest = guests > 0 ? menuCost / guests : 0;
  const selling = bookingMenuSelling(lines, dishesById, guests);
  const sellingPerGuest = guests > 0 ? selling / guests : 0;
  const needs = bookingInventoryNeeds(
    bookingMenuOrder(lines, dishesById, guests),
    inventoryItems,
    guests,
  );

  // dishes grouped by category, filtered by search
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const buckets = new Map<string, MenuDish[]>();
    for (const d of dishes) {
      if (q && !d.name.toLowerCase().includes(q)) continue;
      const key = d.categoryId != null ? catName.get(d.categoryId) ?? "სხვა" : "სხვა";
      const arr = buckets.get(key) ?? [];
      arr.push(d);
      buckets.set(key, arr);
    }
    // preserve category order, "სხვა" last
    const ordered: { name: string; dishes: MenuDish[] }[] = [];
    for (const c of categories) {
      const arr = buckets.get(c.name);
      if (arr) ordered.push({ name: c.name, dishes: arr });
    }
    const other = buckets.get("სხვა");
    if (other) ordered.push({ name: "სხვა", dishes: other });
    return ordered;
  }, [dishes, categories, q]);

  const toggle = (dish: MenuDish) => {
    const existing = lineByDish.get(dish.id);
    startTransition(async () => {
      if (existing) await deleteBookingDish(existing.id, booking.id);
      else await addBookingDish(booking.id, dish.id, 1);
    });
  };

  return (
    <>
      <p className="mb-3 text-xs" style={{ color: "var(--text-3)" }}>
        დააჭირე კერძებს რაც კლიენტმა მოისურვა — ერთი შეხებით ემატება/იშლება.
        ღირებულება და ინვენტარი ავტომ. დაითვლება {booking.guestCount} სტუმარზე.
      </p>

      {/* search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
        <input
          className="input !pl-9"
          placeholder="კერძის ძებნა…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* clickable dish chips grouped by category */}
      <div className="mb-4 flex flex-col gap-3" style={{ maxHeight: 260, overflowY: "auto" }}>
        {groups.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-3)" }}>ვერ მოიძებნა.</p>
        ) : (
          groups.map((g) => (
            <div key={g.name}>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                {g.name}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.dishes.map((d) => {
                  const added = lineByDish.has(d.id);
                  return (
                    <button
                      key={d.id}
                      disabled={pending}
                      onClick={() => toggle(d)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
                      style={
                        added
                          ? { background: "var(--primary)", color: "#fff" }
                          : { background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }
                      }
                    >
                      {added ? <Check size={14} /> : <Plus size={14} />}
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          ჯერ კერძი არ არჩეულა — დააჭირე ზემოთ კერძებს.
        </p>
      ) : (
        <>
          <div className="table-wrap mb-4 -mx-1">
            <table className="table">
              <thead>
                <tr>
                  <th>არჩეული კერძი</th>
                  <th>რაოდენობა</th>
                  <th>ერთეული</th>
                  <th>სულ პორცია</th>
                  {showCost && <th>ღირებულება</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const dish = dishesById.get(l.dishId);
                  if (!dish) return null;
                  return (
                    <CustomMenuRow
                      key={l.id}
                      line={l}
                      dish={dish}
                      guests={guests}
                      bookingId={booking.id}
                      ingredientsById={ingredientsById}
                      showCost={showCost}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Always visible — this is the client quote */}
          <div className="grid gap-4 sm:grid-cols-2">
            <MiniBox
              label="ჯამური თანხა (გასაყიდი)"
              value={gel(selling)}
              sub={`${gel(sellingPerGuest, 2)} / 1 სტუმარი`}
              color="var(--green)"
            />
            <SetPriceBox
              booking={booking}
              sellingPerGuest={sellingPerGuest}
            />
          </div>

          {showCost && (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <MiniBox
                  label={`თვითღირებულება (${booking.guestCount} სტ.)`}
                  value={gel(menuCost)}
                  sub={`${gel(costPerGuest, 2)} / სტუმარი`}
                  color="var(--gold)"
                />
                <MiniBox
                  label="მოგება (მენიუ)"
                  value={gel(selling - menuCost)}
                  sub={`გასაყიდი ${gel(selling)} − ღირ. ${gel(menuCost)}`}
                  color={selling - menuCost >= 0 ? "var(--green)" : "var(--red)"}
                />
              </div>
              <InventoryNeeds needs={needs} />
            </>
          )}
          <MenuExport
            venueName={venueName}
            booking={booking}
            lines={lines}
            dishesById={dishesById}
            categories={categories}
          />
        </>
      )}
    </>
  );
}

function CustomMenuRow({
  line,
  dish,
  guests,
  bookingId,
  ingredientsById,
  showCost,
}: {
  line: { id: number; dishId: number; qty: number; perGuest: boolean };
  dish: MenuDish;
  guests: number;
  bookingId: number;
  ingredientsById: Map<number, MenuIngredient>;
  showCost: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(String(line.qty));

  const portions = line.perGuest ? line.qty * guests : line.qty;
  const lineCost = dishCost(dish.lines, ingredientsById) * portions;

  return (
    <tr>
      <td className="font-semibold">{dish.name}</td>
      <td>
        <input
          type="number"
          className="input !w-20 !py-1.5"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={() => {
            const v = Number(qty);
            if (v > 0 && v !== line.qty)
              startTransition(() => updateBookingDish(line.id, { qty: v }));
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </td>
      <td>
        <select
          className="select !w-auto !py-1.5"
          value={line.perGuest ? "guest" : "total"}
          disabled={pending}
          onChange={(e) =>
            startTransition(() =>
              updateBookingDish(line.id, { perGuest: e.target.value === "guest" }),
            )
          }
        >
          <option value="guest">სტუმარზე</option>
          <option value="total">სულ</option>
        </select>
      </td>
      <td className="font-semibold">{Math.round(portions * 100) / 100}</td>
      {showCost && <td className="font-bold">{gel(lineCost, 2)}</td>}
      <td>
        <div className="flex justify-end">
          <button
            className="btn btn-ghost !px-2 !py-1.5"
            disabled={pending}
            onClick={() => startTransition(() => deleteBookingDish(line.id, bookingId))}
          >
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function PackageMenu({
  booking,
  venueName,
  packages,
  categories,
  dishesById,
  ingredientsById,
  inventoryItems,
  showCost,
  onCustomized,
}: {
  booking: BookingDetail;
  venueName: string;
  packages: MenuPackage[];
  categories: MenuCategory[];
  dishesById: Map<number, MenuDish>;
  ingredientsById: Map<number, MenuIngredient>;
  inventoryItems: InventoryItem[];
  showCost: boolean;
  onCustomized: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const pkg = packages.find((p) => p.id === booking.packageId) ?? null;

  if (packages.length === 0) {
    return (
      <EmptyState
        icon={PackageIcon}
        title="პაკეტები ჯერ არ არის"
        text="შექმენი მზა პაკეტი „კალკულაციებში“ — მერე ერთი კლიკით მიაბამ ივენთს."
        action={<Link href="/calc" className="btn btn-ghost">კალკულაციები</Link>}
      />
    );
  }

  const costPerGuest = pkg ? packageCostPerGuest(pkg, dishesById, ingredientsById) : 0;
  const menuCost = costPerGuest * booking.guestCount;
  const menuRevenue = pkg ? pkg.pricePerGuest * booking.guestCount : 0;
  const needs = pkg
    ? bookingInventoryNeeds(
        packageOrder(pkg, dishesById, booking.guestCount),
        inventoryItems,
        booking.guestCount,
      )
    : [];

  return (
    <>
      <select
        className="select mb-4"
        value={pkg?.id ?? ""}
        disabled={pending}
        onChange={(e) =>
          startTransition(() =>
            setBookingPackage(booking.id, e.target.value ? Number(e.target.value) : null),
          )
        }
      >
        <option value="">— პაკეტის გარეშე —</option>
        {packages.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {!pkg ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-2)" }}>
          <PackageIcon size={16} style={{ color: "var(--text-3)" }} />
          აირჩიე მზა პაკეტი ზემოთ.
        </div>
      ) : (
        <>
          {/* Always visible — client quote */}
          <div className="grid gap-4 sm:grid-cols-2">
            <MiniBox
              label="ჯამური თანხა (გასაყიდი)"
              value={gel(menuRevenue)}
              sub={pkg.pricePerGuest ? `${gel(pkg.pricePerGuest, 2)} / 1 სტუმარი` : "პაკეტს ფასი არ აქვს"}
              color="var(--green)"
            />
            <SetPriceBox booking={booking} sellingPerGuest={pkg.pricePerGuest} />
          </div>

          {showCost && (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <MiniBox
                  label={`თვითღირებულება (${booking.guestCount} სტ.)`}
                  value={gel(menuCost)}
                  sub={`${gel(costPerGuest, 2)} / სტუმარი`}
                  color="var(--gold)"
                />
                <MiniBox
                  label="მოგება (მენიუ)"
                  value={gel(menuRevenue - menuCost)}
                  sub={pkg.dishes.length + " კერძი"}
                  color={menuRevenue - menuCost >= 0 ? "var(--green)" : "var(--red)"}
                />
              </div>
              <InventoryNeeds needs={needs} />
            </>
          )}

          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
            style={{ background: "var(--surface-2)" }}
          >
            <span className="text-sm" style={{ color: "var(--text-2)" }}>
              კლიენტს პაკეტიდან რომელიმე კერძის შეცვლა უნდა?
            </span>
            <button
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    "პაკეტის კერძები გადმოვა ინდივიდუალურ მენიუში, სადაც თავისუფლად შეცვლი. გავაგრძელო?",
                  )
                )
                  startTransition(async () => {
                    await applyPackageToBookingMenu(booking.id, pkg.id);
                    onCustomized();
                  });
              }}
            >
              <Pencil size={15} /> პაკეტის მორგება
            </button>
          </div>

          <MenuExport
            venueName={venueName}
            booking={booking}
            lines={pkg.dishes}
            dishesById={dishesById}
            categories={categories}
          />
        </>
      )}
    </>
  );
}

// ---------------- Menu export (print / copy) ----------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function groupMenu(
  lines: { dishId: number }[],
  dishesById: Map<number, MenuDish>,
  categories: MenuCategory[],
): { name: string; dishes: string[] }[] {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const buckets = new Map<string, string[]>();
  for (const l of lines) {
    const dish = dishesById.get(l.dishId);
    if (!dish) continue;
    const key =
      dish.categoryId != null ? catName.get(dish.categoryId) ?? "სხვა" : "სხვა";
    const arr = buckets.get(key) ?? [];
    arr.push(dish.name);
    buckets.set(key, arr);
  }
  const ordered: { name: string; dishes: string[] }[] = [];
  for (const c of categories) {
    const arr = buckets.get(c.name);
    if (arr) ordered.push({ name: c.name, dishes: arr });
  }
  const other = buckets.get("სხვა");
  if (other) ordered.push({ name: "სხვა", dishes: other });
  return ordered;
}

function MenuExport({
  venueName,
  booking,
  lines,
  dishesById,
  categories,
}: {
  venueName: string;
  booking: BookingDetail;
  lines: { dishId: number }[];
  dishesById: Map<number, MenuDish>;
  categories: MenuCategory[];
}) {
  const [copied, setCopied] = useState(false);
  const groups = groupMenu(lines, dishesById, categories);

  const asText = () => {
    const head = `${venueName}\n${booking.title}\n${fmtDate(booking.eventDate)} · ${booking.guestCount} სტუმარი\n`;
    const body = groups
      .map(
        (g) => `\n${g.name.toUpperCase()}\n` + g.dishes.map((d) => `• ${d}`).join("\n"),
      )
      .join("\n");
    return head + body;
  };

  const copyMenu = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const printMenu = () => {
    const sections = groups
      .map(
        (g) =>
          `<section><h2>${escapeHtml(g.name)}</h2><ul>${g.dishes
            .map((d) => `<li>${escapeHtml(d)}</li>`)
            .join("")}</ul></section>`,
      )
      .join("");
    const html = `<!doctype html><html lang="ka"><head><meta charset="utf-8"><title>${escapeHtml(booking.title)} — მენიუ</title>
<style>
  @page { margin: 24mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans Georgian", system-ui, sans-serif; color: #23221c; margin: 0; padding: 40px; }
  .wrap { max-width: 640px; margin: 0 auto; }
  header { text-align: center; border-bottom: 2px solid #2d5a3d; padding-bottom: 18px; margin-bottom: 26px; }
  .venue { font-size: 13px; letter-spacing: .18em; text-transform: uppercase; color: #967c3a; font-weight: 700; }
  h1 { font-size: 26px; margin: 8px 0 4px; }
  .meta { font-size: 13px; color: #6b675c; }
  section { margin-bottom: 22px; }
  h2 { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: #2d5a3d; border-bottom: 1px solid #e6e3da; padding-bottom: 5px; margin: 0 0 10px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 4px 0; font-size: 16px; }
  footer { margin-top: 34px; text-align: center; font-size: 12px; color: #a09b8c; }
</style></head>
<body><div class="wrap">
  <header>
    <div class="venue">${escapeHtml(venueName)}</div>
    <h1>${escapeHtml(booking.title)}</h1>
    <div class="meta">${escapeHtml(fmtDate(booking.eventDate))} · ${booking.guestCount} სტუმარი</div>
  </header>
  ${sections || "<p>მენიუ ცარიელია</p>"}
  <footer>მადლობა რომ აგვირჩიეთ</footer>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
    const w = window.open("", "_blank", "width=760,height=1000");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div
      className="mt-5 flex flex-wrap items-center gap-2 pt-4"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <span className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>
        მენიუს გაგზავნა კლიენტს:
      </span>
      <button className="btn btn-ghost" onClick={printMenu}>
        <Printer size={15} /> ბეჭდვა / PDF
      </button>
      <button className="btn btn-ghost" onClick={copyMenu}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? "დაკოპირდა ✓" : "ტექსტის კოპირება"}
      </button>
    </div>
  );
}

function InventoryNeeds({ needs }: { needs: InventoryNeed[] }) {
  const missing = needs.filter((n) => n.missing > 0);
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold">
        საჭირო ინვენტარი
        {missing.length > 0 ? (
          <span className="badge" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
            <AlertTriangle size={12} /> აკლია {missing.length}
          </span>
        ) : needs.length > 0 ? (
          <span className="badge" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
            <CheckCircle2 size={12} /> საკმარისია
          </span>
        ) : null}
      </div>
      {needs.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          ინვენტარი ვერ დაითვალა — კერძებს მიაბი თეფშები „კალკულაციებში“, ხოლო
          სერვირების ჭურჭელს მიუთითე „სტუმარზე“ რაოდენობა ინვენტარიზაციაში.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ინვენტარი</th>
                <th>წყარო</th>
                <th>საჭიროა</th>
                <th>მარაგშია</th>
                <th>აკლია</th>
              </tr>
            </thead>
            <tbody>
              {needs.map(({ item, required, missing: miss, perGuestPart }) => {
                const dishPart = required - perGuestPart;
                const source =
                  perGuestPart > 0 && dishPart > 0
                    ? "სტუმარი + კერძი"
                    : perGuestPart > 0
                      ? "სტუმარზე"
                      : "კერძებიდან";
                return (
                  <tr key={item.id}>
                    <td className="font-semibold">{item.name}</td>
                    <td className="text-xs" style={{ color: "var(--text-3)" }}>{source}</td>
                    <td>{Math.round(required * 100) / 100} {item.unit}</td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>
                      {miss > 0 ? (
                        <span className="badge" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
                          {Math.round(miss * 100) / 100} {item.unit}
                        </span>
                      ) : (
                        <span style={{ color: "var(--green)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActualBox({
  label,
  value,
  sub,
  color,
  strong,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  strong?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: "var(--surface-2)", border: strong ? "1px solid var(--border-strong)" : undefined }}
    >
      <div className="text-xs" style={{ color: "var(--text-3)" }}>{label}</div>
      <div className={`mt-1 font-extrabold ${strong ? "text-xl" : "text-lg"}`} style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: "var(--text-3)" }}>{sub}</div>}
    </div>
  );
}

function MiniBox({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
      <div className="text-xs" style={{ color: "var(--text-3)" }}>{label}</div>
      <div className="mt-1 text-lg font-extrabold" style={{ color }}>{value}</div>
      <div className="text-xs" style={{ color: "var(--text-3)" }}>{sub}</div>
    </div>
  );
}

function SetPriceBox({
  booking,
  sellingPerGuest,
}: {
  booking: BookingDetail;
  sellingPerGuest: number;
}) {
  const [pending, startTransition] = useTransition();
  const rounded = Math.round(sellingPerGuest * 100) / 100;
  const matches = Math.abs(booking.pricePerGuest - rounded) < 0.01;

  return (
    <div
      className="flex flex-col justify-between rounded-xl px-4 py-3"
      style={{ background: "var(--surface-2)" }}
    >
      <div>
        <div className="text-xs" style={{ color: "var(--text-3)" }}>
          ჯავშნის ფასი / სტუმარი
        </div>
        <div className="mt-1 text-lg font-extrabold">
          {booking.pricePerGuest ? gel(booking.pricePerGuest, 2) : "0 ₾"}
        </div>
      </div>
      {sellingPerGuest > 0 && !matches && (
        <button
          className="btn btn-ghost mt-2 !py-1.5"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateBooking(booking.id, { pricePerGuest: rounded });
            })
          }
        >
          <Check size={14} /> მენიუს ფასის დაყენება ({gel(rounded, 2)})
        </button>
      )}
      {matches && (
        <div className="mt-2 text-xs font-semibold" style={{ color: "var(--green)" }}>
          ✓ მენიუს ფასის ტოლია
        </div>
      )}
    </div>
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
    total: String(bookingTotal(booking)),
    discount: String(booking.discount),
    clientName: booking.clientName ?? "",
    clientPhone: booking.clientPhone ?? "",
    notes: booking.notes ?? "",
  });

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const guestsN = Number(form.guestCount) || 0;
  const ppgN = Number(form.pricePerGuest) || 0;
  const totalN = Number(form.total) || 0;
  const discountN = Number(form.discount) || 0;
  const menuPart = guestsN * ppgN;
  const otherPart = totalN - menuPart; // rent + other (derived)

  const save = () =>
    startTransition(async () => {
      // Total is the source of truth: extraCharges absorbs the non-menu part
      // so that bookingTotal (guests×ppg + extra − discount) equals `total`.
      const extra = Math.round((totalN - menuPart + discountN) * 100) / 100;
      await updateBooking(booking.id, {
        title: form.title,
        eventType: form.eventType,
        eventDate: form.eventDate,
        startTime: form.startTime || null,
        guestCount: guestsN,
        pricePerGuest: ppgN,
        extraCharges: extra,
        discount: discountN,
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
          <Field
            label="ჯამური ღირებულება"
            value={gel(bookingTotal(booking))}
          />
          <Field
            label="ფასი სტუმარზე"
            value={
              booking.pricePerGuest
                ? gel(booking.pricePerGuest, 2)
                : booking.guestCount > 0
                  ? `${gel(bookingTotal(booking) / booking.guestCount, 2)} (ჯამიდან)`
                  : "—"
            }
          />
          {booking.discount > 0 && (
            <Field label="ფასდაკლება" value={gel(booking.discount)} />
          )}
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
          <input
            type="number"
            className="input"
            value={form.guestCount}
            onChange={(e) => {
              const g = Number(e.target.value) || 0;
              setForm((f) => ({
                ...f,
                guestCount: e.target.value,
                // keep the non-menu (rent) part; total follows menu = g × ppg
                total: String(Math.round((g * ppgN + otherPart) * 100) / 100),
              }));
            }}
          />
        </div>
        <div>
          <label className="label">ფასი სტუმარზე ₾ (მენიუ, არასავალდ.)</label>
          <input
            type="number"
            className="input"
            value={form.pricePerGuest}
            onChange={(e) => {
              const p = Number(e.target.value) || 0;
              setForm((f) => ({
                ...f,
                pricePerGuest: e.target.value,
                total: String(Math.round((guestsN * p + otherPart) * 100) / 100),
              }));
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">ჯამური ღირებულება ₾ (რასაც იხდის)</label>
          <input
            type="number"
            className="input"
            value={form.total}
            onChange={(e) => set("total")(e.target.value)}
          />
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-3)" }}>
            მენიუ ({guestsN} × {gel(ppgN, 2)}) = {gel(menuPart)}
            {" · "}
            იჯარა / სხვა: {gel(otherPart)}
            {ppgN > 0 && totalN > 0 && (
              <> {" · "} 1 სტუმარი: {gel(guestsN > 0 ? totalN / guestsN : 0, 2)}</>
            )}
          </p>
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
