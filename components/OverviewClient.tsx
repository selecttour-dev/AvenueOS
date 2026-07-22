"use client";

import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  HandCoins,
  Percent,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { OverviewData } from "@/lib/queries";
import { gel } from "@/lib/format";
import { PageHeader, Section, StatCard } from "@/components/ui";

export default function OverviewClient({ data }: { data: OverviewData }) {
  const d = data;
  const maxCat = Math.max(...d.categories.map((c) => c.total), 1);

  return (
    <>
      <PageHeader
        title="სრული სურათი"
        subtitle="მთელი ბიზნესის ფინანსური მიმოხილვა — ერთ გვერდზე"
      />

      {/* headline */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ArrowUpCircle} label="შემოსავალი" value={gel(d.income)} tone="green" />
        <StatCard icon={ArrowDownCircle} label="დღის ხარჯი" value={gel(d.costs)} tone="red" />
        <StatCard icon={TrendingUp} label="დღის მოგება" value={gel(d.dayProfit)} tone="primary" hint={`მარჟა ${(d.margin * 100).toFixed(1)}%`} />
        <StatCard icon={Wallet} label="საშ. მოგება / ივენთი" value={gel(d.avgProfit)} tone="gold" hint={`${d.events} ივენთი`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* profit → distributable */}
        <Section title="მოგებიდან გასაქვითი">
          <div className="flex flex-col gap-2 text-sm">
            <Line label="დღის მოგება" value={gel(d.dayProfit)} strong />
            <Line label="− ოპერაციული / საერთო ხარჯი" value={gel(d.operational)} color="var(--red)" />
            {d.tax > 0 && <Line label="− საშემოსავლო გადასახადი" value={gel(d.tax)} color="var(--red)" />}
            <div style={{ borderTop: "1px solid var(--border)" }} className="mt-1 pt-2">
              <Line label="= განაწილებადი მოგება" value={gel(d.distributable)} strong color={d.distributable >= 0 ? "var(--green)" : "var(--red)"} />
            </div>
          </div>
          <Link href="/finance" className="mt-3 inline-block text-sm font-semibold" style={{ color: "var(--primary)" }}>
            ფინანსების რედაქტირება →
          </Link>
        </Section>

        {/* partners */}
        <Section title="პარტნიორები">
          <div className="flex flex-col gap-3">
            {d.partners.map((p) => (
              <div key={p.id} className="rounded-xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold">
                    <Users size={15} style={{ color: "var(--text-3)" }} /> {p.name} ({p.sharePct}%)
                  </span>
                  <span className="text-sm">
                    კუთვნილი <b>{gel(p.allocated)}</b>
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: "var(--text-2)" }}>
                  <span>გატანილი: {gel(p.drawn)}</span>
                  {p.advanceRemaining > 0 && (
                    <span style={{ color: "var(--red)" }}>ავანსის ვალი: {gel(p.advanceRemaining)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link href="/finance" className="mt-3 inline-block text-sm font-semibold" style={{ color: "var(--primary)" }}>
            პარტნიორები / ავანსები →
          </Link>
        </Section>

        {/* debts */}
        {d.debts.length > 0 && (
          <Section title="გასაქვითი ვალები">
            <div className="flex flex-col gap-2">
              {d.debts.map((x) => (
                <div key={x.name} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: "var(--surface-2)" }}>
                  <span className="flex items-center gap-2 font-semibold">
                    <HandCoins size={15} style={{ color: "var(--text-3)" }} /> {x.name}
                  </span>
                  <b style={{ color: "var(--red)" }}>{gel(x.remaining)}</b>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* category breakdown */}
        <Section title="ხარჯები კატეგორიით">
          <div className="flex flex-col gap-2.5">
            {d.categories.slice(0, 14).map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                  {c.category}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(c.total / maxCat) * 100}%`, background: "var(--primary)" }} />
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-bold">{gel(c.total)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* monthly */}
      <Section title="თვიური ჭრილი" className="mt-5">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>თვე</th>
                <th className="text-center">ივენთი</th>
                <th className="text-right">შემოსავალი</th>
                <th className="text-right">ხარჯი</th>
                <th className="text-right">მოგება</th>
                <th className="text-right">მარჟა</th>
              </tr>
            </thead>
            <tbody>
              {d.months.map((m) => (
                <tr key={m.label}>
                  <td className="font-semibold">{m.label}</td>
                  <td className="text-center">{m.events}</td>
                  <td className="text-right" style={{ color: "var(--green)" }}>{gel(m.income)}</td>
                  <td className="text-right" style={{ color: "var(--red)" }}>{gel(m.costs)}</td>
                  <td className="text-right font-bold">{gel(m.profit)}</td>
                  <td className="text-right">{(m.margin * 100).toFixed(0)}%</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td className="font-extrabold">სულ</td>
                <td className="text-center font-bold">{d.events}</td>
                <td className="text-right font-extrabold" style={{ color: "var(--green)" }}>{gel(d.income)}</td>
                <td className="text-right font-extrabold" style={{ color: "var(--red)" }}>{gel(d.costs)}</td>
                <td className="text-right font-extrabold">{gel(d.dayProfit)}</td>
                <td className="text-right font-bold">{(d.margin * 100).toFixed(0)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
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
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span className={strong ? "text-lg font-extrabold" : "font-semibold"} style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
