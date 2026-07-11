"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarHeart,
  BookOpenCheck,
  Wallet,
  TrendingUp,
  Boxes,
  Truck,
  Calculator,
  Settings,
  Building2,
  LogOut,
} from "lucide-react";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "დაფა", icon: LayoutDashboard },
  { href: "/bookings", label: "ჯავშნები", icon: CalendarHeart },
  { href: "/register", label: "დღის რეესტრი", icon: BookOpenCheck },
  { href: "/finance", label: "ფინანსები", icon: Wallet },
  { href: "/forecast", label: "პროგნოზები", icon: TrendingUp },
  { href: "/inventory", label: "ინვენტარიზაცია", icon: Boxes },
  { href: "/suppliers", label: "მომწოდებლები", icon: Truck },
  { href: "/calc", label: "კალკულაციები", icon: Calculator },
  { href: "/settings", label: "პარამეტრები", icon: Settings },
];

type Venue = { id: number; name: string };

export default function Sidebar({
  venues,
  activeVenueId,
}: {
  venues: Venue[];
  activeVenueId: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function switchVenue(id: string) {
    document.cookie = `venue=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push("/");
    router.refresh();
  }

  return (
    <aside
      className="sticky top-0 flex h-screen w-64 shrink-0 flex-col px-4 py-5"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3 px-2">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
          style={{ background: "var(--primary)" }}
        >
          <Building2 size={20} strokeWidth={2} />
        </span>
        <div>
          <div className="text-base font-extrabold tracking-tight">VenueOS</div>
          <div className="text-[11px] font-medium" style={{ color: "var(--text-3)" }}>
            ივენთ ჰოლის მართვა
          </div>
        </div>
      </div>

      <div className="mt-5 px-1">
        <label className="label">ობიექტი</label>
        <select
          className="select"
          value={activeVenueId}
          onChange={(e) => switchVenue(e.target.value)}
        >
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={18} strokeWidth={2.1} />
              {label}
            </Link>
          );
        })}
      </nav>

      <form action={logout} className="mt-3">
        <button type="submit" className="nav-item w-full" style={{ color: "var(--text-2)" }}>
          <LogOut size={18} strokeWidth={2.1} />
          გამოსვლა
        </button>
      </form>

      <div
        className="mt-3 rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
        style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
      >
        ყველა მონაცემი ინახება არჩეული ობიექტისთვის ცალ-ცალკე.
      </div>
    </aside>
  );
}
