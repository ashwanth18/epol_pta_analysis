import type { ProcessFlow } from "@/lib/data";

export interface GraphNodeLayout {
  index: number;
  name: string;
  stage: number;
  stageLabel: string;
  value: number;
  pct: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface GraphLinkLayout {
  idx: number;
  source: number;
  target: number;
  value: number;
  pct: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  strokeWidth: number;
}

export const GRAPH_NODE_H = 50;
export const GRAPH_NODE_GAP = 12;
export const GRAPH_MIN_COL_GAP = 120;
export const GRAPH_MAX_NODE_W = 200;
export const GRAPH_MIN_NODE_W = 155;
export const GRAPH_MARGIN = { top: 64, right: 48, bottom: 36, left: 48 };

export function computeGraphMinWidth(stageCount = 4) {
  const plot =
    stageCount * GRAPH_MAX_NODE_W + Math.max(stageCount - 1, 0) * GRAPH_MIN_COL_GAP;
  return plot + GRAPH_MARGIN.left + GRAPH_MARGIN.right;
}

export function computeGraphHeight(data: ProcessFlow) {
  const byStage = data.stages.map((_, stage) => data.nodes.filter((n) => n.stage === stage).length);
  const busiest = Math.max(...byStage, 1);
  return Math.max(
    620,
    GRAPH_MARGIN.top + GRAPH_MARGIN.bottom + busiest * (GRAPH_NODE_H + GRAPH_NODE_GAP) + 24,
  );
}

export function computeFocusSet(data: ProcessFlow, nodeIndex: number) {
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

export function computeFocusFromLink(data: ProcessFlow, linkIndex: number) {
  const l = data.links[linkIndex];
  if (!l) return null;
  const a = computeFocusSet(data, l.source);
  const b = computeFocusSet(data, l.target);
  return {
    nodes: new Set([...a.nodes, ...b.nodes]),
    links: new Set<number>([linkIndex, ...a.links, ...b.links]),
  };
}

export function computeGraphLayout(
  data: ProcessFlow,
  width: number,
  height: number,
  minFlow = 0,
) {
  const stageCount = data.stages.length;
  const plotW = width - GRAPH_MARGIN.left - GRAPH_MARGIN.right;
  const plotH = height - GRAPH_MARGIN.top - GRAPH_MARGIN.bottom;

  let colGap = GRAPH_MIN_COL_GAP;
  let nodeW =
    stageCount > 0
      ? (plotW - colGap * Math.max(stageCount - 1, 0)) / stageCount
      : plotW;

  if (nodeW > GRAPH_MAX_NODE_W) {
    nodeW = GRAPH_MAX_NODE_W;
    colGap =
      stageCount > 1 ? (plotW - nodeW * stageCount) / (stageCount - 1) : 0;
  } else if (nodeW < GRAPH_MIN_NODE_W) {
    nodeW = GRAPH_MIN_NODE_W;
    colGap =
      stageCount > 1
        ? Math.max(GRAPH_MIN_COL_GAP, (plotW - nodeW * stageCount) / (stageCount - 1))
        : 0;
  }
  nodeW = Math.floor(nodeW);
  colGap = Math.floor(colGap);

  const stageX = Array.from(
    { length: stageCount },
    (_, s) => GRAPH_MARGIN.left + s * (nodeW + colGap),
  );
  const stageLabelX = stageX.map((x) => x + nodeW / 2);
  const stageBandX = stageX.map((x) => x - 10);
  const stageBandW = nodeW + 20;

  const byStage: number[][] = Array.from({ length: stageCount }, () => []);
  data.nodes.forEach((n, i) => byStage[n.stage]?.push(i));
  byStage.forEach((arr) => arr.sort((a, b) => data.nodes[b].value - data.nodes[a].value));

  const nodes: GraphNodeLayout[] = [];
  const pos = new Map<number, GraphNodeLayout>();

  byStage.forEach((arr, stage) => {
    const totalH = arr.length * GRAPH_NODE_H + Math.max(arr.length - 1, 0) * GRAPH_NODE_GAP;
    let y = GRAPH_MARGIN.top + Math.max(0, (plotH - totalH) / 2);
    arr.forEach((i) => {
      const n = data.nodes[i];
      const x = stageX[stage];
      const layout: GraphNodeLayout = {
        index: i,
        name: n.name,
        stage,
        stageLabel: n.stage_label,
        value: n.value,
        pct: data.total_t > 0 ? (n.value / data.total_t) * 100 : 0,
        x,
        y,
        w: nodeW,
        h: GRAPH_NODE_H,
        cx: x + nodeW / 2,
        cy: y + GRAPH_NODE_H / 2,
      };
      nodes.push(layout);
      pos.set(i, layout);
      y += GRAPH_NODE_H + GRAPH_NODE_GAP;
    });
  });

  const maxFlow = Math.max(...data.links.map((l) => l.value), 1);
  const links: GraphLinkLayout[] = [];

  data.links.forEach((l, idx) => {
    if (l.value < minFlow) return;
    const s = pos.get(l.source);
    const t = pos.get(l.target);
    if (!s || !t) return;
    const strokeWidth = Math.max(1.5, 1.5 + (l.value / maxFlow) * 9);
    links.push({
      idx,
      source: l.source,
      target: l.target,
      value: l.value,
      pct: data.total_t > 0 ? (l.value / data.total_t) * 100 : 0,
      sx: s.x + s.w,
      sy: s.cy,
      tx: t.x,
      ty: t.cy,
      strokeWidth,
    });
  });

  const stageTotals = Array.from({ length: stageCount }, (_, s) =>
    data.nodes.filter((n) => n.stage === s).reduce((sum, n) => sum + n.value, 0),
  );

  return {
    nodes,
    links,
    stageX,
    stageLabelX,
    stageBandX,
    stageBandW,
    colGap,
    nodeW,
    margin: GRAPH_MARGIN,
    stageTotals,
    plotH,
  };
}

export function getSearchHits(data: ProcessFlow, query: string) {
  const q = query.trim().toUpperCase();
  if (!q) return null;
  const matching = new Set<number>();
  data.nodes.forEach((n, i) => {
    if (n.name.toUpperCase().includes(q)) matching.add(i);
  });
  return matching;
}

export function isNodeVisible(
  data: ProcessFlow,
  index: number,
  focus: { nodes: Set<number> } | null,
  searchHits: Set<number> | null,
) {
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
}

export function isLinkVisible(
  link: GraphLinkLayout,
  focus: { links: Set<number> } | null,
  searchHits: Set<number> | null,
) {
  if (focus && !focus.links.has(link.idx)) return false;
  if (searchHits && !(searchHits.has(link.source) || searchHits.has(link.target))) return false;
  return true;
}
