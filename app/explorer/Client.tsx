"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Pill, Stat } from "@/components/ui";
import type { Inventory, InventoryTable, WeighmentAnalytics } from "@/lib/data";
import { fmtKb } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { chartTooltipProps } from "@/components/ChartTooltip";
import { WeighmentPerformance } from "./WeighmentPerformance";

interface DbfPage {
  table: string;
  fields: string[];
  total: number;
  offset: number;
  limit: number;
  search: string;
  rows: Record<string, string | number | boolean | null>[];
  error?: string;
  message?: string;
}

const FIELD_TYPES: Record<string, string> = {
  C: "character",
  N: "numeric",
  F: "float",
  D: "date",
  L: "logical",
  M: "memo",
  T: "datetime",
  I: "integer",
  Y: "currency",
  B: "double",
};

const PAGE_SIZE = 25;
const DATA_PAGE_SIZES = [50, 100, 250, 500];

function formatCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  const s = String(value);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function TableDataView({ tableName, recordCount }: { tableName: string; recordCount: number }) {
  const [data, setData] = useState<DbfPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        table: tableName,
        offset: String(offset),
        limit: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/explorer/data?${params}`);
      const json = (await res.json()) as DbfPage;
      if (!res.ok) {
        setData(null);
        setError(json.message ?? json.error ?? "Failed to load data");
        return;
      }
      setData(json);
    } catch {
      setData(null);
      setError("Network error loading DBF rows");
    } finally {
      setLoading(false);
    }
  }, [tableName, offset, pageSize, search]);

  useEffect(() => {
    setOffset(0);
    setSearch("");
    setSearchInput("");
  }, [tableName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const total = data?.total ?? recordCount;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.floor(offset / pageSize) + 1;
  const fields = data?.fields ?? [];
  const rows = data?.rows ?? [];

  return (
    <Card>
      <CardHeader
        right={
          <Pill tone="info">
            {total.toLocaleString()} row{total === 1 ? "" : "s"}
            {search ? " (filtered)" : ""}
          </Pill>
        }
      >
        Full dataset
      </CardHeader>
      <CardBody className="p-0">
        <div className="px-4 py-3 border-b border-ink-200 dark:border-ink-700 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[11px] text-ink-500 block mb-1">Search rows</label>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setOffset(0);
                  setSearch(searchInput);
                }
              }}
              placeholder="Filter across all columns…"
              className="w-full text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setOffset(0);
              setSearch(searchInput);
            }}
            className="text-xs px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setOffset(0);
              }}
              className="text-xs px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              Clear
            </button>
          )}
          <div>
            <label className="text-[11px] text-ink-500 block mb-1">Rows per page</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setOffset(0);
              }}
              className="text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
            >
              {DATA_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <div className="px-4 py-8 text-sm text-ink-500 text-center">Loading rows from epolPTA latest snapshot · {tableName}…</div>
        )}

        {!loading && error && (
          <div className="px-4 py-8 text-sm text-red-600 dark:text-red-400 text-center">{error}</div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="px-4 py-8 text-sm text-ink-500 text-center">
            {search ? "No rows match the search filter." : "This table has no records."}
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-ink-500 w-12">#</th>
                  {fields.map((f) => (
                    <th key={f} className="px-3 py-2 font-medium font-mono text-xs whitespace-nowrap">
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={offset + i} className="border-b border-ink-100 dark:border-ink-800 hover:bg-ink-50/50 dark:hover:bg-ink-800/50">
                    <td className="px-3 py-1.5 text-ink-500 tabular-nums text-xs">{offset + i + 1}</td>
                    {fields.map((f) => (
                      <td key={f} className="px-3 py-1.5 font-mono text-xs whitespace-nowrap max-w-[240px] truncate" title={row[f] != null ? String(row[f]) : undefined}>
                        {formatCell(row[f])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-ink-200 dark:border-ink-700">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - pageSize))}
              className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-ink-500">
              Rows {Math.min(offset + 1, total).toLocaleString()}–{Math.min(offset + pageSize, total).toLocaleString()} of {total.toLocaleString()} · page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={offset + pageSize >= total}
              onClick={() => setOffset(offset + pageSize)}
              className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-40"
            >
              Next →
            </button>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(0)}
                className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-40"
              >
                First
              </button>
              <button
                type="button"
                disabled={offset + pageSize >= total}
                onClick={() => setOffset((totalPages - 1) * pageSize)}
                className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function ExplorerClient({ inventory, weighments }: { inventory: Inventory; weighments: WeighmentAnalytics }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [purpose, setPurpose] = useState("ALL");
  const [hideMirrors, setHideMirrors] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(true);
  const [minRecords, setMinRecords] = useState(0);
  const [sortBy, setSortBy] = useState<"records" | "name" | "size" | "fields" | "related">("records");
  const [selected, setSelected] = useState("BSTARTS.DBF");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    let list = inventory.tables.filter((t) => {
      if (hideMirrors && t.c === "Schema mirror") return false;
      if (hideEmpty && t.rec === 0) return false;
      if (category !== "ALL" && t.c !== category) return false;
      if (purpose !== "ALL" && t.p !== purpose) return false;
      if (t.rec < minRecords) return false;
      if (q) {
        if (t.n.toUpperCase().includes(q)) return true;
        if (t.w.toUpperCase().includes(q)) return true;
        if (t.s.toUpperCase().includes(q)) return true;
        if (t.f.some((f) => f.n.toUpperCase().includes(q))) return true;
        return false;
      }
      return true;
    });
    if (sortBy === "records") list = [...list].sort((a, b) => b.rec - a.rec);
    else if (sortBy === "name") list = [...list].sort((a, b) => a.n.localeCompare(b.n));
    else if (sortBy === "size") list = [...list].sort((a, b) => b.kb - a.kb);
    else if (sortBy === "fields") list = [...list].sort((a, b) => b.nf - a.nf);
    else if (sortBy === "related") list = [...list].sort((a, b) => b.r.length - a.r.length);
    return list;
  }, [inventory, query, category, purpose, hideMirrors, hideEmpty, minRecords, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const selectedTable: InventoryTable =
    inventory.tables.find((t) => t.n === selected) ?? inventory.tables[0];

  const catChart = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of filtered) m[t.c] = (m[t.c] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const recChart = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of filtered) m[t.c] = (m[t.c] || 0) + t.rec;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const setF = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <WeighmentPerformance data={weighments} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat value={inventory.total.toString()} label="Tables" />
        <Stat value={(inventory.total_records / 1_000_000).toFixed(2) + "M"} label="Records" tone="info" />
        <Stat value={Object.keys(inventory.cats).length.toString()} label="Categories" />
        <Stat value={(inventory.purps["Setup mirror"] || 0).toString()} label="Setup mirrors" tone="amber" />
        <Stat value={filtered.length.toString()} label="Matching filter" tone="green" />
      </div>

      <Card>
        <CardHeader>Filters</CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
            <div>
              <label className="text-[11px] text-ink-500 block mb-1">Search</label>
              <input
                type="search"
                value={query}
                onChange={(e) => setF(setQuery)(e.target.value)}
                placeholder="BWEIGH, LOG_BATCH, alarm…"
                className="w-full text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-500 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setF(setCategory)(e.target.value)}
                className="w-full text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
              >
                <option value="ALL">All categories ({inventory.total})</option>
                {Object.entries(inventory.cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
                  <option key={c} value={c}>{c} ({n})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-500 block mb-1">Purpose</label>
              <select
                value={purpose}
                onChange={(e) => setF(setPurpose)(e.target.value)}
                className="w-full text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
              >
                <option value="ALL">All purposes</option>
                {Object.entries(inventory.purps).sort((a, b) => b[1] - a[1]).map(([p, n]) => (
                  <option key={p} value={p}>{p} ({n})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-500 block mb-1">Min records</label>
              <select
                value={minRecords}
                onChange={(e) => setF(setMinRecords)(parseInt(e.target.value, 10))}
                className="w-full text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
              >
                {[0, 1, 10, 100, 1000, 10000].map((v) => (
                  <option key={v} value={v}>{v === 0 ? "Show all" : `≥ ${v.toLocaleString()}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-500 block mb-1">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "records" | "name" | "size" | "fields" | "related")}
                className="w-full text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
              >
                <option value="records">Records (desc)</option>
                <option value="name">Name (A→Z)</option>
                <option value="size">File size (desc)</option>
                <option value="fields">Field count (desc)</option>
                <option value="related">Related tables (desc)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hideMirrors} onChange={(e) => setF(setHideMirrors)(e.target.checked)} />
              <span>Hide schema mirrors (S*)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setF(setHideEmpty)(e.target.checked)} />
              <span>Hide empty tables</span>
            </label>
            <div className="ml-auto text-ink-500">Showing {filtered.length.toLocaleString()} of {inventory.total.toLocaleString()} tables</div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>Tables per category (filtered)</CardHeader>
          <CardBody>
            <div style={{ height: Math.max(280, catChart.length * 26) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catChart} layout="vertical" margin={{ left: 110 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip {...chartTooltipProps} cursor={{ fill: "rgba(47,111,235,0.1)" }} />
                  <Bar dataKey="value" fill="#2f6feb" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Records per category</CardHeader>
          <CardBody>
            <div style={{ height: Math.max(280, recChart.length * 26) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recChart} layout="vertical" margin={{ left: 110 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip {...chartTooltipProps} cursor={{ fill: "rgba(217,119,6,0.1)" }} />
                  <Bar dataKey="value" fill="#d97706" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader right={<div className="text-xs text-ink-500">Page {safePage + 1} of {totalPages}</div>}>Table catalog</CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">Table</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Purpose</th>
                  <th className="px-4 py-2 font-medium text-right">Records</th>
                  <th className="px-4 py-2 font-medium text-right">Fields</th>
                  <th className="px-4 py-2 font-medium text-right">Size</th>
                  <th className="px-4 py-2 font-medium text-right">Related</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => (
                  <tr
                    key={t.n}
                    onClick={() => setSelected(t.n)}
                    className={[
                      "border-b border-ink-100 dark:border-ink-800 cursor-pointer hover:bg-accent-50/50 dark:hover:bg-accent/5",
                      t.n === selected ? "bg-accent-50 dark:bg-accent/10" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-2 font-mono text-xs font-semibold">{t.n}</td>
                    <td className="px-4 py-2 text-ink-600 dark:text-ink-300">{t.c}</td>
                    <td className="px-4 py-2 text-ink-600 dark:text-ink-300">{t.p}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.rec.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.nf}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtKb(t.kb)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.r.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 border-t border-ink-200 dark:border-ink-700">
            <button onClick={() => setPage(Math.max(0, safePage - 1))} className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded hover:bg-ink-100 dark:hover:bg-ink-800">← Previous</button>
            <span className="text-xs text-ink-500">Page {safePage + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded hover:bg-ink-100 dark:hover:bg-ink-800">Next →</button>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setPage(0)} className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded hover:bg-ink-100 dark:hover:bg-ink-800">First</button>
              <button onClick={() => setPage(totalPages - 1)} className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded hover:bg-ink-100 dark:hover:bg-ink-800">Last</button>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader right={<Pill tone="info">{selectedTable.c}</Pill>}>
              <span className="font-mono">{selectedTable.n}</span> · {selectedTable.p}
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <Stat value={selectedTable.rec.toLocaleString()} label="Records" />
                <Stat value={selectedTable.nf.toString()} label="Fields" />
                <Stat value={fmtKb(selectedTable.kb)} label="File size" />
                <Stat value={selectedTable.r.length.toString()} label="Related tables" />
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-1">What this table records</div>
                  <div className="text-ink-700 dark:text-ink-300">{selectedTable.w}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-1">Sensors / data source</div>
                  <div className="text-ink-700 dark:text-ink-300">{selectedTable.s}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-1">Why it matters</div>
                  <div className="text-ink-700 dark:text-ink-300">{selectedTable.y}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Schema · {selectedTable.f.length} of {selectedTable.nf} fields shown</CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium">Field</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium text-right">Length</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTable.f.map((f) => (
                      <tr key={f.n} className="border-b border-ink-100 dark:border-ink-800">
                        <td className="px-4 py-1.5 font-mono text-xs">{f.n}</td>
                        <td className="px-4 py-1.5 text-ink-600 dark:text-ink-300">{f.t} <span className="text-ink-500">({FIELD_TYPES[f.t] || "unknown"})</span></td>
                        <td className="px-4 py-1.5 text-right tabular-nums">{f.l}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <TableDataView tableName={selectedTable.n} recordCount={selectedTable.rec} />
        </div>

        <Card>
          <CardHeader>Related tables · shared fields</CardHeader>
          <CardBody>
            {selectedTable.r.length === 0 ? (
              <div className="text-sm text-ink-500">No shared-field relationships detected (or all shared fields are too generic).</div>
            ) : (
              <div className="space-y-2">
                {selectedTable.r.map((r) => (
                  <button
                    key={r.n}
                    onClick={() => setSelected(r.n)}
                    className="w-full text-left p-3 border border-ink-200 dark:border-ink-700 rounded-md hover:border-accent hover:bg-accent-50/40 dark:hover:bg-accent/5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-semibold">{r.n}</span>
                      <Pill tone="info">{r.s} shared</Pill>
                    </div>
                    <div className="text-[11px] text-ink-500">via {r.f.join(", ")}</div>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
