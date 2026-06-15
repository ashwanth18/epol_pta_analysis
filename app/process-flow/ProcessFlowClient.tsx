"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import type { ProcessFlow } from "@/lib/data";
import { buildProcessFlow, ingredientFilterOptions } from "./buildFlow";
import { computeGraphHeight, computeGraphMinWidth } from "./flowLayout";
import { fmtT, fmtPct, getNodeStats, nodeMatchesSearch, Sankey, STAGE_META, type SankeySelection } from "./Sankey";
import { FlowGraph } from "./FlowGraph";

export function ProcessFlowClient({
  data,
  topIngredients,
}: {
  data: ProcessFlow;
  topIngredients: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1120);
  const [graphWidth, setGraphWidth] = useState(1400);
  const [selection, setSelection] = useState<SankeySelection | null>(null);
  const [search, setSearch] = useState("");
  const [minFlow, setMinFlow] = useState(0);
  const [showLabels, setShowLabels] = useState(true);

  const ingredientTotal = data.ingredient_count ?? topIngredients;
  const ingredientOptions = useMemo(() => ingredientFilterOptions(ingredientTotal), [ingredientTotal]);

  const flowData = useMemo(
    () => buildProcessFlow(data, topIngredients),
    [data, topIngredients],
  );

  useEffect(() => {
    setSelection(null);
  }, [topIngredients]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(960, Math.floor(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = graphContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setGraphWidth(Math.max(computeGraphMinWidth(data.stages.length), Math.floor(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [data.stages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const height = useMemo(() => {
    const byStage = flowData.stages.map((_, stage) => flowData.nodes.filter((n) => n.stage === stage).length);
    const busiest = Math.max(...byStage, 1);
    return Math.max(680, Math.min(980, 120 + busiest * 34));
  }, [flowData]);

  const graphHeight = useMemo(() => computeGraphHeight(flowData), [flowData]);

  const topFlows = useMemo(
    () =>
      [...flowData.links]
        .map((l, idx) => ({
          idx,
          from: flowData.nodes[l.source],
          to: flowData.nodes[l.target],
          value: l.value,
          pct: flowData.total_t > 0 ? (l.value / flowData.total_t) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value),
    [flowData],
  );

  const filteredFlows = useMemo(() => {
    const q = search.trim();
    return topFlows.filter((f) => {
      if (f.value < minFlow) return false;
      if (!q) return true;
      return nodeMatchesSearch(f.from, q) || nodeMatchesSearch(f.to, q);
    });
  }, [topFlows, search, minFlow]);

  const detail = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "node" && selection.nodeIndex != null) {
      const stats = getNodeStats(flowData, selection.nodeIndex);
      if (!stats) return null;
      const topIn = [...stats.inbound].sort((a, b) => b.value - a.value).slice(0, 5);
      const topOut = [...stats.outbound].sort((a, b) => b.value - a.value).slice(0, 5);
      return {
        kind: "node" as const,
        title: stats.node.name,
        stage: stats.node.stage_label,
        stageIdx: stats.node.stage,
        tonnes: stats.node.value,
        pct: stats.pctOfMill,
        inboundT: stats.inboundT,
        outboundT: stats.outboundT,
        topIn: topIn.map((l) => ({ name: flowData.nodes[l.source].name, value: l.value })),
        topOut: topOut.map((l) => ({ name: flowData.nodes[l.target].name, value: l.value })),
      };
    }
    if (selection.kind === "link" && selection.linkIndex != null) {
      const l = flowData.links[selection.linkIndex];
      if (!l) return null;
      const from = flowData.nodes[l.source];
      const to = flowData.nodes[l.target];
      return {
        kind: "link" as const,
        title: `${from.name} → ${to.name}`,
        fromStage: from.stage_label,
        toStage: to.stage_label,
        tonnes: l.value,
        pct: flowData.total_t > 0 ? (l.value / flowData.total_t) * 100 : 0,
      };
    }
    return null;
  }, [flowData, selection]);

  const selectNode = useCallback((index: number | null) => {
    setSelection(index == null ? null : { kind: "node", nodeIndex: index });
  }, []);

  const selectLink = useCallback((index: number | null) => {
    setSelection(index == null ? null : { kind: "link", linkIndex: index });
  }, []);

  const visibleIngredientNodes = useMemo(
    () => flowData.nodes.filter((n) => n.stage === 0).length,
    [flowData],
  );

  const selectFlowRow = (idx: number) => {
    setSelection((prev) =>
      prev?.kind === "link" && prev.linkIndex === idx ? null : { kind: "link", linkIndex: idx },
    );
  };

  return (
    <div className="space-y-4">
      {/* ingredient filter — prominent */}
      <div className="rounded-xl border-2 border-accent/25 bg-accent-50/40 dark:bg-accent/10 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold text-ink-800 dark:text-ink-100">
              How many ingredients to show?
            </div>
            <p className="text-xs text-ink-500 mt-0.5 max-w-xl">
              Lower numbers keep the diagram readable; higher numbers reveal more materials (e.g. salt is rank ~21).
              Remaining ingredients are grouped as &ldquo;Other ingredients&rdquo;.
            </p>
          </div>
          <Pill tone="info">
            {visibleIngredientNodes} in diagram · {ingredientTotal} used in period
          </Pill>
        </div>
        {!data.raw_flows ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Ingredient filter needs updated data — run <code className="text-xs bg-white/60 dark:bg-ink-900 px-1 rounded">npm run export-data</code> and refresh.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 relative z-10">
            {ingredientOptions.map((n) => {
              const active = topIngredients === n;
              const label = n >= ingredientTotal ? `All ${ingredientTotal}` : `Top ${n}`;
              return (
                <a
                  key={n}
                  href={`/process-flow?top=${n}`}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                    active
                      ? "bg-accent text-white border-accent shadow-sm pointer-events-none"
                      : "bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:border-accent hover:bg-accent-50 dark:hover:bg-accent/10",
                  ].join(" ")}
                >
                  {label}
                </a>
              );
            })}
          </div>
        )}
        <p className="text-xs text-ink-500 mt-3">{flowData.notes[1]}</p>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50/50 dark:bg-ink-800/30">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] text-ink-500 block mb-1">Search nodes & flows</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Maize, salt, PP2, AW2…"
            className="w-full text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-900"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="text-[11px] text-ink-500 block mb-1">Min flow: {minFlow} t</label>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={minFlow}
            onChange={(e) => setMinFlow(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer pb-1">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          Show labels
        </label>
        {selection && (
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="text-xs px-3 py-1.5 rounded-md border border-ink-200 dark:border-ink-700 hover:bg-white dark:hover:bg-ink-900"
          >
            Clear selection (Esc)
          </button>
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-4 text-xs text-ink-600 dark:text-ink-300">
        {STAGE_META.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            {i + 1}. {s.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
        <div ref={containerRef} className="overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-2">
          <div className="flex items-center justify-between px-1 pb-2 text-xs text-ink-500">
            <span>Sankey — material mass flow</span>
            <span>{visibleIngredientNodes} ingredient nodes · Top {topIngredients >= ingredientTotal ? "all" : topIngredients}</span>
          </div>
          <Sankey
            data={flowData}
            width={width}
            height={height}
            selection={selection}
            onSelectNode={selectNode}
            onSelectLink={selectLink}
            searchQuery={search}
            minFlow={minFlow}
            showLabels={showLabels}
          />
        </div>

        {/* detail panel */}
        <Card className="h-fit xl:sticky xl:top-4">
          <CardHeader right={selection ? <Pill tone="info">Selected</Pill> : undefined}>
            {detail ? "Selection detail" : "Inspector"}
          </CardHeader>
          <CardBody className="text-sm space-y-3">
            {!detail && (
              <p className="text-ink-500 text-xs leading-relaxed">
                Click any node bar to see its inbound/outbound flows. Click a ribbon to inspect a single material path.
                Use search to filter the diagram and flow table.
              </p>
            )}
            {detail?.kind === "node" && (
              <>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-400">{detail.stage}</div>
                  <div className="font-semibold leading-snug">{detail.title}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-ink-200 dark:border-ink-700 px-3 py-2">
                    <div className="text-[11px] text-ink-500">Throughput</div>
                    <div className="font-semibold tabular-nums">{fmtT(detail.tonnes)} t</div>
                    <div className="text-[11px] text-ink-400">{fmtPct(detail.pct)} of mill</div>
                  </div>
                  <div className="rounded-md border border-ink-200 dark:border-ink-700 px-3 py-2">
                    <div className="text-[11px] text-ink-500">Stage</div>
                    <div className="font-semibold flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_META[detail.stageIdx]?.color }} />
                      {detail.stage}
                    </div>
                  </div>
                </div>
                {detail.topIn.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-ink-500 mb-1">Top inbound ({fmtT(detail.inboundT)} t)</div>
                    <ul className="space-y-1">
                      {detail.topIn.map((x, i) => (
                        <li key={i} className="flex justify-between gap-2 text-xs">
                          <span className="truncate">{x.name}</span>
                          <span className="tabular-nums font-medium shrink-0">{fmtT(x.value)} t</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.topOut.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-ink-500 mb-1">Top outbound ({fmtT(detail.outboundT)} t)</div>
                    <ul className="space-y-1">
                      {detail.topOut.map((x, i) => (
                        <li key={i} className="flex justify-between gap-2 text-xs">
                          <span className="truncate">{x.name}</span>
                          <span className="tabular-nums font-medium shrink-0">{fmtT(x.value)} t</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {detail?.kind === "link" && (
              <>
                <div>
                  <div className="text-[11px] text-ink-400">{detail.fromStage} → {detail.toStage}</div>
                  <div className="font-semibold leading-snug text-xs">{detail.title}</div>
                </div>
                <div className="rounded-md border border-ink-200 dark:border-ink-700 px-3 py-2">
                  <div className="text-[11px] text-ink-500">Flow volume</div>
                  <div className="text-xl font-semibold tabular-nums">{fmtT(detail.tonnes)} t</div>
                  <div className="text-[11px] text-ink-400">{fmtPct(detail.pct)} of total mill throughput</div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader right={<Pill tone="info">{flowData.nodes.length} nodes · {flowData.links.length} edges</Pill>}>
          Network graph — nodes & edges
        </CardHeader>
        <CardBody>
          <p className="text-xs text-ink-500 mb-3">
            Same material flow as the Sankey above, shown as a directed graph. Node boxes are stages in the process; edge thickness is tonnes transferred. Tables below list every visible node and edge — click any row to highlight it here and in the Sankey.
          </p>
          <div ref={graphContainerRef}>
            <FlowGraph
              data={flowData}
              width={graphWidth}
              height={graphHeight}
              selection={selection}
              onSelectNode={selectNode}
              onSelectLink={selectLink}
              searchQuery={search}
              minFlow={minFlow}
              showLabels={showLabels}
            />
          </div>
        </CardBody>
      </Card>

      {/* interactive flow table */}
      <Card>
        <CardHeader right={<Pill tone="neutral">{filteredFlows.length} flows</Pill>}>Material flows — click to highlight</CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">From</th>
                  <th className="px-4 py-2 font-medium">To</th>
                  <th className="px-4 py-2 font-medium text-right">Tonnes</th>
                  <th className="px-4 py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlows.slice(0, 40).map((f) => {
                  const active = selection?.kind === "link" && selection.linkIndex === f.idx;
                  return (
                    <tr
                      key={f.idx}
                      onClick={() => selectFlowRow(f.idx)}
                      className={[
                        "border-b border-ink-100 dark:border-ink-800 cursor-pointer transition-colors",
                        active ? "bg-accent-50 dark:bg-accent/10" : "hover:bg-ink-50 dark:hover:bg-ink-800/50",
                      ].join(" ")}
                    >
                      <td className="px-4 py-2">
                        <span className="text-[10px] text-ink-400">{f.from.stage_label}</span>
                        <div className="font-mono text-xs truncate max-w-[220px]">{f.from.name}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-[10px] text-ink-400">{f.to.stage_label}</span>
                        <div className="font-mono text-xs truncate max-w-[220px]">{f.to.name}</div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtT(f.value)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-ink-500">{fmtPct(f.pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
