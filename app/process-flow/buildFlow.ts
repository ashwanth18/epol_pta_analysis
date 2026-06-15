import type { ProcessFlow, ProcessFlowLink, ProcessFlowNode } from "@/lib/data";

const OTHER_INGREDIENTS = "Other ingredients";
const OTHER_PRODUCTS = "Other products";
const TOP_PRODUCTS = 12;

export const INGREDIENT_TOP_OPTIONS = [5, 8, 12, 15, 20, 25] as const;

function mergeNamedLinks(
  links: { source: string; target: string; value: number }[],
  relabelSource?: (name: string) => string,
  relabelTarget?: (name: string) => string,
) {
  const map = new Map<string, number>();
  for (const l of links) {
    const source = relabelSource ? relabelSource(l.source) : l.source;
    const target = relabelTarget ? relabelTarget(l.target) : l.target;
    const key = `${source}\0${target}`;
    map.set(key, (map.get(key) ?? 0) + l.value);
  }
  return [...map.entries()].map(([key, value]) => {
    const [source, target] = key.split("\0");
    return { source, target, value: Math.round(value * 100) / 100 };
  });
}

export function buildProcessFlow(data: ProcessFlow, topIngredients: number): ProcessFlow {
  const raw = data.raw_flows;
  if (!raw) return data;

  const ingMass = new Map<string, number>();
  for (const l of raw.ing_whr) {
    ingMass.set(l.source, (ingMass.get(l.source) ?? 0) + l.value);
  }
  const ranked = [...ingMass.entries()].sort((a, b) => b[1] - a[1]);
  const limit = Math.min(Math.max(1, topIngredients), ranked.length);
  const topSet = new Set(ranked.slice(0, limit).map(([name]) => name));
  const labelIngredient = (name: string) => (topSet.has(name) ? name : OTHER_INGREDIENTS);

  const prodMass = new Map<string, number>();
  for (const l of raw.route_prod) {
    prodMass.set(l.target, (prodMass.get(l.target) ?? 0) + l.value);
  }
  const rankedProds = [...prodMass.entries()].sort((a, b) => b[1] - a[1]);
  const topProdSet = new Set(rankedProds.slice(0, TOP_PRODUCTS).map(([name]) => name));
  const labelProduct = (name: string) => (topProdSet.has(name) ? name : OTHER_PRODUCTS);

  const ingWhr = mergeNamedLinks(raw.ing_whr, labelIngredient);
  const whrRoute = mergeNamedLinks(raw.whr_route);
  const routeProd = mergeNamedLinks(raw.route_prod, undefined, labelProduct);

  const nodeIndex = new Map<string, number>();
  const nodes: ProcessFlowNode[] = [];

  const addNode = (name: string, stage: number) => {
    const key = `${stage}:${name}`;
    if (!nodeIndex.has(key)) {
      nodeIndex.set(key, nodes.length);
      nodes.push({
        name,
        stage,
        stage_label: data.stages[stage] ?? "",
        value: 0,
      });
    }
    return nodeIndex.get(key)!;
  };

  const links: ProcessFlowLink[] = [];
  const appendLinks = (
    flow: { source: string; target: string; value: number }[],
    sourceStage: number,
    targetStage: number,
  ) => {
    for (const f of flow) {
      links.push({
        source: addNode(f.source, sourceStage),
        target: addNode(f.target, targetStage),
        value: f.value,
      });
    }
  };

  appendLinks(ingWhr, 0, 1);
  appendLinks(whrRoute, 1, 2);
  appendLinks(routeProd, 2, 3);

  const inSum = new Array<number>(nodes.length).fill(0);
  const outSum = new Array<number>(nodes.length).fill(0);
  for (const l of links) {
    outSum[l.source] += l.value;
    inSum[l.target] += l.value;
  }
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].value = Math.round(Math.max(inSum[i], outSum[i]) * 100) / 100;
  }

  return {
    ...data,
    nodes,
    links,
    notes: [
      data.notes[0],
      limit >= ranked.length
        ? `All ${ranked.length} ingredients shown individually by mass.`
        : `Top ${limit} of ${ranked.length} ingredients shown individually; remainder grouped as '${OTHER_INGREDIENTS}'.`,
      data.notes[2] ?? "",
    ],
  };
}

export function ingredientFilterOptions(total: number) {
  const opts = INGREDIENT_TOP_OPTIONS.filter((n) => n < total);
  return [...opts, total];
}

export function parseTopIngredients(raw: string | undefined, data: ProcessFlow): number {
  const max = data.ingredient_count ?? 50;
  const fallback = data.default_top_ingredients ?? 12;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.round(n), max);
}
