"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  CalendarRange,
  CircleDollarSign,
  RotateCcw,
  Save,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { saveModelParams } from "@/lib/actions";
import type { ForecastData } from "@/lib/queries";
import {
  annualProfit,
  breakEvenEvents,
  contributionPerEvent,
  monthlyProfit,
  monthlyProjection,
  monthlyRevenue,
  sensitivity,
  type ModelParams,
} from "@/lib/forecast-shared";
import { gel, monthNameKa } from "@/lib/format";
import { PageHeader, Section, StatCard } from "@/components/ui";

const SLIDERS: {
  key: keyof ModelParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: "eventsPerMonth", label: "ივენთი / თვე", min: 0, max: 30, step: 1, unit: "" },
  { key: "avgGuests", label: "საშ. სტუმარი", min: 0, max: 600, step: 5, unit: "" },
  { key: "pricePerGuest", label: "ფასი სტუმარზე", min: 0, max: 400, step: 5, unit: "₾" },
  { key: "foodCostPerGuest", label: "კვების ღირ. სტუმარზე", min: 0, max: 200, step: 1, unit: "₾" },
  { key: "serviceCostPerEvent", label: "მომსახურების ხარჯი / ივენთი", min: 0, max: 5000, step: 50, unit: "₾" },
];

export default function ForecastClient({ data }: { data: ForecastData }) {
  const [pending, startTransition] = useTransition();
  const [params, setParams] = useState<ModelParams>(data.params);
  const [saved, setSaved] = useState(false);

  const monthlyFixed = data.monthlyFixed;
  const dirty = useMemo(
    () => (Object.keys(params) as (keyof ModelParams)[]).some((k) => params[k] !== data.params[k]),
    [params, data.params],
  );

  const contrib = contributionPerEvent(params);
  const mProfit = monthlyProfit(params, monthlyFixed);
  const aProfit = annualProfit(params, monthlyFixed);
  const mRevenue = monthlyRevenue(params);
  const breakEven = breakEvenEvents(params, monthlyFixed);
  const projection = useMemo(
    () => monthlyProjection(params, monthlyFixed),
    [params, monthlyFixed],
  );
  const levers = useMemo(
    () => sensitivity(params, monthlyFixed),
    [params, monthlyFixed],
  );

  const set = (k: keyof ModelParams, v: number) =>
    setParams((p) => ({ ...p, [k]: v }));

  const save = () =>
    startTransition(async () => {
      await saveModelParams(params);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });

  return (
    <>
      <PageHeader
        title="პროგნოზები"
        subtitle="ბიზნეს-მოდელი, break-even და what-if სცენარები"
        action={
          <div className="flex items-center gap-2">
            {dirty && (
              <button className="btn btn-ghost" onClick={() => setParams(data.params)}>
                <RotateCcw size={15} /> დაბრუნება
              </button>
            )}
            <button className="btn btn-primary" disabled={pending || !dirty} onClick={save}>
              <Save size={15} /> შენახვა
            </button>
          </div>
        }
      />

      {saved && (
        <div
          className="mb-4 rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={{ background: "var(--green-soft)", color: "var(--green)" }}
        >
          მოდელი შენახულია ✓
        </div>
      )}
      {!data.hasSavedParams && (
        <div
          className="mb-4 rounded-xl px-4 py-2.5 text-sm"
          style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
        >
          ეს საწყისი პარამეტრებია
          {data.suggestions.bookingsCount > 0
            ? " (ნაწილი შენი რეალური ჯავშნებიდან)"
            : ""}
          . შეასწორე და დააჭირე „შენახვა".
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CircleDollarSign}
          label="შემოსავალი / თვე"
          value={gel(mRevenue)}
          hint={`${params.eventsPerMonth} ივენთი`}
          tone="gold"
        />
        <StatCard
          icon={Wallet}
          label="მოგება / თვე"
          value={gel(mProfit)}
          hint={`ფიქს. ხარჯი ${gel(monthlyFixed)}`}
          tone={mProfit >= 0 ? "green" : "red"}
        />
        <StatCard
          icon={TrendingUp}
          label="მოგება / წელი"
          value={gel(aProfit)}
          tone={aProfit >= 0 ? "green" : "red"}
        />
        <StatCard
          icon={Target}
          label="Break-even"
          value={
            breakEven == null
              ? "ვერ იფარება"
              : `${breakEven.toFixed(1)} ივენთი/თვე`
          }
          hint={
            breakEven == null
              ? "ივენთი ზარალიანია"
              : `ერთი ივენთი: +${gel(contrib)}`
          }
          tone={breakEven == null ? "red" : "primary"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ParamsPanel
          params={params}
          set={set}
          monthlyFixed={monthlyFixed}
          suggestions={data.suggestions}
        />
        <BreakEvenPanel
          params={params}
          contrib={contrib}
          breakEven={breakEven}
          monthlyFixed={monthlyFixed}
        />
      </div>

      <div className="mt-6">
        <ProjectionChart projection={projection} />
      </div>

      <div className="mt-6">
        <SensitivityPanel levers={levers} />
      </div>
    </>
  );
}

function ParamsPanel({
  params,
  set,
  monthlyFixed,
  suggestions,
}: {
  params: ModelParams;
  set: (k: keyof ModelParams, v: number) => void;
  monthlyFixed: number;
  suggestions: ForecastData["suggestions"];
}) {
  return (
    <Section title="მოდელის პარამეტრები">
      <div className="flex flex-col gap-5">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label !mb-0">{s.label}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  className="input !w-24 !py-1"
                  value={params[s.key]}
                  min={s.min}
                  onChange={(e) => set(s.key, Number(e.target.value) || 0)}
                />
                {s.unit && (
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>
                    {s.unit}
                  </span>
                )}
              </div>
            </div>
            <input
              type="range"
              className="w-full accent-[var(--primary)]"
              min={s.min}
              max={s.max}
              step={s.step}
              value={Math.min(params[s.key], s.max)}
              onChange={(e) => set(s.key, Number(e.target.value))}
            />
          </div>
        ))}
      </div>

      <div
        className="mt-5 flex items-center justify-between rounded-xl px-4 py-3 text-sm"
        style={{ background: "var(--surface-2)" }}
      >
        <span style={{ color: "var(--text-2)" }}>ფიქსირებული ხარჯი / თვე</span>
        <span className="flex items-center gap-2 font-bold">
          {gel(monthlyFixed)}
          <Link href="/finance" className="underline" style={{ color: "var(--primary)" }}>
            რედაქტ.
          </Link>
        </span>
      </div>

      {(suggestions.avgGuests || suggestions.avgFoodCostPerGuest) && (
        <p className="mt-3 text-xs" style={{ color: "var(--text-3)" }}>
          რეალური მონაცემები:{" "}
          {suggestions.avgGuests ? `საშ. სტუმარი ~${suggestions.avgGuests}` : ""}
          {suggestions.avgPrice ? ` · ფასი ~${gel(suggestions.avgPrice)}` : ""}
          {suggestions.avgFoodCostPerGuest
            ? ` · მენიუს კვების ღირ. ~${gel(suggestions.avgFoodCostPerGuest)}`
            : ""}
        </p>
      )}
    </Section>
  );
}

function BreakEvenPanel({
  params,
  contrib,
  breakEven,
  monthlyFixed,
}: {
  params: ModelParams;
  contrib: number;
  breakEven: number | null;
  monthlyFixed: number;
}) {
  const target = breakEven;
  const current = params.eventsPerMonth;
  const surplus = target != null ? current - target : null;

  return (
    <Section title="Break-even ანალიზი">
      <div className="flex flex-col gap-3 text-sm">
        <Row label="შემოსავალი ერთ ივენთზე" value={gel(params.avgGuests * params.pricePerGuest)} />
        <Row label="− კვება ერთ ივენთზე" value={gel(params.avgGuests * params.foodCostPerGuest)} color="var(--red)" />
        <Row label="− მომსახურება ერთ ივენთზე" value={gel(params.serviceCostPerEvent)} color="var(--red)" />
        <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3">
          <Row label="მოგება ერთ ივენთზე (fixed-მდე)" value={gel(contrib)} strong color={contrib >= 0 ? "var(--green)" : "var(--red)"} />
        </div>
      </div>

      <div
        className="mt-5 rounded-xl p-4 text-center"
        style={{ background: breakEven == null ? "var(--red-soft)" : "var(--primary-soft)" }}
      >
        {breakEven == null ? (
          <p className="text-sm font-bold" style={{ color: "var(--red)" }}>
            ამ პარამეტრებით ივენთი ზარალიანია — ფიქს. ხარჯს ვერ დაფარავს.
          </p>
        ) : (
          <>
            <div className="text-xs font-semibold" style={{ color: "var(--primary-strong)" }}>
              ნულზე გასასვლელად საჭიროა
            </div>
            <div className="mt-1 text-3xl font-extrabold" style={{ color: "var(--primary-strong)" }}>
              {breakEven.toFixed(1)}
            </div>
            <div className="text-xs" style={{ color: "var(--primary-strong)" }}>
              ივენთი თვეში ({gel(monthlyFixed)} ფიქს. ხარჯი)
            </div>
          </>
        )}
      </div>

      {surplus != null && (
        <p
          className="mt-3 text-center text-sm font-semibold"
          style={{ color: surplus >= 0 ? "var(--green)" : "var(--red)" }}
        >
          {surplus >= 0
            ? `შენი ${current} ივენთით — ზღვარს ზემოთ ${surplus.toFixed(1)} ივენთით ✓`
            : `${current} ივენთი აკლია ${Math.abs(surplus).toFixed(1)} ივენთი ნულამდე`}
        </p>
      )}
    </Section>
  );
}

function Row({
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
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span
        className={strong ? "text-base font-extrabold" : "font-semibold"}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function ProjectionChart({
  projection,
}: {
  projection: ReturnType<typeof monthlyProjection>;
}) {
  const maxAbs = Math.max(1, ...projection.map((m) => Math.abs(m.profit)));
  const annual = projection.reduce((s, m) => s + m.profit, 0);

  return (
    <Section
      title="12-თვიანი პროგნოზი (სეზონურობით)"
      action={
        <span className="text-sm font-bold" style={{ color: annual >= 0 ? "var(--green)" : "var(--red)" }}>
          წელი: {gel(annual)}
        </span>
      }
    >
      <div className="flex items-end gap-1.5" style={{ height: 160 }}>
        {projection.map((m) => {
          const pos = m.profit >= 0;
          const h = (Math.abs(m.profit) / maxAbs) * 100;
          return (
            <div key={m.month} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
              <div
                className="w-full rounded-t-md"
                title={`${monthNameKa(m.month)}: ${gel(m.profit)} (${m.events.toFixed(1)} ივენთი)`}
                style={{
                  height: `${Math.max(h, m.profit !== 0 ? 3 : 1)}%`,
                  background: pos ? "var(--green)" : "var(--red)",
                  opacity: 0.85,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {projection.map((m) => (
          <div key={m.month} className="flex-1 text-center text-[10px]" style={{ color: "var(--text-3)" }}>
            {monthNameKa(m.month).slice(0, 3)}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--text-3)" }}>
        სვეტი — თვის მოგება. სეზონურ თვეებში ივენთები მეტია; მკრთალ თვეებში ფიქს. ხარჯმა შეიძლება ზარალი გამოიწვიოს.
      </p>
    </Section>
  );
}

function SensitivityPanel({
  levers,
}: {
  levers: ReturnType<typeof sensitivity>;
}) {
  const maxAbs = Math.max(1, ...levers.map((l) => Math.abs(l.delta)));
  return (
    <Section title="სენსიტიურობა — რა ცვლის ყველაზე მეტს (წლიური მოგება)">
      <div className="flex flex-col gap-3">
        {levers.map((l) => {
          const pos = l.delta >= 0;
          const w = (Math.abs(l.delta) / maxAbs) * 100;
          return (
            <div key={l.label} className="flex items-center gap-3">
              <span className="w-52 shrink-0 text-sm font-medium">{l.label}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${w}%`, background: pos ? "var(--green)" : "var(--red)" }}
                />
              </div>
              <span
                className="w-28 shrink-0 text-right text-sm font-bold"
                style={{ color: pos ? "var(--green)" : "var(--red)" }}
              >
                {pos ? "+" : "−"}
                {gel(Math.abs(l.delta))}
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
