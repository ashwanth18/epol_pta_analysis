"use client";

import { useMemo } from "react";
import type { ProcessFlow, ProcessFlowNode } from "@/lib/data";

export const STAGE_META = [
  { label: "Ingredient", color: "#2563eb", bg: "rgba(37,99,235,0.06)" },
  { label: "Weigher", color: "#0891b2", bg: "rgba(8,145,178,0.06)" },
  { label: "Press route", color: "#d97706", bg: "rgba(217,119,6,0.06)" },
  { label: "Product", color: "#16a34a", bg: "rgba(22,163,74,0.06)" },
];

const NODE_WIDTH = 20;
const NODE_PADDING = 10;
const MARGIN = { top: 52, right: 168, bottom: 20, left: 12 };

export interface SankeySelection {
  kind: "node" | "link";
  nodeIndex?: number;
  linkIndex?: number;
}

interface LaidNode {
  index: number;
  name: string;
  stage: number;
  stageLabel: string;
  value: number;
  x: number;
  y: number;
  height: number;
  pct: number;
}
interface LaidLink {
  idx: number;
  source: number;
  target: number;
  value: number;
  pct: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  thickness: number;
}

export function fmtT(n: number) {
  return n.toLocaleString("en-GB", { maximumFractionDigits: 1 });
}

export function fmtPct(n: number) {
  return `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
}

function ribbonPath(sx: number, sy: number, tx: number, ty: number, thickness: number) {
  const halfT = thickness / 2;
  const cx = (sx + tx) / 2;
  return [
    `M ${sx},${sy - halfT}`,
    `C ${cx},${sy - halfT} ${cx},${ty - halfT} ${tx},${ty - halfT}`,
    `L ${tx},${ty + halfT}`,
    `C ${cx},${ty + halfT} ${cx},${sy + halfT} ${sx},${sy + halfT}`,
    "Z",
  ].join(" ");
}

function truncate(name: string, max = 28) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function computeFocusSet(data: ProcessFlow, nodeIndex: number) {
  const nodes = new Set<number>([nodeIndex]);
  const links = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    data.links.forEach((l, idx) => {
      if (nodes.has(l.source) || nodes.has(l.target)) {
        if (!links.has(idx)) {
          links.add(idx);
          changed = true;
        }
        if (!nodes.has(l.source)) {
          nodes.add(l.source);
          changed = true;
        }
        if (!nodes.has(l.target)) {
          nodes.add(l.target);
          changed = true;
        }
      }
    });
  }
  return { nodes, links };
}

export function getNodeStats(data: ProcessFlow, nodeIndex: number) {
  const node = data.nodes[nodeIndex];
  if (!node) return null;
  const inbound = data.links.filter((l) => l.target === nodeIndex);
  const outbound = data.links.filter((l) => l.source === nodeIndex);
  return {
    node,
    inbound,
    outbound,
    inboundT: inbound.reduce((s, l) => s + l.value, 0),
    outboundT: outbound.reduce((s, l) => s + l.value, 0),
    pctOfMill: data.total_t > 0 ? (node.value / data.total_t) * 100 : 0,
  };
}

export function Sankey({
  data,
  width = 1120,
  height = 720,
  selection,
  onSelectNode,
  onSelectLink,
  searchQuery = "",
  minFlow = 0,
  showLabels = true,
}: {
  data: ProcessFlow;
  width?: number;
  height?: number;
  selection: SankeySelection | null;
  onSelectNode: (index: number | null) => void;
  onSelectLink: (index: number | null) => void;
  searchQuery?: string;
  minFlow?: number;
  showLabels?: boolean;
}) {
  const q = searchQuery.trim().toUpperCase();

  const focus = useMemo(() => {
    if (selection?.kind === "node" && selection.nodeIndex != null) {
      return computeFocusSet(data, selection.nodeIndex);
    }
    if (selection?.kind === "link" && selection.linkIndex != null) {
      const l = data.links[selection.linkIndex];
      if (!l) return null;
      const a = computeFocusSet(data, l.source);
      const b = computeFocusSet(data, l.target);
      return {
        nodes: new Set([...a.nodes, ...b.nodes]),
        links: new Set([selection.linkIndex, ...a.links, ...b.links]),
      };
    }
    return null;
  }, [data, selection]);

  const searchHits = useMemo(() => {
    if (!q) return null;
    const matching = new Set<number>();
    data.nodes.forEach((n, i) => {
      if (n.name.toUpperCase().includes(q)) matching.add(i);
    });
    return matching;
  }, [data, q]);

  const layout = useMemo(() => {
    const stageCount = data.stages.length;
    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;
    const visibleLinks = data.links
      .map((l, idx) => ({ ...l, idx }))
      .filter((l) => l.value >= minFlow);

    const byStage: number[][] = Array.from({ length: stageCount }, () => []);
    data.nodes.forEach((n, i) => byStage[n.stage]?.push(i));
    byStage.forEach((arr) => arr.sort((a, b) => data.nodes[b].value - data.nodes[a].value));

    let k = Infinity;
    byStage.forEach((arr) => {
      if (!arr.length) return;
      const total = arr.reduce((s, i) => s + data.nodes[i].value, 0);
      const avail = plotH - NODE_PADDING * Math.max(arr.length - 1, 0);
      if (total > 0) k = Math.min(k, avail / total);
    });
    if (!isFinite(k)) k = 1;

    const columnGap = stageCount > 1 ? (plotW - NODE_WIDTH) / (stageCount - 1) : 0;
    const stageX = Array.from({ length: stageCount }, (_, stage) => MARGIN.left + stage * columnGap);
    const stageW = columnGap > NODE_WIDTH ? columnGap : plotW / stageCount;

    const laidNodes: LaidNode[] = [];
    const nodePos = new Map<number, LaidNode>();
    const stageTotals = Array.from({ length: stageCount }, () => 0);

    byStage.forEach((arr, stage) => {
      const heights = arr.map((i) => Math.max(3, data.nodes[i].value * k));
      const totalH = heights.reduce((a, b) => a + b, 0) + NODE_PADDING * Math.max(arr.length - 1, 0);
      let y = MARGIN.top + Math.max(0, (plotH - totalH) / 2);
      arr.forEach((i, j) => {
        const n = data.nodes[i];
        stageTotals[stage] += n.value;
        const node: LaidNode = {
          index: i,
          name: n.name,
          stage,
          stageLabel: n.stage_label,
          value: n.value,
          pct: data.total_t > 0 ? (n.value / data.total_t) * 100 : 0,
          x: stageX[stage],
          y,
          height: heights[j],
        };
        laidNodes.push(node);
        nodePos.set(i, node);
        y += heights[j] + NODE_PADDING;
      });
    });

    const sorted = visibleLinks;
    const laidLinks: LaidLink[] = [];
    const outGroups = new Map<number, typeof sorted>();
    const inGroups = new Map<number, typeof sorted>();
    sorted.forEach((l) => {
      if (!outGroups.has(l.source)) outGroups.set(l.source, []);
      if (!inGroups.has(l.target)) inGroups.set(l.target, []);
      outGroups.get(l.source)!.push(l);
      inGroups.get(l.target)!.push(l);
    });
    outGroups.forEach((arr) => arr.sort((a, b) => (nodePos.get(a.target)?.y ?? 0) - (nodePos.get(b.target)?.y ?? 0)));
    inGroups.forEach((arr) => arr.sort((a, b) => (nodePos.get(a.source)?.y ?? 0) - (nodePos.get(b.source)?.y ?? 0)));

    const sySlice = new Map<number, number>();
    const tySlice = new Map<number, number>();
    outGroups.forEach((arr) => {
      let off = 0;
      arr.forEach((l) => {
        sySlice.set(l.idx, off);
        off += l.value * k;
      });
    });
    inGroups.forEach((arr) => {
      let off = 0;
      arr.forEach((l) => {
        tySlice.set(l.idx, off);
        off += l.value * k;
      });
    });

    sorted.forEach((l) => {
      const s = nodePos.get(l.source);
      const t = nodePos.get(l.target);
      if (!s || !t) return;
      const thickness = Math.max(1.5, l.value * k);
      laidLinks.push({
        idx: l.idx,
        source: l.source,
        target: l.target,
        value: l.value,
        pct: data.total_t > 0 ? (l.value / data.total_t) * 100 : 0,
        sx: s.x + NODE_WIDTH,
        sy: s.y + (sySlice.get(l.idx) ?? 0) + thickness / 2,
        tx: t.x,
        ty: t.y + (tySlice.get(l.idx) ?? 0) + thickness / 2,
        thickness,
      });
    });

    return { laidNodes, laidLinks, nodePos, stageX, stageW, stageTotals, plotH };
  }, [data, width, height, minFlow]);

  const isNodeVisible = (index: number) => {
    if (focus && !focus.nodes.has(index)) return false;
    if (searchHits) {
      if (searchHits.has(index)) return true;
      return data.links.some(
        (l) =>
          (l.source === index || l.target === index) &&
          (searchHits.has(l.source) || searchHits.has(l.target)),
      );
    }
    return true;
  };

  const isLinkVisible = (l: LaidLink) => {
    if (focus && !focus.links.has(l.idx)) return false;
    if (searchHits && !(searchHits.has(l.source) || searchHits.has(l.target))) return false;
    return true;
  };

  const isDimmed = focus != null || searchHits != null;

  return (
    <div className="relative">
      <svg width={width} height={height} className="min-w-[960px] select-none" role="img" aria-label="Process flow Sankey diagram">
        <defs>
          {STAGE_META.map((s, i) => (
            <linearGradient key={s.label} id={`flow-grad-${i}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.35} />
            </linearGradient>
          ))}
        </defs>

        {/* stage bands */}
        {layout.stageX.map((x, i) => (
          <g key={`band-${i}`}>
            <rect
              x={x - 6}
              y={MARGIN.top - 8}
              width={layout.stageW}
              height={layout.plotH + 16}
              fill={STAGE_META[i]?.bg ?? "transparent"}
              rx={6}
            />
            <text x={x + NODE_WIDTH / 2} y={24} className="fill-ink-700 dark:fill-ink-200" style={{ fontSize: 13, fontWeight: 700 }}>
              {i + 1}. {data.stages[i]}
            </text>
            <text x={x + NODE_WIDTH / 2} y={40} className="fill-ink-400" style={{ fontSize: 10 }}>
              {fmtT(layout.stageTotals[i] ?? 0)} t total
            </text>
          </g>
        ))}

        {/* links */}
        <g>
          {layout.laidLinks.map((l) => {
            const srcStage = layout.nodePos.get(l.source)?.stage ?? 0;
            const visible = isLinkVisible(l);
            const selected = selection?.kind === "link" && selection.linkIndex === l.idx;
            const connectedToNode =
              selection?.kind === "node" &&
              selection.nodeIndex != null &&
              (l.source === selection.nodeIndex || l.target === selection.nodeIndex);
            const opacity = !visible ? 0.04 : selected || connectedToNode ? 0.72 : isDimmed ? 0.14 : 0.32;
            return (
              <path
                key={l.idx}
                d={ribbonPath(l.sx, l.sy, l.tx, l.ty, l.thickness)}
                fill={`url(#flow-grad-${srcStage})`}
                fillOpacity={opacity}
                stroke={selected ? STAGE_META[srcStage]?.color : "none"}
                strokeWidth={selected ? 1 : 0}
                onClick={() => onSelectLink(selected ? null : l.idx)}
                style={{ cursor: "pointer", transition: "fill-opacity 0.15s ease" }}
              />
            );
          })}
        </g>

        {/* nodes */}
        <g>
          {layout.laidNodes.map((n) => {
            const meta = STAGE_META[n.stage];
            const visible = isNodeVisible(n.index);
            const selected = selection?.kind === "node" && selection.nodeIndex === n.index;
            const labelRight = true;
            const opacity = !visible ? 0.15 : selected ? 1 : isDimmed ? 0.35 : 0.95;
            return (
              <g
                key={n.index}
                onClick={() => onSelectNode(selected ? null : n.index)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={n.x - 1}
                  y={n.y - 1}
                  width={NODE_WIDTH + 2}
                  height={n.height + 2}
                  fill="none"
                  stroke={selected ? meta.color : "transparent"}
                  strokeWidth={2}
                  rx={3}
                />
                <rect
                  x={n.x}
                  y={n.y}
                  width={NODE_WIDTH}
                  height={n.height}
                  fill={meta.color}
                  fillOpacity={opacity}
                  rx={3}
                />
                {showLabels && n.height >= 10 && visible && (
                  <text
                    x={labelRight ? n.x + NODE_WIDTH + 8 : n.x - 8}
                    y={n.y + n.height / 2}
                    textAnchor={labelRight ? "start" : "end"}
                    dominantBaseline="middle"
                    className="fill-ink-700 dark:fill-ink-200"
                    style={{ fontSize: 11, fontWeight: selected ? 700 : 500, opacity: visible ? 1 : 0.3 }}
                  >
                    {truncate(n.name)}
                  </text>
                )}
                {showLabels && n.height >= 10 && visible && (
                  <text
                    x={labelRight ? n.x + NODE_WIDTH + 8 : n.x - 8}
                    y={n.y + n.height / 2 + 12}
                    textAnchor={labelRight ? "start" : "end"}
                    className="fill-ink-400"
                    style={{ fontSize: 9.5, opacity: 0.85 }}
                  >
                    {fmtT(n.value)} t · {fmtPct(n.pct)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export function nodeMatchesSearch(node: ProcessFlowNode, query: string) {
  return !query.trim() || node.name.toUpperCase().includes(query.trim().toUpperCase());
}
