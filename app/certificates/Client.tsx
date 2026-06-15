"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import type { CertBatch } from "@/lib/data";
import { fmtNumber } from "@/lib/format";

const PAGE_SIZE = 30;

export function CertClient({ batches }: { batches: CertBatch[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CertBatch | null>(batches[0] || null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return batches;
    return batches.filter((b) =>
      [b.log_batch, b.frm_code, b.cust_name].some((v) => (v || "").toUpperCase().includes(q)),
    );
  }, [batches, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <Card className="lg:col-span-3">
        <CardHeader>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search by batch ID, formula, or customer…"
            className="flex-1 text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800 w-full"
          />
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">Batch ID</th>
                  <th className="px-4 py-2 font-medium">Formula</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium text-right">Target (kg)</th>
                  <th className="px-4 py-2 font-medium text-right">Actual (kg)</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((b) => (
                  <tr
                    key={b.log_batch}
                    onClick={() => setSelected(b)}
                    className={[
                      "border-b border-ink-100 dark:border-ink-800 cursor-pointer hover:bg-accent-50/40 dark:hover:bg-accent/5",
                      selected?.log_batch === b.log_batch ? "bg-accent-50 dark:bg-accent/10" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-2 font-mono text-xs font-semibold">{b.log_batch}</td>
                    <td className="px-4 py-2 font-mono text-xs">{b.frm_code}</td>
                    <td className="px-4 py-2 text-ink-600 dark:text-ink-300 truncate max-w-[200px]">{b.cust_name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(b.target_wgt)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(b.actual_wgt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 border-t border-ink-200 dark:border-ink-700">
            <button onClick={() => setPage(Math.max(0, safePage - 1))} className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded">← Previous</button>
            <span className="text-xs text-ink-500">Page {safePage + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded">Next →</button>
            <div className="ml-auto text-xs text-ink-500">{filtered.length} batches</div>
          </div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader right={selected ? <Pill tone="info">Certificate</Pill> : null}>Batch detail</CardHeader>
        <CardBody>
          {!selected ? (
            <div className="text-sm text-ink-500">Select a batch from the table to preview its certificate.</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Batch ID</div>
                  <div className="font-mono font-semibold">{selected.log_batch}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Formula</div>
                  <div className="font-mono font-semibold">{selected.frm_code}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Customer</div>
                  <div className="font-semibold">{selected.cust_name}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Started</div>
                  <div className="font-mono">{selected.start}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Net weight</div>
                  <div className="tabular-nums font-semibold">{(selected.actual_wgt / 1000).toFixed(2)} t</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Target</div>
                  <div className="tabular-nums">{fmtNumber(selected.target_wgt)} kg</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Actual</div>
                  <div className="tabular-nums font-semibold">{fmtNumber(selected.actual_wgt)} kg</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Variance</div>
                  <div className={[
                    "tabular-nums font-semibold",
                    Math.abs(selected.actual_wgt - selected.target_wgt) / Math.max(selected.target_wgt, 1) * 100 > 2 ? "text-rag-red" : "text-rag-green",
                  ].join(" ")}>
                    {selected.target_wgt > 0
                      ? `${((selected.actual_wgt - selected.target_wgt) / selected.target_wgt * 100).toFixed(2)}%`
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="text-xs text-ink-500 pt-3 border-t border-ink-200 dark:border-ink-700">
                A complete printable certificate joins this header (BSTARTS + BEND2S totals) to BWEIGHS (every ingredient drop with target/actual/lot)
                and CCLOGS (carryover test at changeover). The certificate generator script lives in <code className="font-mono">scripts/</code>.
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
