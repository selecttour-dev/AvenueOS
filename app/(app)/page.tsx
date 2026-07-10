import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarHeart,
  ChevronRight,
  CircleDollarSign,
  Hourglass,
  Lock,
  Plus,
  Target,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { getActiveVenue } from "@/lib/venue";
import { getDashboardStats, bookingTotal } from "@/lib/queries";
import { gel, fmtDateShort, monthNameKa } from "@/lib/format";
import {
  PageHeader,
  StatCard,
  Section,
  EmptyState,
  StatusBadge,
  EVENT_TYPE_LABELS,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const venue = await getActiveVenue();
  if (!venue) return null;
  const s = await getDashboardStats(venue.id);

  const attention = [
    s.outstandingCount > 0 && {
      href: "/bookings",
      icon: Hourglass,
      text: `${s.outstandingCount} ჯავშანი გადაუხდელი`,
      hint: gel(s.outstanding),
    },
    s.lowStockCount > 0 && {
      href: "/inventory",
      icon: Boxes,
      text: `${s.lowStockCount} პოზიცია მარაგში ცოტაა`,
      hint: "შესავსებია",
    },
    s.unclosedDaysCount > 0 && {
      href: "/register",
      icon: Lock,
      text: `${s.unclosedDaysCount} დღე დახურვის მომლოდინე`,
      hint: "Z-რეპორტი",
    },
    s.supplierDebt > 0.01 && {
      href: "/suppliers",
      icon: Truck,
      text: "მომწოდებლების ვალი",
      hint: gel(s.supplierDebt),
    },
  ].filter(Boolean) as {
    href: string;
    icon: typeof Hourglass;
    text: string;
    hint: string;
  }[];

  const monthName = monthNameKa(Number(s.today.slice(5, 7)) - 1);

  return (
    <>
      <PageHeader
        title={venue.name}
        subtitle="ბიზნესის მართვის ცენტრი — რეალური მონაცემები"
        action={
          <Link href="/bookings" className="btn btn-primary">
            <Plus size={16} /> ახალი ჯავშანი
          </Link>
        }
      />

      {(s.todayEvents.length > 0 || attention.length > 0) && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {s.todayEvents.length > 0 && (
            <div
              className="rounded-xl px-5 py-4"
              style={{ background: "var(--primary-soft)", border: "1px solid var(--border)" }}
            >
              <div
                className="flex items-center gap-2 text-sm font-bold"
                style={{ color: "var(--primary-strong)" }}
              >
                <CalendarHeart size={16} /> დღეს ივენთია
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {s.todayEvents.map((b) => (
                  <Link
                    key={b.id}
                    href={`/bookings/${b.id}`}
                    className="flex items-center justify-between font-semibold underline"
                    style={{ color: "var(--primary-strong)" }}
                  >
                    <span>{b.title}</span>
                    <span className="text-xs">{b.guestCount} სტუმარი</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {attention.length > 0 && (
            <div className="card p-2">
              <div
                className="flex items-center gap-2 px-3 py-2 text-sm font-bold"
                style={{ color: "var(--amber)" }}
              >
                <AlertTriangle size={16} /> ყურადღება სჭირდება
              </div>
              <div className="flex flex-col">
                {attention.map((a) => (
                  <Link
                    key={a.href + a.text}
                    href={a.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <a.icon size={16} style={{ color: "var(--amber)" }} />
                    <span className="flex-1 text-sm font-medium">{a.text}</span>
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>
                      {a.hint}
                    </span>
                    <ChevronRight size={15} style={{ color: "var(--text-3)" }} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarHeart}
          label="მომავალი ივენთები"
          value={String(s.upcomingCount)}
          hint={`სულ აქტიური ჯავშანი: ${s.totalBookings}`}
          tone="primary"
        />
        <StatCard
          icon={CircleDollarSign}
          label="მოსალოდნელი შემოსავალი"
          value={gel(s.pipeline)}
          hint="მომავალი ივენთების ღირებულება"
          tone="gold"
        />
        <StatCard
          icon={Hourglass}
          label="მისაღები თანხა"
          value={gel(s.outstanding)}
          hint={s.outstandingCount > 0 ? `${s.outstandingCount} ჯავშანზე` : "ყველა გადახდილია"}
          tone={s.outstanding > 0 ? "red" : "green"}
        />
        <StatCard
          icon={Wallet}
          label={`${monthName} — სუფთა`}
          value={gel(s.monthNet)}
          hint={`შემოს. ${gel(s.monthIncome)} · ხარჯი ${gel(s.monthSpent)}`}
          tone={s.monthNet >= 0 ? "green" : "red"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section
            title={`${monthName} — ფულადი ნაკადი`}
            action={
              <Link href="/register" className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                რეესტრი →
              </Link>
            }
          >
            <CashflowSparkline dailyNet={s.dailyNet} today={s.today} />
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <MiniStat label="შემოსავალი" value={gel(s.monthIncome)} color="var(--green)" />
              <MiniStat label="ხარჯი" value={gel(s.monthSpent)} color="var(--red)" />
              <MiniStat
                label="სუფთა"
                value={gel(s.monthNet)}
                color={s.monthNet >= 0 ? "var(--green)" : "var(--red)"}
              />
            </div>
          </Section>
        </div>

        <BusinessModelCard
          monthEvents={s.monthEventsCount}
          breakEven={s.breakEven}
          contribution={s.contribution}
          monthlyFixed={s.monthlyFixed}
          hasModel={s.hasModel}
        />
      </div>

      <div className="mt-6">
        <Section
          title="უახლოესი ივენთები"
          action={
            <Link href="/bookings" className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
              ყველა →
            </Link>
          }
        >
          {s.upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarHeart}
              title="მომავალი ივენთი ჯერ არ არის"
              text="დაამატე პირველი ჯავშანი და აქ გამოჩნდება უახლოესი ივენთები თარიღებით და გადახდის მდგომარეობით."
              action={
                <Link href="/bookings" className="btn btn-primary">
                  <Plus size={16} /> ჯავშნის დამატება
                </Link>
              }
            />
          ) : (
            <div className="table-wrap -m-5">
              <table className="table">
                <thead>
                  <tr>
                    <th>თარიღი</th>
                    <th>ივენთი</th>
                    <th>ტიპი</th>
                    <th>სტუმარი</th>
                    <th>ღირებულება</th>
                    <th>გადახდა</th>
                    <th>სტატუსი</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {s.upcoming.map((b) => {
                    const total = bookingTotal(b);
                    const left = Math.max(total - b.paidTotal, 0);
                    return (
                      <tr key={b.id}>
                        <td className="whitespace-nowrap font-semibold">
                          {fmtDateShort(b.eventDate)}
                        </td>
                        <td>
                          <Link
                            href={`/bookings/${b.id}`}
                            className="font-semibold hover:underline"
                          >
                            {b.title}
                          </Link>
                          {b.clientName && (
                            <div className="text-xs" style={{ color: "var(--text-3)" }}>
                              {b.clientName}
                            </div>
                          )}
                        </td>
                        <td>{EVENT_TYPE_LABELS[b.eventType] ?? b.eventType}</td>
                        <td>{b.guestCount}</td>
                        <td className="font-semibold">{gel(total)}</td>
                        <td>
                          {left > 0 ? (
                            <span className="text-xs font-semibold" style={{ color: "var(--red)" }}>
                              დარჩა {gel(left)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold" style={{ color: "var(--green)" }}>
                              გადახდილია
                            </span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={b.status} />
                        </td>
                        <td>
                          <Link href={`/bookings/${b.id}`} style={{ color: "var(--text-3)" }}>
                            <ChevronRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
      <div className="text-xs" style={{ color: "var(--text-3)" }}>
        {label}
      </div>
      <div className="mt-0.5 font-extrabold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function CashflowSparkline({
  dailyNet,
  today,
}: {
  dailyNet: { day: number; net: number }[];
  today: string;
}) {
  const maxAbs = Math.max(1, ...dailyNet.map((d) => Math.abs(d.net)));
  const todayDay = Number(today.slice(8, 10));
  const hasData = dailyNet.some((d) => d.net !== 0);

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-xl text-sm"
        style={{ height: 120, background: "var(--surface-2)", color: "var(--text-3)" }}
      >
        ამ თვეს ჯერ ოპერაცია არ დაფიქსირებულა
      </div>
    );
  }

  return (
    <div className="flex items-end gap-0.5" style={{ height: 120 }}>
      {dailyNet.map((d) => {
        const h = (Math.abs(d.net) / maxAbs) * 100;
        const isToday = d.day === todayDay;
        const pos = d.net >= 0;
        return (
          <div
            key={d.day}
            title={`${d.day} — ${gel(d.net)}`}
            className="flex flex-1 flex-col justify-end"
            style={{ height: "100%" }}
          >
            <div
              className="w-full rounded-sm"
              style={{
                height: `${Math.max(h, d.net !== 0 ? 4 : 1)}%`,
                background:
                  d.net === 0 ? "var(--border)" : pos ? "var(--green)" : "var(--red)",
                opacity: isToday ? 1 : 0.8,
                outline: isToday ? "1.5px solid var(--text)" : "none",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function BusinessModelCard({
  monthEvents,
  breakEven,
  contribution,
  monthlyFixed,
  hasModel,
}: {
  monthEvents: number;
  breakEven: number | null;
  contribution: number;
  monthlyFixed: number;
  hasModel: boolean;
}) {
  const pct =
    breakEven && breakEven > 0 ? Math.min((monthEvents / breakEven) * 100, 100) : 0;
  const covered = breakEven != null && monthEvents >= breakEven;

  return (
    <Section
      title="ბიზნეს-მოდელი"
      action={
        <Link href="/forecast" className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
          პროგნოზი →
        </Link>
      }
    >
      {monthlyFixed === 0 && !hasModel ? (
        <EmptyState
          icon={Target}
          title="მოდელი ჯერ არ არის"
          text="დაამატე ფიქსირებული ხარჯები და შეავსე მოდელი — გამოჩნდება break-even."
          action={
            <Link href="/finance" className="btn btn-ghost">
              ფინანსები <ArrowRight size={15} />
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <div className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
              ნულზე გასასვლელად / თვე
            </div>
            <div className="mt-1 text-3xl font-extrabold" style={{ color: "var(--primary-strong)" }}>
              {breakEven == null ? "—" : breakEven.toFixed(1)}
            </div>
            <div className="text-xs" style={{ color: "var(--text-3)" }}>
              ივენთი ({gel(monthlyFixed)} ფიქს. ხარჯი)
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span style={{ color: "var(--text-2)" }}>ამ თვის ივენთები</span>
              <span className="font-bold">
                {monthEvents}
                {breakEven != null ? ` / ${breakEven.toFixed(1)}` : ""}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: covered ? "var(--green)" : "var(--primary)",
                }}
              />
            </div>
            {breakEven != null && (
              <p
                className="mt-2 text-xs font-semibold"
                style={{ color: covered ? "var(--green)" : "var(--text-2)" }}
              >
                {covered
                  ? "ფიქს. ხარჯი დაფარულია ✓"
                  : `კიდევ ${Math.max(breakEven - monthEvents, 0).toFixed(1)} ივენთი ნულამდე`}
              </p>
            )}
          </div>

          <div
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm"
            style={{ background: "var(--surface-2)" }}
          >
            <span style={{ color: "var(--text-2)" }}>მოგება ერთ ივენთზე</span>
            <span className="flex items-center gap-1.5 font-bold" style={{ color: contribution >= 0 ? "var(--green)" : "var(--red)" }}>
              <TrendingUp size={14} /> {gel(contribution)}
            </span>
          </div>
        </div>
      )}
    </Section>
  );
}
