"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/DataTable";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import { chartTooltipProps } from "@/components/ChartTooltip";
import type { EnergyEstimate, EnergySku } from "@/lib/data";
import { fmtGbp, fmtNumber, monthLabel } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function EnergyClient({ data }: { data: EnergyEstimate }) {
  const momChart = useMemo(
    () => data.monthly.map((r) => ({ ...r, label: monthLabel(r.month) })),
    [data.monthly],
  );
  const routeChart = useMemo(
    () => [...data.by_route].sort((a, b) => b.est_kwh - a.est_kwh).slice(0, 12),
    [data.by_route],
  );

  return (
    <div className="space-y-4">
      {/* Month on month */}
      <Card>
        <CardHeader right={<Pill tone="info">{data.monthly.length} months</Pill>}>Energy &amp; cost by month</CardHeader>
        <CardBody>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={momChart} margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="k" tick={{ fontSize: 11 }} unit=" kWh" width={70} />
                <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 11 }} width={60} />
                <Tooltip {...chartTooltipProps} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="k" dataKey="est_kwh" name="Est. kWh" fill="#2563eb" radius={[3, 3, 0, 0]} />
                <Line yAxisId="c" dataKey="est_cost_gbp" name="Est. £" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <DataTable
              rows={data.monthly}
              rowKey={(r) => r.month}
              defaultSort={{ id: "month", dir: "asc" }}
              pageSize={12}
              columns={[
                { id: "month", header: "Month", sortValue: (r) => r.month, cell: (r) => <span className="font-medium">{monthLabel(r.month)}</span> },
                { id: "tonnes", header: "Tonnes", align: "right", sortValue: (r) => r.tonnes, cell: (r) => fmtNumber(r.tonnes) },
                { id: "kwh", header: "Est. kWh", align: "right", sortValue: (r) => r.est_kwh, cell: (r) => fmtNumber(r.est_kwh) },
                { id: "cost", header: "Est. cost", align: "right", sortValue: (r) => r.est_cost_gbp, cell: (r) => fmtGbp(r.est_cost_gbp) },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      {/* By route */}
      <Card>
        <CardHeader right={<Pill tone="info">Top 12 routes</Pill>}>Estimated energy by route</CardHeader>
        <CardBody>
          <div style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routeChart} layout="vertical" margin={{ left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.2)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="route" type="category" tick={{ fontSize: 11 }} width={56} />
                <Tooltip {...chartTooltipProps} formatter={(v: number) => [`${fmtNumber(v)} kWh`, "Est. energy"]} />
                <Bar dataKey="est_kwh" radius={[0, 3, 3, 0]} name="Est. kWh">
                  {routeChart.map((r, i) => (
                    <Cell key={i} fill={r.press ? "#16a34a" : "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-ink-500 mt-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#16a34a] mr-1" /> press / pelleting line ·
            <span className="inline-block w-2 h-2 rounded-full bg-[#6366f1] mx-1" /> other line
          </p>
        </CardBody>
      </Card>

      {/* By product */}
      <Card>
        <CardHeader right={<Pill tone="info">Top 30</Pill>}>Estimated energy by product</CardHeader>
        <CardBody className="p-0">
          <DataTable
            rows={data.by_sku}
            rowKey={(r: EnergySku) => r.code}
            searchPlaceholder="Search product…"
            searchText={(r) => `${r.code} ${r.name}`}
            defaultSort={{ id: "est_kwh", dir: "desc" }}
            pageSize={12}
            columns={[
              { id: "name", header: "Product", sortValue: (r) => r.name, cell: (r) => <span className="text-xs truncate max-w-[220px] block">{r.name || r.code}</span> },
              { id: "batches", header: "Batches", align: "right", sortValue: (r) => r.batches, cell: (r) => r.batches.toLocaleString() },
              { id: "tonnes", header: "Tonnes", align: "right", sortValue: (r) => r.tonnes, cell: (r) => fmtNumber(r.tonnes) },
              { id: "est_kwh", header: "Est. kWh", align: "right", sortValue: (r) => r.est_kwh, cell: (r) => <span className="font-semibold">{fmtNumber(r.est_kwh)}</span> },
              { id: "cost", header: "Est. cost", align: "right", sortValue: (r) => r.est_kwh, cell: (r) => fmtGbp(Math.round(r.est_kwh * data.tariff_gbp_per_kwh)) },
            ]}
          />
        </CardBody>
      </Card>

      <p className="text-xs text-ink-500 px-1">
        Estimated figures for guidance only — epol has no on-site energy meter. Energy scales with
        tonnage at {data.model.kwh_per_t_mean} kWh/tonne; cost at £{data.tariff_gbp_per_kwh.toFixed(2)}/kWh.
      </p>
    </div>
  );
}
