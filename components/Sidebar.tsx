"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ChartColumnBig,
  CalendarHeart,
  BookOpenCheck,
  HandCoins,
  Wallet,
  TrendingUp,
  Boxes,
  Truck,
  Calculator,
  Settings,
  Building2,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "დაფა", icon: LayoutDashboard },
  { href: "/analytics", label: "ანალიტიკა", icon: ChartColumnBig },
  { href: "/bookings", label: "ჯავშნები", icon: CalendarHeart },
  { href: "/register", label: "დღის რეესტრი", icon: BookOpenCheck },
  { href: "/receivables", label: "გადასახდელები", icon: HandCoins },
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
  const [open, setOpen] = useState(false);

  const activeVenue = venues.find((v) => v.id === activeVenueId);

  function switchVenue(id: string) {
    document.cookie = `venue=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-2.5 lg:hidden"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          onClick={() => setOpen(true)}
          aria-label="მენიუ"
        >
          <Menu size={20} />
        </button>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
          style={{ background: "var(--primary)" }}
        >
          <Building2 size={17} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold leading-tight">AvenueOS</div>
          <div className="truncate text-[11px]" style={{ color: "var(--text-3)" }}>
            {activeVenue?.name ?? ""}
          </div>
        </div>
      </header>

      {/* Backdrop (mobile, when drawer open) */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgb(23 24 43 / 0.4)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar / drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 transform flex-col px-4 py-5 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 px-2">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
              style={{ background: "var(--primary)" }}
            >
              <Building2 size={20} strokeWidth={2} />
            </span>
            <div>
              <div className="text-base font-extrabold tracking-tight">AvenueOS</div>
              <div className="text-[11px] font-medium" style={{ color: "var(--text-3)" }}>
                ივენთ ჰოლის მართვა
              </div>
            </div>
          </div>
          <button
            className="rounded-lg p-1.5 lg:hidden"
            style={{ color: "var(--text-3)" }}
            onClick={() => setOpen(false)}
            aria-label="დახურვა"
          >
            <X size={20} />
          </button>
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
              <Link
                key={href}
                href={href}
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
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
    </>
  );
}
