"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  Clock,
  HelpCircle,
  Wallet,
} from "lucide-react";
import { bookingTotal, type BookingRow } from "@/lib/booking-shared";
import { gel, fmtDateShort, todayISO } from "@/lib/format";
import { PageHeader, StatCard, EmptyState, StatusBadge } from "@/components/ui";

type Row = BookingRow & {
  total: number;
  balance: number;
  daysUntil: number; // <0 = event already passed
  noPrice: boolean;
};

const FILTERS = [
  { key: "due", label: "გადასახდელი" },
  { key: "overdue", label: "ვადაგადაცილებული" },
  { key: "upcoming", label: "მომავალი" },
  { key: "noprice", label: "ფასი დაუდგენელი" },
  { key: "all", label: "ყველა" },
];

export default function ReceivablesClient({ bookings }: { bookings: BookingRow[] }) {
  const [filter, setFilter] = useState("due");
  const today = todayISO();

  const rows = useMemo<Row[]>(() => {
    return bookings
      .filter((b) => b.status !== "cancelled")
      .map((b) => {
        const total = bookingTotal(b);
        const balance = Math.max(total - b.paidTotal, 0);
        const dayMs = 86400000;
        const daysUntil = Math.round(
          (new Date(b.eventDate + "T00:00:00").getTime() -
            new Date(today + "T00:00:00").getTime()) /
            dayMs,
        );
        return { ...b, total, balance, daysUntil, noPrice: total <= 0 };
      });
  }, [bookings, today]);

  const stats = useMemo(() => {
    const withBalance = rows.filter((r) => !r.noPrice && r.balance > 0);
    return {
      outstanding: withBalance.reduce((s, r) => s + r.balance, 0),
      overdue: withBalance
        .filter((r) => r.daysUntil < 0)
        .reduce((s, r) => s + r.balance, 0),
      overdueCount: withBalance.filter((r) => r.daysUntil < 0).length,
      upcoming: withBalance
        .filter((r) => r.daysUntil >= 0)
        .reduce((s, r) => s + r.balance, 0),
      noPriceCount: rows.filter(
        (r) => r.noPrice && r.status !== "completed" && r.daysUntil >= 0,
      ).length,
    };
  }, [rows]);

  const list = useMemo(() => {
    let r = rows;
    if (filter === "due") r = rows.filter((x) => !x.noPrice && x.balance > 0);
    else if (filter === "overdue")
      r = rows.filter((x) => !x.noPrice && x.balance > 0 && x.daysUntil < 0);
    else if (filter === "upcoming")
      r = rows.filter((x) => !x.noPrice && x.balance > 0 && x.daysUntil >= 0);
    else if (filter === "noprice")
      r = rows.filter((x) => x.noPrice && x.status !== "completed");
    // urgency: overdue first (most overdue on top), then soonest upcoming
    return [...r].sort((a, b) => a.daysUntil - b.daysUntil);
  }, [rows, filter]);

  return (
    <>
      <PageHeader
        title="გადასახდელები"
        subtitle="ვის რამდენი აქვს გადასახდელი — ვადაგადაცილებული და მომავალი ღონისძიებები"
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="სულ მისაღები"
          value={gel(stats.outstanding)}
          tone={stats.outstanding > 0 ? "red" : "green"}
        />
        <StatCard
          icon={AlertTriangle}
          label="ვადაგადაცილებული"
          value={gel(stats.overdue)}
          hint={stats.overdueCount > 0 ? `${stats.overdueCount} ღონისძიება` : "ყველა დროულია"}
          tone={stats.overdue > 0 ? "red" : "green"}
        />
        <StatCard
          icon={Clock}
          label="მომავალი ღონისძიებები"
          value={gel(stats.upcoming)}
          tone="gold"
        />
        <StatCard
          icon={HelpCircle}
          label="ფასი დაუდგენელი"
          value={String(stats.noPriceCount)}
          hint="მომავალი ჯავშნები ფასის გარეშე"
          tone={stats.noPriceCount > 0 ? "gold" : "default"}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="btn !py-1.5 !text-sm"
            style={
              filter === f.key
                ? { background: "var(--text)", color: "var(--surface)" }
                : { background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }
            }
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={CircleDollarSign}
          title="აქ ცარიელია"
          text={
            filter === "due" || filter === "overdue"
              ? "ყველა ღონისძიება გადახდილია — გილოცავ! 🎉"
              : "ამ ფილტრში ჩანაწერი არ არის."
          }
        />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ღონისძიება</th>
                <th>თარიღი</th>
                <th className="text-right">ღირებულება</th>
                <th className="text-right">გადახდილი</th>
                <th className="text-right">ნაშთი</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/bookings/${r.id}`}
                      className="font-semibold hover:underline"
                    >
                      {r.title}
                    </Link>
                    {r.clientPhone && (
                      <div className="text-xs" style={{ color: "var(--text-3)" }}>
                        {r.clientPhone}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <div>{fmtDateShort(r.eventDate)}</div>
                    <DueChip daysUntil={r.daysUntil} paid={!r.noPrice && r.balance <= 0} />
                  </td>
                  <td className="text-right">
                    {r.noPrice ? (
                      <span style={{ color: "var(--text-3)" }}>—</span>
                    ) : (
                      gel(r.total)
                    )}
                  </td>
                  <td className="text-right" style={{ color: "var(--green)" }}>
                    {gel(r.paidTotal)}
                  </td>
                  <td className="text-right font-bold">
                    {r.noPrice ? (
                      <span className="badge" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                        ფასი?
                      </span>
                    ) : r.balance > 0 ? (
                      <span style={{ color: "var(--red)" }}>{gel(r.balance)}</span>
                    ) : (
                      <span style={{ color: "var(--green)" }}>✓</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <StatusBadge status={r.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function DueChip({ daysUntil, paid }: { daysUntil: number; paid: boolean }) {
  if (paid) return null;
  if (daysUntil < 0)
    return (
      <span className="text-xs font-bold" style={{ color: "var(--red)" }}>
        {Math.abs(daysUntil)} დღით ვადაგადაცილ.
      </span>
    );
  if (daysUntil === 0)
    return (
      <span className="text-xs font-bold" style={{ color: "var(--amber)" }}>
        დღეს!
      </span>
    );
  if (daysUntil <= 7)
    return (
      <span className="text-xs font-bold" style={{ color: "var(--amber)" }}>
        {daysUntil} დღეში
      </span>
    );
  return (
    <span className="text-xs" style={{ color: "var(--text-3)" }}>
      {daysUntil} დღეში
    </span>
  );
}
