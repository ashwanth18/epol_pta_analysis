import alarmsData from "@/data/alarms-insights.json";
import commercialData from "@/data/commercial.json";
import gapData from "@/data/gap-analysis.json";
import inventoryData from "@/data/inventory.json";
import kgData from "@/data/knowledge-graph.json";
import pdmData from "@/data/pdm.json";
import certData from "@/data/certificates.json";
import throughputData from "@/data/throughput.json";
import weighmentsData from "@/data/weighments.json";
import processFlowData from "@/data/process-flow.json";
import energyEstimateData from "@/data/energy-estimate.json";

export const commercial = commercialData as Commercial;
export const alarmsInsights = alarmsData as AlarmsInsights;
export const gap = gapData as Gap;
export const inventory = inventoryData as Inventory;
export const knowledgeGraph = kgData as KnowledgeGraph;
export const pdm = pdmData as Pdm;
export const certificates = certData as Certificates;
export const throughput = throughputData as ThroughputAnalytics;
export const weighments = weighmentsData as WeighmentAnalytics;
export const processFlow = processFlowData as ProcessFlow;
export const energyEstimate = energyEstimateData as EnergyEstimate;

// ---------- Types ----------
export interface InventoryField {
  n: string;
  t: string;
  l: number;
}
export interface InventoryRelated {
  n: string;
  s: number;
  f: string[];
}
export interface InventoryTable {
  n: string;
  c: string;
  p: string;
  rec: number;
  kb: number;
  w: string;
  s: string;
  y: string;
  f: InventoryField[];
  nf: number;
  r: InventoryRelated[];
}
export interface Inventory {
  tables: InventoryTable[];
  cats: Record<string, number>;
  purps: Record<string, number>;
  total: number;
  total_records: number;
}

export interface DailyTonnes {
  date: string;
  tonnes: number;
}
export interface Production {
  batches: number;
  tonnes: number;
  days_observed: number;
  date_from: string | null;
  date_to: string | null;
  mean_t_day: number;
  std_t_day: number;
  unique_skus: number;
  unassigned_pct: number;
  daily_series: DailyTonnes[];
}
export interface CommercialThroughput {
  t_per_h_mean: number;
  duration_min_mean: number;
  total_hours: number;
  batches_timed: number;
  pct_timed: number;
}
export interface CommercialMonthly {
  month: string;
  batches: number;
  tonnes: number;
  days: number;
  mean_t_day: number;
  in_tol_pct: number | null;
  batch_perfect_pct: number | null;
  skus: number;
  unassigned_pct: number;
}
export interface Weigher {
  name: string;
  weighs: number;
  in_tol_pct: number;
  avg_abs_var: number;
  avg_sgn_var: number;
  ingredient_count?: number;
  ingredients?: WeigherMaterialLink[];
}
export interface WeigherMaterialLink {
  code: string;
  name: string;
  weighs: number;
  in_tol_pct: number;
  share_pct: number;
}
export interface MaterialWeigherLink {
  weigher: string;
  weighs: number;
  in_tol_pct: number;
  share_pct: number;
}
export interface WeigherIngredientLink {
  weigher: string;
  mat_code: string;
  mat_name: string;
  weighs: number;
  in_tol_pct: number;
  avg_abs_var: number;
  share_of_weigher_pct: number;
  share_of_material_pct: number;
}
export interface WeigherIngredientMap {
  window_from: string | null;
  window_to: string | null;
  link_count: number;
  weigher_count: number;
  material_count: number;
  links: WeigherIngredientLink[];
}
export interface Sku {
  code: string;
  desc: string;
  tonnes: number;
  batches: number;
}
export interface CustomerSlice {
  name: string;
  tonnes: number;
}
export interface Alert {
  level: "red" | "amber" | "green";
  title: string;
  value: string;
  impact_gbp: number;
  note: string;
}
export interface TimelineEntry {
  table: string;
  label: string;
  records: number;
  from: string | null;
  to: string | null;
  span_days: number;
  note: string | null;
}
export interface AccuracyRow {
  code?: string;
  name?: string;
  group?: string;
  weighs: number;
  in_tol_pct: number;
  avg_abs_var: number;
  avg_bias?: number;
  avg_sgn_var?: number;
}
export interface BatchAccuracySummary {
  batches: number;
  perfect: number;
  perfect_pct: number;
  any_miss: number;
  any_miss_pct: number;
  avg_misses_per_batch: number;
}
export interface Accuracy {
  window_from: string | null;
  window_to: string | null;
  weighments_total: number;
  weighments_in_window: number;
  batch_summary: BatchAccuracySummary;
  weigher_groups: AccuracyRow[];
  ingredients: AccuracyRow[];
  formulations: AccuracyRow[];
}
export interface IngredientMaster {
  ing_no: number | null;
  code: string;
  name: string;
  control: boolean;
  is_flush: boolean;
  uom: string;
  stkttypno: number;
  desc: string;
  formula_lines: number;
  in_batch_window: boolean;
  weighs: number;
  in_tol_pct: number | null;
  avg_abs_var: number | null;
  weighers: MaterialWeigherLink[];
  primary_weigher: string | null;
}
export interface IngredientCatalog {
  total_slots: number;
  active: number;
  empty_slots: number;
  in_batch_window: number;
  in_formulas: number;
  items: IngredientMaster[];
}
export interface Commercial {
  production: Production;
  monthly: CommercialMonthly[];
  timeline: TimelineEntry[];
  accuracy: Accuracy;
  throughput: CommercialThroughput;
  weighers: Weigher[];
  skus: Sku[];
  customers: CustomerSlice[];
  ingredient_catalog: IngredientCatalog;
  weigher_ingredient: WeigherIngredientMap;
  inventory_value_gbp: number;
  alerts: Alert[];
}

export interface GapKpi {
  section: string;
  control: string;
  kpi: string;
  score: number;
  rag: "RED" | "AMBER" | "GREEN";
  evidence: string;
  gap_gbp: number | null;
  source: string;
}
export interface GapSection {
  section: string;
  avg: number | null;
  green: number;
  amber: number;
  red: number;
  total: number;
  gap_gbp: number;
}
export interface GapSummary {
  total: number;
  green: number;
  amber: number;
  red: number;
  total_gap_gbp: number;
  matrix_total: number;
  scored_from_data: number;
}
export interface GapMonthly {
  month: string;
  scores: Record<string, number>;
  avg: number;
  rag: "RED" | "AMBER" | "GREEN";
  metrics: {
    unassigned_pct: number;
    batch_perfect_pct: number;
    in_tol_pct: number;
    changeover_test_pct: number | null;
    tonne_cv: number;
  };
}
export interface Gap {
  kpis: GapKpi[];
  sections: GapSection[];
  monthly: GapMonthly[];
  monthly_kpis: string[];
  summary: GapSummary;
}

export interface KgNode {
  id: string;
  label: string;
  sub?: string;
  cat?: string;
  value?: number;
  note?: string;
}
export interface KnowledgeGraph {
  tables: KgNode[];
  concepts: KgNode[];
  products: KgNode[];
  edges_table_concept: [string, string][];
  edges_concept_product: [string, string][];
}

export interface StockForecast {
  code: string;
  name: string;
  stock_t: number;
  burn_t_day: number;
  days_left: number;
  status: "stockout" | "critical" | "warning" | "overstocked" | "ok";
  value_gbp: number;
}
export interface NamedCount {
  name: string;
  count: number;
}
export interface PdmTotals {
  manual_events: number;
  alarm_events: number;
  materials_tracked: number;
  stockouts: number;
  critical: number;
  overstocked: number;
  inventory_value: number;
}
export interface Pdm {
  stock_forecast: StockForecast[];
  weighers: Weigher[];
  manual_events: NamedCount[];
  alarms: NamedCount[];
  totals: PdmTotals;
}

export interface CertBatch {
  log_batch: string;
  frm_code: string;
  cust_name: string;
  start: string;
  target_wgt: number;
  actual_wgt: number;
  kwh: number;
}
export interface Certificates {
  batches: CertBatch[];
}

export interface AlarmsCoverage {
  alarm_log_from: string | null;
  alarm_log_to: string | null;
  alarm_log_hours: number;
  manual_log_from: string | null;
  manual_log_to: string | null;
  batch_window_from: string | null;
  batch_window_to: string | null;
  batch_window_count: number;
  sep22_correlation_batches: number;
  log_batch_linked: boolean;
  note: string;
}
export interface AlarmsBatchStats {
  batches: number;
  with_alarms: number;
  pct_with_alarms: number;
  avg_alarms: number;
  total_events: number;
}
export interface AlarmsEnriched {
  name: string;
  nc_events: number;
  conform_events: number;
  nc_rate_per_batch: number;
  conform_rate_per_batch: number;
  enrichment_ratio: number | null;
}
export interface AlarmsTheme {
  theme: string;
  count: number;
}
export interface AlarmsHourly {
  hour: number;
  count: number;
}
export interface AlarmsDurationItem {
  name: string;
  events: number;
  intervals: number;
  total_min: number;
  avg_min: number;
}
export interface AlarmsThemeDuration {
  theme: string;
  total_min: number;
  hours: number;
}
export interface AlarmsDuration {
  total_min: number;
  total_hours: number;
  summed_hours: number;
  window_hours: number;
  active_pct: number | null;
  intervals: number;
  intervals_capped: number;
  cap_min: number;
  unclosed: number;
  by_theme: AlarmsThemeDuration[];
  top_alarms: AlarmsDurationItem[];
  note: string;
}
export interface AlarmsMonthly {
  month: string;
  events: number;
  time_lost_h: number;
  top_theme: string | null;
  changeovers: number;
  changeover_test_pct: number | null;
}
export interface AlarmsTakeaway {
  tone: "red" | "amber" | "green";
  title: string;
  body: string;
}
export interface AlarmsInsights {
  coverage: AlarmsCoverage;
  totals: {
    alarm_events_raw: number;
    alarm_events_operational: number;
    windows_noise_events: number;
    alarm_matched_to_batches: number;
    alarm_unmatched: number;
    unique_alarm_types: number;
    manual_events: number;
  };
  batch_conformance: {
    batches_conform: number;
    batches_nonconform: number;
    batches_conform_pct: number;
    weighments_conform: number;
    weighments_nonconform: number;
    weighments_conform_pct: number;
  };
  themes: AlarmsTheme[];
  hourly: AlarmsHourly[];
  top_alarms: NamedCount[];
  tolerance_alarms: NamedCount[];
  duration: AlarmsDuration;
  monthly: AlarmsMonthly[];
  sep22_correlation: {
    date: string | null;
    conform: AlarmsBatchStats;
    nonconform: AlarmsBatchStats;
    all: AlarmsBatchStats;
    top_on_nonconform: NamedCount[];
    enriched_on_nonconform: AlarmsEnriched[];
    nonconform_weighments_by_weigher: NamedCount[];
  };
  manual_comparison: {
    conform_avg_per_batch: number;
    nonconform_avg_per_batch: number;
    top_on_nonconform: NamedCount[];
    top_on_conform: NamedCount[];
  };
  takeaways: AlarmsTakeaway[];
}

export interface ThroughputSummary {
  batches_total: number;
  batches_timed: number;
  pct_timed: number;
  total_tonnes: number;
  total_hours: number;
  t_per_h_mean: number;
  t_per_h_stdev: number;
  t_per_h_median: number;
  t_per_h_p10: number;
  t_per_h_p90: number;
  duration_min_mean: number;
  duration_min_stdev: number;
  batches_per_day_mean: number;
}
export interface ThroughputDaily {
  date: string;
  batches: number;
  tonnes: number;
  hours: number;
  t_per_h: number;
  duration_min_mean: number;
}
export interface ThroughputHourly {
  hour: number;
  batches: number;
  t_per_h_mean: number;
  duration_min_mean: number;
}
export interface ThroughputMonthly {
  month: string;
  batches: number;
  tonnes: number;
  hours: number;
  t_per_h: number;
  duration_min_mean: number;
}
export interface ThroughputRoute {
  route: string;
  batches: number;
  tonnes: number;
  hours: number;
  t_per_h: number;
  duration_min_mean: number;
  duration_min_stdev: number;
}
export interface ThroughputSku {
  code: string;
  name: string;
  batches: number;
  tonnes: number;
  hours: number;
  t_per_h: number;
  duration_min_mean: number;
  duration_min_stdev: number;
}
export interface ThroughputIngCountBucket {
  ingredient_count: number;
  batches: number;
  duration_min_mean: number;
  t_per_h_mean: number;
}
export interface ThroughputDistributionBin {
  bin_start: number;
  bin_end: number;
  count: number;
  label: string;
}
export interface ThroughputBatch {
  log_batch: string;
  date: string | null;
  hour: number | null;
  route: string;
  frm_code: string;
  frm_name: string;
  tonnes: number;
  duration_min: number;
  t_per_h: number;
  ingredients: number;
}
export interface ThroughputAnalytics {
  window_from: string | null;
  window_to: string | null;
  summary: ThroughputSummary;
  daily: ThroughputDaily[];
  monthly: ThroughputMonthly[];
  hourly: ThroughputHourly[];
  routes: ThroughputRoute[];
  skus: ThroughputSku[];
  ingredient_count_buckets: ThroughputIngCountBucket[];
  distribution: ThroughputDistributionBin[];
  batches: ThroughputBatch[];
  notes: string[];
}

export type WeighMode = "auto" | "hand";

export interface WeighmentModeStats {
  weighs: number;
  in_tol_pct: number;
  avg_abs_var: number;
  avg_bias: number;
  weighers: string[];
  materials: number;
}

export interface WeighmentIngredientRow {
  mat_code: string;
  mat_name: string;
  weigh_mode: WeighMode;
  primary_weigher: string;
  batches: number;
  total_kg: number;
  weighs: number;
  in_tol_pct: number;
  avg_abs_var: number;
  avg_bias: number;
}

export interface WeighmentWeigherRow {
  weigher: string;
  weigh_mode: WeighMode;
  is_hand_scale: boolean;
  batches: number;
  materials: number;
  top_materials: { code: string; weighs: number }[];
  total_kg: number;
  weighs: number;
  in_tol_pct: number;
  avg_abs_var: number;
  avg_bias: number;
}

export interface WeighmentLinkRow {
  weigher: string;
  mat_code: string;
  mat_name: string;
  weigh_mode: WeighMode;
  batches: number;
  total_kg: number;
  weighs: number;
  in_tol_pct: number;
  avg_abs_var: number;
  avg_bias: number;
}

export interface WeighmentAnalytics {
  window_from: string | null;
  window_to: string | null;
  hand_weighers: string[];
  definition: string;
  summary: {
    weighments_in_window: number;
    weighments_scored: number;
    auto: WeighmentModeStats | null;
    hand: WeighmentModeStats | null;
    batches_in_window: number;
    batches_with_hand_drops: number;
  };
  ingredients: WeighmentIngredientRow[];
  weighers: WeighmentWeigherRow[];
  links: WeighmentLinkRow[];
}

export interface ProcessFlowNode {
  name: string;
  stage: number;
  stage_label: string;
  value: number;
}
export interface ProcessFlowLink {
  source: number;
  target: number;
  value: number;
}
export interface ProcessFlowRawLink {
  source: string;
  target: string;
  value: number;
}
export interface ProcessFlowRawFlows {
  ing_whr: ProcessFlowRawLink[];
  whr_route: ProcessFlowRawLink[];
  route_prod: ProcessFlowRawLink[];
}
export interface ProcessFlow {
  window_from: string | null;
  window_to: string | null;
  unit: string;
  stages: string[];
  total_t: number;
  weighments: number;
  ingredient_count?: number;
  default_top_ingredients?: number;
  nodes: ProcessFlowNode[];
  links: ProcessFlowLink[];
  raw_flows?: ProcessFlowRawFlows;
  notes: string[];
}

export interface EnergyDistributionBin {
  bin_start: number;
  bin_end: number;
  count: number;
  label: string;
}
export interface EnergyModel {
  source: string;
  trained_on_batches: number | null;
  kwh_per_t_mean: number;
  kwh_per_t_median: number;
  kwh_per_t_p10: number;
  kwh_per_t_p90: number;
  kwh_per_t_stdev: number;
  ingredient_buckets: { ingredient_count: number; kwh_per_t: number; batches: number }[];
  distribution?: EnergyDistributionBin[];
}
export interface EnergyScenario {
  batches: number;
  tonnes: number;
  est_kwh: number;
  est_kwh_low: number;
  est_kwh_high: number;
  kwh_per_t: number;
  est_cost_gbp: number;
  est_cost_low_gbp: number;
  est_cost_high_gbp: number;
  est_kwh_grossed?: number;
  est_cost_grossed_gbp?: number;
}
export interface EnergyCoverage {
  timed_batches: number;
  timed_tonnes: number;
  total_tonnes: number;
  tonnes_coverage_pct: number;
  gross_up_factor: number;
  pen_training_ingredient_range: [number | null, number | null];
}
export interface EnergyMonthly {
  month: string;
  tonnes: number;
  est_kwh: number;
  est_kwh_low: number;
  est_kwh_high: number;
  est_cost_gbp: number;
}
export interface EnergyRoute {
  route: string;
  press: boolean;
  batches: number;
  tonnes: number;
  est_kwh: number;
  kwh_per_t: number;
}
export interface EnergySku {
  code: string;
  name: string;
  batches: number;
  tonnes: number;
  est_kwh: number;
  kwh_per_t: number;
}
export interface EnergyDaily {
  date: string;
  tonnes: number;
  est_kwh: number;
}
export interface EnergyIngredientSensitivity {
  ingredient_count: number;
  batches: number;
  tonnes: number;
  model_kwh_per_t: number;
  in_training_range: boolean;
}
export interface EnergyEstimate {
  window_from: string | null;
  window_to: string | null;
  tariff_gbp_per_kwh: number;
  model: EnergyModel;
  coverage: EnergyCoverage;
  scenarios: { all: EnergyScenario; press_only: EnergyScenario };
  monthly: EnergyMonthly[];
  by_route: EnergyRoute[];
  by_sku: EnergySku[];
  daily: EnergyDaily[];
  ingredient_sensitivity: EnergyIngredientSensitivity[];
  distribution: EnergyDistributionBin[];
  notes: string[];
  generated_at: string;
}
