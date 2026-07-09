import Link from "next/link";
import {
  CalendarHeart,
  CircleDollarSign,
  HandCoins,
  Hourglass,
  Plus,
  Wallet,
} from "lucide-react";
import { getActiveVenue } from "@/lib/venue";
import { getDashboardStats, bookingTotal } from "@/lib/queries";
import { gel, fmtDateShort } from "@/lib/format";
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
  const stats = await getDashboardStats(venue.id);

  return (
    <>
      <PageHeader
        title={venue.name}
        subtitle="ბიზნესის მიმოხილვა — რეალური მონაცემები"
        action={
          <Link href="/bookings" className="btn btn-primary">
            <Plus size={16} /> ახალი ჯავშანი
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarHeart}
          label="მომავალი ივენთები"
          value={String(stats.upcomingCount)}
          hint={`სულ აქტიური ჯავშანი: ${stats.totalBookings}`}
          tone="primary"
        />
        <StatCard
          icon={CircleDollarSign}
          label="მოსალოდნელი შემოსავალი"
          value={gel(stats.pipeline)}
          hint="მომავალი ივენთების ღირებულება"
          tone="gold"
        />
        <StatCard
          icon={Hourglass}
          label="მისაღები თანხა"
          value={gel(stats.outstanding)}
          hint="ჯავშნებზე დარჩენილი გადასახდელი"
          tone="red"
        />
        <StatCard
          icon={Wallet}
          label="ამ თვის ბალანსი"
          value={gel(stats.monthIncome - stats.monthSpent)}
          hint={`შემოსავალი ${gel(stats.monthIncome)} · ხარჯი ${gel(stats.monthSpent)}`}
          tone={stats.monthIncome - stats.monthSpent >= 0 ? "green" : "red"}
        />
      </div>

      <div className="mt-6">
        <Section title="უახლოესი ივენთები">
          {stats.upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarHeart}
              title="მომავალი ივენთი ჯერ არ არის"
              text="დაამატე პირველი ჯავშანი და აქ გამოჩნდება უახლოესი ივენთები თარიღებით და თანხებით."
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
                    <th>სტატუსი</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcoming.map((b) => (
                    <tr key={b.id}>
                      <td className="whitespace-nowrap font-semibold">
                        {fmtDateShort(b.eventDate)}
                      </td>
                      <td>
                        <div className="font-semibold">{b.title}</div>
                        {b.clientName && (
                          <div className="text-xs" style={{ color: "var(--text-3)" }}>
                            {b.clientName}
                          </div>
                        )}
                      </td>
                      <td>{EVENT_TYPE_LABELS[b.eventType] ?? b.eventType}</td>
                      <td>{b.guestCount}</td>
                      <td className="font-semibold">{gel(bookingTotal(b))}</td>
                      <td>
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Section title="დღის რეესტრი">
          <EmptyState
            icon={HandCoins}
            title="დღის ოპერაციები"
            text="ყოველდღიური შემოსავალი, ხარჯი და ხელფასები — დღის დახურვით (Z-რეპორტი)."
            action={
              <Link href="/register" className="btn btn-ghost">
                გადასვლა
              </Link>
            }
          />
        </Section>
        <Section title="პროგნოზი">
          <EmptyState
            icon={CircleDollarSign}
            title="ბიზნეს-მოდელი"
            text="შეავსე პარამეტრები (ფასი სტუმარზე, კვების ღირებულება, ფიქსირებული ხარჯები) და ნახე წლიური პროგნოზი."
            action={
              <Link href="/forecast" className="btn btn-ghost">
                გადასვლა
              </Link>
            }
          />
        </Section>
      </div>
    </>
  );
}
