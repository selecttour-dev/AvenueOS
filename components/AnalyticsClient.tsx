"use client";

import { useState } from "react";
import {
  CalendarCheck,
  CalendarRange,
  Percent,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import type { AnalyticsData } from "@/lib/queries";
import { gel } from "@/lib/format";
import { PageHeader, Section, StatCard, EmptyState, EVENT_TYPE_LABELS } from "@/components/ui";

export default function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const { months, totals, eventTypes, upcomingEvents } = data;
  const [metric, setMetric] = useState<"income" | "net" | "events">("income");

  const hasData = totals.events > 0 || totals.income > 0;

  return (
    <>
      <PageHeader
        title="ბიზნეს-ანალიტიკა"
        subtitle="ბოლო 12 თვის შემოსავალი, დატვირთვა და ივენთების სურათი"
      />

      {!hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="ჯერ მონაცემები არ არის"
          text="ჩაწერე ჯავშნები და დღის რეესტრი — აქ ავტომატურად გამოჩნდება თვეების დინამიკა და დატვირთვა."
        />
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={CalendarCheck}
              label="ივენთი (12 თვე)"
              value={String(totals.events)}
              hint={`${upcomingEvents} მომავალი`}
              tone="primary"
            />
            <StatCard
              icon={TrendingUp}
              label="შემოსავალი (12 თვე)"
              value={gel(totals.income)}
              hint={`სუფთა ${gel(totals.net)}`}
              tone="green"
            />
            <StatCard
              icon={Users}
              label="საშ. ივენთის ღირებულება"
              value={gel(totals.avgEventValue)}
              hint="შემოსავალი ÷ ივენთები"
              tone="gold"
            />
            <StatCard
              icon={Percent}
              label="დატვირთვა"
              value={`${totals.occupancyPct.toFixed(1)}%`}
              hint={
                totals.bestMonth
                  ? `საუკეთესო: ${totals.bestMonth.label}`
                  : "დაკავებული დღეები"
              }
              tone="default"
            />
          </div>

          {/* revenue / events trend */}
          <Section className="mb-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-extrabold">თვეების დინამიკა</h3>
              <div className="flex gap-1.5">
                <MetricTab active={metric === "income"} onClick={() => setMetric("income")} label="შემოსავალი" />
                <MetricTab active={metric === "net"} onClick={() => setMetric("net")} label="სუფთა" />
                <MetricTab active={metric === "events"} onClick={() => setMetric("events")} label="ივენთები" />
              </div>
            </div>
            <TrendChart months={months} metric={metric} />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* occupancy per month */}
            <Section>
              <div className="mb-4 flex items-center gap-2">
                <CalendarRange size={18} style={{ color: "var(--text-3)" }} />
                <h3 className="text-base font-extrabold">დატვირთვა თვეების მიხედვით</h3>
              </div>
              <div className="flex flex-col gap-2.5">
                {months.map((m) => {
                  const pct = m.daysInMonth ? (m.bookedDays / m.daysInMonth) * 100 : 0;
                  return (
                    <div key={m.ym} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                        {m.label}
                      </span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: "var(--primary)" }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs" style={{ color: "var(--text-3)" }}>
                        {m.bookedDays} დღე
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* event types */}
            <Section>
              <div className="mb-4 flex items-center gap-2">
                <Trophy size={18} style={{ color: "var(--text-3)" }} />
                <h3 className="text-base font-extrabold">ივენთის ტიპები</h3>
              </div>
              {eventTypes.length === 0 ? (
                <EmptyState icon={CalendarCheck} title="ცარიელია" text="ჯავშნები ჯერ არ არის." />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {eventTypes.map((e) => {
                    const max = eventTypes[0].count;
                    const pct = max ? (e.count / max) * 100 : 0;
                    return (
                      <div key={e.type} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                          {EVENT_TYPE_LABELS[e.type] ?? e.type}
                        </span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--gold)" }} />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-bold">{e.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        </>
      )}
    </>
  );
}

function MetricTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className="btn !py-1.5 !text-sm"
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

function TrendChart({
  months,
  metric,
}: {
  months: AnalyticsData["months"];
  metric: "income" | "net" | "events";
}) {
  const vals = months.map((m) =>
    metric === "income" ? m.income : metric === "net" ? m.net : m.events,
  );
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = Math.max(max - Math.min(min, 0), 1);
  const fmt = (v: number) => (metric === "events" ? String(v) : gel(v));

  return (
    <div className="table-wrap">
      <div className="flex min-w-[560px] items-stretch gap-2" style={{ height: 200 }}>
        {months.map((m, i) => {
          const v = vals[i];
          const h = (Math.abs(v) / range) * 100;
          const pos = v >= 0;
          return (
            <div key={m.ym} className="flex h-full flex-1 flex-col items-center gap-1">
              <span className="h-4 text-[10px] font-bold" style={{ color: pos ? "var(--text-2)" : "var(--red)" }}>
                {v !== 0 ? fmt(v) : ""}
              </span>
              <div className="flex w-full flex-1 items-end" style={{ minHeight: 1 }}>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(h, v !== 0 ? 3 : 0)}%`,
                    background: pos ? "var(--primary)" : "var(--red)",
                  }}
                  title={`${m.label}: ${fmt(v)}`}
                />
              </div>
              <span className="h-4 text-[10px]" style={{ color: "var(--text-3)" }}>{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
