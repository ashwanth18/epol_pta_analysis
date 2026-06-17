"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BellRing, BookOpen, Boxes, Database, GaugeCircle, GitFork, Home, ShieldCheck, Waypoints, Wrench, Zap } from "lucide-react";

const items = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/explorer", label: "Data Explorer", icon: Database },
  { href: "/process-flow", label: "Process Flow", icon: Waypoints },
  { href: "/knowledge-graph", label: "Knowledge Graph", icon: GitFork },
  { href: "/gap-analysis", label: "Gap Analysis", icon: ShieldCheck },
  { href: "/commercial", label: "Commercial", icon: Activity },
  { href: "/throughput", label: "Throughput & Cycle Time", icon: GaugeCircle },
  { href: "/energy", label: "Estimated Energy", icon: Zap },
  { href: "/alarms", label: "Alarms & Conformance", icon: BellRing },
  { href: "/pdm", label: "Predictive Maintenance", icon: Wrench },
  { href: "/certificates", label: "Batch Certificates", icon: BookOpen },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <aside className="w-64 flex-shrink-0 border-r border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 min-h-screen">
      <div className="p-5 border-b border-ink-200 dark:border-ink-800">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-accent" />
          <div>
            <div className="font-semibold text-sm">epol PTA Analytics</div>
            <div className="text-[11px] text-ink-500">Feed Mill Intelligence</div>
          </div>
        </div>
      </div>
      <nav className="p-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-accent-50 text-accent dark:bg-accent/15 dark:text-accent-50"
                  : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800",
              ].join(" ")}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 mt-2 text-[11px] text-ink-500">
        <div>Data refresh: <code className="text-ink-700 dark:text-ink-300">npm run export-data</code></div>
      </div>
    </aside>
  );
}
