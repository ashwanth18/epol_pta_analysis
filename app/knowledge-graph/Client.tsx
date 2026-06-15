"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import type { KnowledgeGraph, KgNode } from "@/lib/data";
import { fmtGbp } from "@/lib/format";

const CAT_COLOR: Record<string, { fill: string; stroke: string; text: string }> = {
  production: { fill: "rgba(47,111,235,0.12)", stroke: "rgba(47,111,235,0.55)", text: "#1e4ba8" },
  inventory: { fill: "rgba(217,119,6,0.12)", stroke: "rgba(217,119,6,0.55)", text: "#92400e" },
  equipment: { fill: "rgba(220,38,38,0.12)", stroke: "rgba(220,38,38,0.55)", text: "#991b1b" },
  compliance: { fill: "rgba(22,163,74,0.12)", stroke: "rgba(22,163,74,0.55)", text: "#166534" },
  master: { fill: "rgba(120,120,130,0.12)", stroke: "rgba(120,120,130,0.55)", text: "#525a6b" },
  concept: { fill: "rgba(149,104,220,0.12)", stroke: "rgba(149,104,220,0.55)", text: "#5b21b6" },
  product: { fill: "rgba(20,158,158,0.14)", stroke: "rgba(20,158,158,0.65)", text: "#0e7490" },
};

const NODE_W = 180;
const NODE_H = 60;
const COL_GAP = 140;
const ROW_GAP = 12;

export function KgClient({ data }: { data: KnowledgeGraph }) {
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const active = selected ?? hover;

  // Layout: 3 columns, evenly spaced within each
  const layout = useMemo(() => {
    const tables = data.tables.map((n, i) => ({ ...n, col: 0, row: i, type: "table" as const }));
    const concepts = data.concepts.map((n, i) => ({ ...n, col: 1, row: i, type: "concept" as const }));
    const products = data.products.map((n, i) => ({ ...n, col: 2, row: i, type: "product" as const }));
    const all = [...tables, ...concepts, ...products];

    const colCount = [tables.length, concepts.length, products.length];
    const maxRows = Math.max(...colCount);
    const height = maxRows * (NODE_H + ROW_GAP) + 40;

    const pos: Record<string, { x: number; y: number; node: KgNode & { col: number; row: number; type: string } }> = {};
    for (const n of all) {
      const colTotal = colCount[n.col];
      const padding = (maxRows - colTotal) * (NODE_H + ROW_GAP) / 2;
      pos[n.id] = {
        x: 20 + n.col * (NODE_W + COL_GAP),
        y: 30 + padding + n.row * (NODE_H + ROW_GAP),
        node: n,
      };
    }
    return { all, pos, width: 20 + 3 * NODE_W + 2 * COL_GAP + 20, height };
  }, [data]);

  // Edges
  const edges: { from: string; to: string }[] = useMemo(() => {
    return [
      ...data.edges_table_concept.map(([a, b]) => ({ from: a, to: b })),
      ...data.edges_concept_product.map(([a, b]) => ({ from: a, to: b })),
    ];
  }, [data]);

  const activeEdges = useMemo(() => {
    if (!active) return new Set<string>();
    const out = new Set<string>();
    const queue = [active];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of edges) {
        const key = `${e.from}->${e.to}`;
        if (e.from === id && !out.has(key)) {
          out.add(key);
          queue.push(e.to);
        }
        if (e.to === id && !out.has(key)) {
          out.add(key);
          queue.push(e.from);
        }
      }
    }
    return out;
  }, [active, edges]);

  const activeNodes = useMemo(() => {
    if (!active) return new Set<string>();
    const out = new Set<string>([active]);
    for (const key of activeEdges) {
      const [from, to] = key.split("->");
      out.add(from);
      out.add(to);
    }
    return out;
  }, [active, activeEdges]);

  const detail = active ? layout.pos[active]?.node : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3">
        <Card>
          <CardHeader right={<div className="flex gap-2">
            <Pill tone="info">production</Pill>
            <Pill tone="amber">inventory</Pill>
            <Pill tone="red">equipment</Pill>
            <Pill tone="green">compliance</Pill>
          </div>}>Hover or click a node to highlight its data → value chain</CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <svg width={layout.width} height={layout.height} className="block">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                  </marker>
                  <marker id="arrowActive" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#2f6feb" />
                  </marker>
                </defs>

                {/* Column headers */}
                <text x={20 + NODE_W / 2} y={18} textAnchor="middle" fontSize={11} fill="#7b8190" letterSpacing={1.2} fontWeight={600}>
                  DATA · DBF TABLES
                </text>
                <text x={20 + NODE_W + COL_GAP + NODE_W / 2} y={18} textAnchor="middle" fontSize={11} fill="#7b8190" letterSpacing={1.2} fontWeight={600}>
                  CONCEPTS
                </text>
                <text x={20 + 2 * (NODE_W + COL_GAP) + NODE_W / 2} y={18} textAnchor="middle" fontSize={11} fill="#7b8190" letterSpacing={1.2} fontWeight={600}>
                  PRODUCTS · COMMERCIAL VALUE
                </text>

                {/* Edges */}
                {edges.map((e, i) => {
                  const a = layout.pos[e.from];
                  const b = layout.pos[e.to];
                  if (!a || !b) return null;
                  const x1 = a.x + NODE_W;
                  const y1 = a.y + NODE_H / 2;
                  const x2 = b.x;
                  const y2 = b.y + NODE_H / 2;
                  const dx = (x2 - x1) * 0.5;
                  const isActive = activeEdges.has(`${e.from}->${e.to}`);
                  return (
                    <path
                      key={i}
                      d={`M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`}
                      fill="none"
                      stroke={isActive ? "#2f6feb" : "#aeb4bf"}
                      strokeOpacity={isActive ? 1 : active ? 0.15 : 0.4}
                      strokeWidth={isActive ? 1.6 : 1}
                      markerEnd={isActive ? "url(#arrowActive)" : "url(#arrow)"}
                    />
                  );
                })}

                {/* Nodes */}
                {layout.all.map((n) => {
                  const p = layout.pos[n.id];
                  const cat = n.type === "concept" ? "concept" : n.type === "product" ? "product" : (n.cat || "master");
                  const color = CAT_COLOR[cat];
                  const isActive = activeNodes.has(n.id);
                  const dim = active && !isActive;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${p.x},${p.y})`}
                      onMouseEnter={() => setHover(n.id)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => setSelected(selected === n.id ? null : n.id)}
                      style={{ cursor: "pointer", opacity: dim ? 0.3 : 1 }}
                    >
                      <rect
                        width={NODE_W}
                        height={NODE_H}
                        rx={6}
                        fill={color.fill}
                        stroke={isActive ? "#2f6feb" : color.stroke}
                        strokeWidth={isActive ? 2 : 1}
                      />
                      <text x={10} y={20} fontSize={12} fontWeight={600} fill={color.text}>{n.label}</text>
                      {n.sub && <text x={10} y={36} fontSize={10} fill="#525a6b">{n.sub}</text>}
                      {n.type === "product" && n.value ? (
                        <text x={10} y={52} fontSize={10} fontWeight={600} fill="#0e7490">{fmtGbp(n.value)}/yr</text>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>Node detail</CardHeader>
        <CardBody>
          {!detail ? (
            <div className="text-sm text-ink-500">Hover or click a node in the graph to see its details and value chain.</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-1">{detail.type}</div>
                <div className="font-semibold">{detail.label}</div>
                {detail.sub && <div className="text-ink-500">{detail.sub}</div>}
              </div>
              {detail.type === "product" && (
                <>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-1">Annual value</div>
                    <div className="text-lg font-semibold text-accent">{fmtGbp(detail.value)}</div>
                  </div>
                  {detail.note && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-1">How it pays</div>
                      <div className="text-ink-700 dark:text-ink-300">{detail.note}</div>
                    </div>
                  )}
                </>
              )}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-1">Connected ({activeNodes.size - 1})</div>
                <div className="flex flex-wrap gap-1">
                  {Array.from(activeNodes).filter((n) => n !== detail.id).map((id) => {
                    const n = layout.pos[id]?.node;
                    if (!n) return null;
                    return (
                      <button
                        key={id}
                        onClick={() => setSelected(id)}
                        className="text-[11px] px-2 py-0.5 rounded-md border border-ink-200 dark:border-ink-700 hover:border-accent"
                      >
                        {n.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
