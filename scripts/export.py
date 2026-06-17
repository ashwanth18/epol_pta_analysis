#!/usr/bin/env python3
"""
export.py — epol PTA pipeline.

Reads the date-partitioned DBF snapshots in ../epolPTA/2026/MM/DD/*.DBF, merges
them across all days (de-duplicating overlapping ring-buffer snapshots), and
writes JSON files into ../data/ for the Next.js app to consume at build time.

Key differences vs the Penmill (storaweigh) dataset:
  * Date-partitioned daily snapshots, not a single flat folder.
  * No master tables (INGS / FRMS / FRMITEMS / CUSTS / SWHRS) — names are
    denormalised into the transaction rows (MAT_NAME / FRM_NAME / CUST_NAME).
  * No energy/kWh anywhere — the Energy page is replaced by Throughput & Cycle Time.
  * Weighers are numeric WHR_NO only (no names, no hand/auto flag) — classified
    here by typical target size into Macro / Medium / Micro.
  * Richer carryover data: CCLOGS logs every formula changeover (cross-contam).
  * ALMLOGS.LOG_BATCH is populated, so alarms link to batches directly.

Outputs:
  data/inventory.json       — table catalog (schema + descriptions + relations)
  data/gap-analysis.json    — KPI matrix with auto-scores
  data/knowledge-graph.json — nodes/edges for the value-chain graph
  data/commercial.json      — KPIs, top SKUs, customers, alerts
  data/pdm.json             — weigher drift, stock forecast, alarms, manual events
  data/certificates.json    — batches available for cert generation
  data/alarms-insights.json — alarm themes, hourly profile, conformance correlation
  data/throughput.json      — batch durations, t/h rate, route & SKU breakdown
  data/weighments.json      — macro vs micro weigher performance
  data/process-flow.json    — Ingredient -> Weigher -> Route -> Product Sankey
"""
import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from statistics import mean, median, stdev

from dbfread import DBF

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "epolPTA"
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

CUR = "R"  # currency prefix used by the UI formatter (ZAR for a South African mill)


def F(x, d=0.0):
    try:
        return float(x)
    except Exception:
        return d


def parse_dt(s):
    if not s or str(s).startswith("0000"):
        return None
    txt = str(s).strip()
    for fmt in ("%Y-%m-%d,%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(txt, fmt)
        except Exception:
            continue
    return None


# ============================================================ #
# Date-partition aware loaders (merge + dedup across all days)
# ============================================================ #
def _day_files(table):
    """All daily snapshot paths for a table, chronologically."""
    return sorted(STORE.glob(f"2026/*/*/{table}"))


# Per-table dedup keys. Ring-buffer tables (BWEIGHS, *LOG*) repeat record
# numbers across day snapshots, so we key on the PK plus a timestamp/identity
# field to keep genuinely distinct rows while dropping exact re-snapshots.
KEYFN = {
    "BSTARTS.DBF": lambda r: (r.get("BSTART_NO"), r.get("LOG_BATCH")),
    "BENDS.DBF": lambda r: (r.get("BEND_NO"), r.get("LOG_BATCH")),
    "BEND2S.DBF": lambda r: (r.get("BEND2_NO"), r.get("LOG_BATCH")),
    "BWEIGHS.DBF": lambda r: (r.get("LOG_BATCH"), r.get("BWEIGH_NO"),
                              (r.get("MAT_CODE") or "").strip(), str(r.get("START_TIME"))),
    "BSTLOG.DBF": lambda r: (r.get("BSTLOG_NO"), str(r.get("DATE")), (r.get("MAT_CODE") or "").strip()),
    "MSTLOG.DBF": lambda r: (r.get("MSTLOG_NO"), str(r.get("DATE")), (r.get("MAT_CODE") or "").strip()),
    "CCLOGS.DBF": lambda r: (r.get("CCLOG_NO"), str(r.get("DATE")), (r.get("VESSEL") or "").strip()),
    "ALMLOGS.DBF": lambda r: (r.get("ALMLOG_NO"), str(r.get("BATCH_TIME")), str(r.get("TIME"))),
    "MANLOG.DBF": lambda r: (r.get("MANLOG_NO"), str(r.get("DATE"))),
    "SCTLOGS.DBF": lambda r: (r.get("SCTLOG_NO"), str(r.get("DATE")), (r.get("SCT_NAME") or "").strip()),
    "RTCLOGS.DBF": lambda r: (r.get("RTCLOG_NO"), str(r.get("DATE"))),
    "PLNLOG.DBF": lambda r: (r.get("PLNLOG_NO"), str(r.get("DATE"))),
    "ONLNLOGS.DBF": lambda r: (r.get("ONLNLOG_NO"), str(r.get("DATE"))),
    "LBLPRINT.DBF": lambda r: (r.get("LBLPRINT_NO"), str(r.get("TIME"))),
    "INTLOGS.DBF": lambda r: (r.get("INTLOG_NO"), str(r.get("DATE"))),
    "FRMLOG.DBF": lambda r: (r.get("FRMLOG_NO"), str(r.get("DATE"))),
    "BEND2S.DBF": lambda r: (r.get("BEND2_NO"), r.get("LOG_BATCH")),
}


def _keyfn(table):
    return KEYFN.get(table, lambda r: tuple(
        (k, str(v)) for k, v in r.items() if k not in ("MODREC", "LOG_NO")
    ))


def merge(table):
    """Load + dedup every daily snapshot of a table into one list of dicts."""
    kf = _keyfn(table)
    seen = set()
    out = []
    for path in _day_files(table):
        try:
            for r in DBF(path, encoding="latin-1", ignore_missing_memofile=True):
                k = kf(r)
                if k in seen:
                    continue
                seen.add(k)
                out.append(r)
        except Exception as e:
            print(f"  ! {path.name} ({path.parent}): {e}")
    return out


def count_merged(table):
    """Deduped row count without retaining the rows (for big inventory tables)."""
    kf = _keyfn(table)
    seen = set()
    for path in _day_files(table):
        try:
            for r in DBF(path, encoding="latin-1", ignore_missing_memofile=True):
                seen.add(kf(r))
        except Exception:
            pass
    return len(seen)


def stdev_safe(vals):
    return round(stdev(vals), 3) if len(vals) > 1 else 0.0


def percentile(vals, p):
    s = sorted(vals)
    if not s:
        return 0.0
    i = int(len(s) * p / 100)
    return round(s[min(i, len(s) - 1)], 3)


def is_ingredient(code):
    c = (code or "").strip()
    return bool(c) and c not in ("LOAD TUB", "ADD TUB") and not c.endswith("TUB")


# ============================================================ #
# 1. LOAD CORE TABLES
# ============================================================ #
print("[1/9] Merging daily snapshots...")
bstarts = merge("BSTARTS.DBF")
bend2s = merge("BEND2S.DBF")
bends = merge("BENDS.DBF")

bend2_by = {}
for r in bend2s:
    lb = r.get("LOG_BATCH")
    if lb is not None:
        bend2_by[lb] = r
bend_by = {}
for r in bends:
    lb = r.get("LOG_BATCH")
    if lb is not None and lb not in bend_by:
        bend_by[lb] = r

batch_frm = {s.get("LOG_BATCH"): (s.get("FRM_CODE") or "").strip() for s in bstarts}
batch_route = {s.get("LOG_BATCH"): (s.get("ROUTE") or "").strip() or "?" for s in bstarts}
batch_window = set(batch_frm.keys())
sku_desc = {}
for s in bstarts:
    code = (s.get("FRM_CODE") or "").strip()
    nm = (s.get("FRM_NAME") or "").strip()
    if code and nm and code not in sku_desc:
        sku_desc[code] = nm

# ---- Slim, memory-conscious BWEIGHS load ----
# 485k+ deduped weighments would blow memory as full DBF dicts, so we stream the
# daily snapshots, dedup, and keep only ingredient rows projected to the fields
# the pipeline actually uses.
BW_KEEP = ("LOG_BATCH", "MAT_CODE", "MAT_NAME", "WHR_NO", "TARGET", "ACTUAL", "TOLERANCE", "CONTROL", "LOT_NO")


def merge_bweighs():
    kf = _keyfn("BWEIGHS.DBF")
    seen = set()
    rows_out = []
    total = 0
    for path in _day_files("BWEIGHS.DBF"):
        try:
            table = DBF(path, encoding="latin-1", ignore_missing_memofile=True)
        except Exception as e:
            print(f"  ! {path}: {e}")
            continue
        for r in table:
            k = kf(r)
            if k in seen:
                continue
            seen.add(k)
            total += 1
            if r.get("LOG_BATCH") in batch_window and is_ingredient(r.get("MAT_CODE")):
                rows_out.append({key: r.get(key) for key in BW_KEEP})
    return rows_out, total


bw_window, bweighs_total = merge_bweighs()
print(f"   batches={len(bstarts):,}  completions={len(bend2s):,}  "
      f"weighments(dedup)={bweighs_total:,}  ingredient-in-window={len(bw_window):,}")

# ---- Weigher classification (no master table; infer from target size) ----
# Cache avg/class/name per WHR_NO once (recomputing mean() per weighment would be
# O(n*m) over hundreds of thousands of rows).
_whr_sum = defaultdict(float)
_whr_cnt = defaultdict(int)
for w in bw_window:
    t = F(w.get("TARGET"))
    if t > 0:
        _whr_sum[w.get("WHR_NO")] += t
        _whr_cnt[w.get("WHR_NO")] += 1

_whr_cls = {}
_whr_nm = {}
for no in _whr_cnt:
    avg = _whr_sum[no] / _whr_cnt[no] if _whr_cnt[no] else 0
    cls = "Macro" if avg >= 100 else "Medium" if avg >= 10 else "Micro"
    _whr_cls[no] = cls
    _whr_nm[no] = f"W{int(no)} {cls}" if no is not None else "W?"


def whr_class(no):
    return _whr_cls.get(no, "Micro")


def whr_name(no):
    return _whr_nm.get(no, "W?" if no is None else f"W{int(no)} Micro")


# Micro/additive scales are the hand-add equivalents; Macro+Medium are auto bulk.
hand_weighers = {_whr_nm[no] for no in _whr_cls if _whr_cls[no] == "Micro"}


# ---- Per-batch derived weight (tonnes) ----
bw_actual_by_batch = defaultdict(float)
for w in bw_window:
    bw_actual_by_batch[w.get("LOG_BATCH")] += F(w.get("ACTUAL"))


def batch_tonnes(lb, size_default=2.0):
    e = bend2_by.get(lb)
    if e and F(e.get("TOT_ACT")) > 0:
        return F(e.get("TOT_ACT")) / 1000
    if bw_actual_by_batch.get(lb, 0) > 0:
        return bw_actual_by_batch[lb] / 1000
    return size_default


# ============================================================ #
# 2. CORE METRICS / PRODUCTION
# ============================================================ #
print("[2/9] Core production metrics...")
daily = defaultdict(float)
for s in bstarts:
    d = parse_dt(s.get("START_TIME"))
    if d:
        daily[d.date()] += batch_tonnes(s.get("LOG_BATCH"))
days = sorted(daily.keys())
ts = [daily[d] for d in days]

start_dts = [parse_dt(s.get("START_TIME")) for s in bstarts if parse_dt(s.get("START_TIME"))]
production = {
    "batches": len(bstarts),
    "tonnes": round(sum(ts), 1),
    "days_observed": len(days),
    "date_from": min(start_dts).strftime("%Y-%m-%d") if start_dts else None,
    "date_to": max(start_dts).strftime("%Y-%m-%d") if start_dts else None,
    "mean_t_day": round(mean(ts), 1) if ts else 0,
    "std_t_day": round(stdev(ts), 1) if len(ts) > 1 else 0,
    "unique_skus": len(set((r.get("FRM_CODE") or "").strip() for r in bstarts if (r.get("FRM_CODE") or "").strip())),
    "unassigned_pct": round(100 * sum(1 for r in bstarts if not (r.get("CUST_NAME") or "").strip()) / max(len(bstarts), 1), 1),
    "daily_series": [{"date": d.isoformat(), "tonnes": round(daily[d], 1)} for d in days],
}

# ---- Shared month buckets (YYYY-MM) for month-on-month KPIs ----
batch_month = {}
prod_m_t = defaultdict(float)
prod_m_b = defaultdict(int)
prod_m_days = defaultdict(set)
prod_m_skus = defaultdict(set)
prod_m_noassign = defaultdict(int)
for s in bstarts:
    d = parse_dt(s.get("START_TIME"))
    if not d:
        continue
    m = d.strftime("%Y-%m")
    batch_month[s.get("LOG_BATCH")] = m
    prod_m_t[m] += batch_tonnes(s.get("LOG_BATCH"))
    prod_m_b[m] += 1
    prod_m_days[m].add(d.date())
    frm = (s.get("FRM_CODE") or "").strip()
    if frm:
        prod_m_skus[m].add(frm)
    if not (s.get("CUST_NAME") or "").strip():
        prod_m_noassign[m] += 1


# ---- weighment helpers ----
def weigh_row(w):
    tgt = F(w.get("TARGET"))
    act = F(w.get("ACTUAL"))
    tol = F(w.get("TOLERANCE")) or 5
    if tgt <= 0:
        return None
    var = (act - tgt) / tgt * 100
    return {"ok": abs(var) <= tol, "abs": abs(var), "bias": var}


# ---- compact accumulators: [n, n_ok, sum_abs, sum_bias] (avoids storing rows) ----
def acc_new():
    return [0, 0, 0.0, 0.0]


def acc_add(a, ok, av, bv):
    a[0] += 1
    a[1] += 1 if ok else 0
    a[2] += av
    a[3] += bv


def acc_stats(a):
    n = a[0]
    if not n:
        return None
    return {"weighs": n, "in_tol_pct": round(100 * a[1] / n, 1),
            "avg_abs_var": round(a[2] / n, 2), "avg_bias": round(a[3] / n, 2)}


# ============================================================ #
# 3. WEIGHMENT ACCURACY (single pass, by weigher / ingredient / formula / mode)
# ============================================================ #
print("[3/9] Weighment accuracy...")
whr_acc = defaultdict(acc_new)
ing_acc = defaultdict(acc_new)
ing_nm = {}
pair_acc = defaultdict(acc_new)
pair_nm = {}
frm_acc = defaultdict(acc_new)
by_batch = defaultdict(list)
group_acc = {"Macro (bulk)": acc_new(), "Medium": acc_new(), "Micro (additive)": acc_new()}
mode_acc = {"auto": acc_new(), "hand": acc_new()}
ingmode_acc = defaultdict(acc_new)
ingmode_meta = defaultdict(lambda: {"name": "", "whrs": Counter(), "batches": set(), "total_kg": 0.0})
whr2_acc = defaultdict(acc_new)
whr2_meta = defaultdict(lambda: {"batches": set(), "total_kg": 0.0, "materials": Counter()})
link_acc = defaultdict(acc_new)
link_meta = defaultdict(lambda: {"name": "", "batches": set(), "total_kg": 0.0})
month_acc = defaultdict(acc_new)  # weighment in-tolerance by month
scored_total = 0

for w in bw_window:
    tgt = F(w.get("TARGET"))
    if tgt <= 0:
        continue
    act = F(w.get("ACTUAL"))
    tol = F(w.get("TOLERANCE")) or 5
    var = (act - tgt) / tgt * 100
    absv = abs(var)
    ok = absv <= tol
    scored_total += 1
    no = w.get("WHR_NO")
    whr = whr_name(no)
    cls = whr_class(no)
    code = (w.get("MAT_CODE") or "").strip()
    name = (w.get("MAT_NAME") or "").strip()
    lb = w.get("LOG_BATCH")
    mode = "hand" if whr in hand_weighers else "auto"

    acc_add(whr_acc[whr], ok, absv, var)
    ing_nm[code] = name
    acc_add(ing_acc[code], ok, absv, var)
    pair_nm[(whr, code)] = name
    acc_add(pair_acc[(whr, code)], ok, absv, var)
    acc_add(frm_acc[batch_frm.get(lb, "?")], ok, absv, var)
    by_batch[lb].append(ok)
    acc_add(group_acc["Macro (bulk)" if cls == "Macro" else "Micro (additive)" if cls == "Micro" else "Medium"], ok, absv, var)

    acc_add(mode_acc[mode], ok, absv, var)
    acc_add(ingmode_acc[(code, mode)], ok, absv, var)
    im = ingmode_meta[(code, mode)]
    im["name"] = name; im["whrs"][whr] += 1; im["total_kg"] += act
    if lb is not None:
        im["batches"].add(lb)
    acc_add(whr2_acc[whr], ok, absv, var)
    wd = whr2_meta[whr]
    wd["total_kg"] += act; wd["materials"][code] += 1
    if lb is not None:
        wd["batches"].add(lb)
    acc_add(link_acc[(whr, code)], ok, absv, var)
    lk = link_meta[(whr, code)]
    lk["name"] = name; lk["total_kg"] += act
    if lb is not None:
        lk["batches"].add(lb)
    bm = batch_month.get(lb)
    if bm:
        acc_add(month_acc[bm], ok, absv, var)

weighers = []
for whr, a in whr_acc.items():
    s = acc_stats(a)
    weighers.append({"name": whr, **s, "avg_sgn_var": s["avg_bias"]})
weighers.sort(key=lambda x: -x["weighs"])

# weigher <-> ingredient links
weigher_ingredient_links = []
whr_totals = Counter()
mat_totals = Counter()
for (whr, code), a in pair_acc.items():
    s = acc_stats(a)
    weigher_ingredient_links.append({"weigher": whr, "mat_code": code, "mat_name": pair_nm.get((whr, code), ""), **s})
    whr_totals[whr] += s["weighs"]
    mat_totals[code] += s["weighs"]
for link in weigher_ingredient_links:
    link["share_of_weigher_pct"] = round(100 * link["weighs"] / max(whr_totals[link["weigher"]], 1), 1)
    link["share_of_material_pct"] = round(100 * link["weighs"] / max(mat_totals[link["mat_code"]], 1), 1)
weigher_ingredient_links.sort(key=lambda x: (-x["weighs"], x["weigher"], x["mat_code"]))

mat_weighers = defaultdict(list)
whr_ings = defaultdict(list)
for link in weigher_ingredient_links:
    mat_weighers[link["mat_code"]].append({"weigher": link["weigher"], "weighs": link["weighs"],
                                           "in_tol_pct": link["in_tol_pct"], "share_pct": link["share_of_material_pct"]})
    whr_ings[link["weigher"]].append({"code": link["mat_code"], "name": link["mat_name"], "weighs": link["weighs"],
                                      "in_tol_pct": link["in_tol_pct"], "share_pct": link["share_of_weigher_pct"]})
for code in mat_weighers:
    mat_weighers[code].sort(key=lambda x: -x["weighs"])
for whr in whr_ings:
    whr_ings[whr].sort(key=lambda x: -x["weighs"])
for w in weighers:
    w["ingredients"] = whr_ings.get(w["name"], [])
    w["ingredient_count"] = len(w["ingredients"])

weigher_ingredient = {
    "window_from": production["date_from"], "window_to": production["date_to"],
    "link_count": len(weigher_ingredient_links), "weigher_count": len(whr_totals),
    "material_count": len(mat_totals), "links": weigher_ingredient_links,
}

ingredients = []
for code, a in ing_acc.items():
    ingredients.append({"code": code, "name": ing_nm.get(code, ""), **acc_stats(a)})
ingredients.sort(key=lambda x: -x["weighs"])

formulations = []
for code, a in frm_acc.items():
    if code == "?":
        continue
    formulations.append({"code": code, "name": sku_desc.get(code, ""), **acc_stats(a)})
formulations.sort(key=lambda x: -x["weighs"])

weigher_groups = []
for label, a in group_acc.items():
    if a[0]:
        weigher_groups.append({"group": label, **acc_stats(a)})

batch_total = len(by_batch)
batch_perfect = sum(1 for ok in by_batch.values() if all(ok))
accuracy = {
    "window_from": production["date_from"], "window_to": production["date_to"],
    "weighments_total": bweighs_total, "weighments_in_window": len(bw_window),
    "batch_summary": {
        "batches": batch_total, "perfect": batch_perfect,
        "perfect_pct": round(100 * batch_perfect / max(batch_total, 1), 1),
        "any_miss": batch_total - batch_perfect,
        "any_miss_pct": round(100 * (batch_total - batch_perfect) / max(batch_total, 1), 1),
        "avg_misses_per_batch": round(mean([sum(1 for x in ok if not x) for ok in by_batch.values()]), 1) if by_batch else 0,
    },
    "weigher_groups": weigher_groups, "ingredients": ingredients, "formulations": formulations,
}

# ---- Commercial month-on-month rollup (production + accuracy + customer/SKU mix) ----
month_batch_total = defaultdict(int)
month_batch_perfect = defaultdict(int)
for lb, oks in by_batch.items():
    m = batch_month.get(lb)
    if not m:
        continue
    month_batch_total[m] += 1
    if all(oks):
        month_batch_perfect[m] += 1

commercial_monthly = []
for m in sorted(prod_m_b):
    ma = acc_stats(month_acc.get(m, acc_new()))
    bt = month_batch_total.get(m, 0)
    commercial_monthly.append({
        "month": m,
        "batches": prod_m_b[m],
        "tonnes": round(prod_m_t[m], 1),
        "days": len(prod_m_days[m]),
        "mean_t_day": round(prod_m_t[m] / max(len(prod_m_days[m]), 1), 1),
        "in_tol_pct": ma["in_tol_pct"] if ma else None,
        "batch_perfect_pct": round(100 * month_batch_perfect.get(m, 0) / bt, 1) if bt else None,
        "skus": len(prod_m_skus[m]),
        "unassigned_pct": round(100 * prod_m_noassign[m] / max(prod_m_b[m], 1), 1),
    })

# ---- macro/micro weighment analytics (replaces hand/auto) ----
mode_totals = {}
for mode in ("auto", "hand"):
    s = acc_stats(mode_acc[mode])
    if s:
        mode_totals[mode] = {**s,
                             "weighers": sorted(whr for whr in whr2_acc if (whr in hand_weighers) == (mode == "hand")),
                             "materials": len({c for (c, m) in ingmode_acc if m == mode})}

batches_with_hand = set()
for whr in whr2_meta:
    if whr in hand_weighers:
        batches_with_hand |= whr2_meta[whr]["batches"]

weighment_ingredients = []
for (code, mode), a in ingmode_acc.items():
    d = ingmode_meta[(code, mode)]
    weighment_ingredients.append({"mat_code": code, "mat_name": d["name"], "weigh_mode": mode,
                                  "primary_weigher": d["whrs"].most_common(1)[0][0] if d["whrs"] else "?",
                                  "batches": len(d["batches"]), "total_kg": round(d["total_kg"], 1), **acc_stats(a)})
weighment_ingredients.sort(key=lambda x: (-x["weighs"], x["mat_code"]))

weighment_weighers = []
for whr, a in whr2_acc.items():
    d = whr2_meta[whr]
    weighment_weighers.append({"weigher": whr, "weigh_mode": "hand" if whr in hand_weighers else "auto",
                               "is_hand_scale": whr in hand_weighers, "batches": len(d["batches"]),
                               "materials": len(d["materials"]),
                               "top_materials": [{"code": c, "weighs": n} for c, n in d["materials"].most_common(3)],
                               "total_kg": round(d["total_kg"], 1), **acc_stats(a)})
weighment_weighers.sort(key=lambda x: (-x["weighs"], x["weigher"]))

weighment_links = []
for (whr, code), a in link_acc.items():
    d = link_meta[(whr, code)]
    weighment_links.append({"weigher": whr, "mat_code": code, "mat_name": d["name"],
                            "weigh_mode": "hand" if whr in hand_weighers else "auto",
                            "batches": len(d["batches"]), "total_kg": round(d["total_kg"], 1), **acc_stats(a)})
weighment_links.sort(key=lambda x: (-x["weighs"], x["weigher"], x["mat_code"]))

weighments = {
    "window_from": production["date_from"], "window_to": production["date_to"],
    "hand_weighers": sorted(hand_weighers),
    "definition": "Micro = additive/micro-dose scales (typical target <10 kg). Macro/Medium = bulk auto weighers. epol has no hand/auto master flag, so scales are classified by typical target size from BWEIGHS.WHR_NO.",
    "summary": {
        "weighments_in_window": len(bw_window),
        "weighments_scored": scored_total,
        "auto": mode_totals.get("auto"), "hand": mode_totals.get("hand"),
        "batches_in_window": batch_total, "batches_with_hand_drops": len(batches_with_hand),
    },
    "ingredients": weighment_ingredients, "weighers": weighment_weighers, "links": weighment_links,
}

# ============================================================ #
# 4. PROCESS FLOW  (Ingredient -> Weigher -> Route -> Product)
# ============================================================ #
print("[4/9] Process flow...")
TOP_INGREDIENTS = 12
TOP_PRODUCTS = 12
MIN_ROUTE_T = 1.0

ing_mass = defaultdict(float)
ing_name = {}
for w in bw_window:
    code = (w.get("MAT_CODE") or "").strip()
    ing_mass[code] += F(w.get("ACTUAL"))
    ing_name[code] = (w.get("MAT_NAME") or "").strip()
top_ing = {c for c, _ in sorted(ing_mass.items(), key=lambda x: -x[1])[:TOP_INGREDIENTS]}

prod_mass = defaultdict(float)
for w in bw_window:
    prod_mass[batch_frm.get(w.get("LOG_BATCH"), "?")] += F(w.get("ACTUAL"))
top_prod = {c for c, _ in sorted(prod_mass.items(), key=lambda x: -x[1])[:TOP_PRODUCTS]}

route_mass = defaultdict(float)
for w in bw_window:
    route_mass[batch_route.get(w.get("LOG_BATCH"), "?")] += F(w.get("ACTUAL"))
keep_routes = {r for r, m in route_mass.items() if m / 1000 >= MIN_ROUTE_T}

prod_name_by_code = {}
for s in bstarts:
    code = (s.get("FRM_CODE") or "").strip()
    if code and code not in prod_name_by_code:
        prod_name_by_code[code] = sku_desc.get(code) or (s.get("FRM_NAME") or "").strip()


def ing_label(code):
    if code in top_ing:
        nm = ing_name.get(code, "")
        return f"{code} {nm}".strip() if nm else code
    return "Other ingredients"


def ing_raw_label(code):
    nm = ing_name.get(code, "")
    return f"{code} {nm}".strip() if nm else code


def prod_label(code):
    if code in top_prod:
        nm = prod_name_by_code.get(code, "")
        return f"{code} {nm}".strip() if nm else code
    return "Other products"


def route_label(r):
    return r if r in keep_routes else "Other routes"


flow_ing_whr_raw = defaultdict(float)
flow_ing_whr = defaultdict(float)
flow_whr_route = defaultdict(float)
flow_route_prod = defaultdict(float)
for w in bw_window:
    kg = F(w.get("ACTUAL"))
    if kg <= 0:
        continue
    lb = w.get("LOG_BATCH")
    code = (w.get("MAT_CODE") or "").strip()
    whr = whr_name(w.get("WHR_NO"))
    route = route_label(batch_route.get(lb, "?"))
    prod = batch_frm.get(lb, "?")
    flow_ing_whr_raw[(ing_raw_label(code), whr)] += kg
    flow_ing_whr[(ing_label(code), whr)] += kg
    flow_whr_route[(whr, route)] += kg
    flow_route_prod[(route, prod_label(prod))] += kg


def flow_pairs_to_list(flow):
    return [{"source": s, "target": t, "value": round(kg / 1000, 2)} for (s, t), kg in flow.items()]


stage_names = ["Ingredient", "Weigher", "Press route", "Product"]
node_index = {}
nodes = []


def add_node(name, stage):
    key = (stage, name)
    if key not in node_index:
        node_index[key] = len(nodes)
        nodes.append({"name": name, "stage": stage, "stage_label": stage_names[stage], "value": 0.0})
    return node_index[key]


def build_links(flow, s_stage, t_stage):
    out = []
    for (s_name, t_name), kg in flow.items():
        out.append({"source": add_node(s_name, s_stage), "target": add_node(t_name, t_stage), "value": round(kg / 1000, 2)})
    return out


links = build_links(flow_ing_whr, 0, 1) + build_links(flow_whr_route, 1, 2) + build_links(flow_route_prod, 2, 3)
in_sum = defaultdict(float)
out_sum = defaultdict(float)
for lk in links:
    out_sum[lk["source"]] += lk["value"]
    in_sum[lk["target"]] += lk["value"]
for i, n in enumerate(nodes):
    n["value"] = round(max(in_sum.get(i, 0), out_sum.get(i, 0)), 2)

process_flow = {
    "window_from": production["date_from"], "window_to": production["date_to"],
    "unit": "tonnes", "stages": stage_names,
    "total_t": round(sum(F(w.get("ACTUAL")) for w in bw_window) / 1000, 1),
    "weighments": len(bw_window), "ingredient_count": len(ing_mass),
    "default_top_ingredients": TOP_INGREDIENTS, "nodes": nodes, "links": links,
    "raw_flows": {
        "ing_whr": flow_pairs_to_list(flow_ing_whr_raw),
        "whr_route": flow_pairs_to_list(flow_whr_route),
        "route_prod": flow_pairs_to_list(flow_route_prod),
    },
    "notes": [
        "Flow = actual kg weighed (BWEIGHS.ACTUAL), converted to tonnes. Mass is conserved across all four stages.",
        f"Top {TOP_INGREDIENTS} ingredients and top {TOP_PRODUCTS} products by mass are shown individually by default; use the ingredient filter to change this.",
        "Stages: ingredient -> weigher/scale (BWEIGHS.WHR_NO, classified by dose size) -> press route (BSTARTS.ROUTE) -> finished product (BSTARTS.FRM_CODE).",
    ],
}

# SKUs and customers
sku_t = defaultdict(float)
sku_count = defaultdict(int)
for s in bstarts:
    code = (s.get("FRM_CODE") or "").strip()
    if code:
        sku_t[code] += batch_tonnes(s.get("LOG_BATCH"))
        sku_count[code] += 1
skus = sorted([{"code": c, "desc": sku_desc.get(c, ""), "tonnes": round(t, 1), "batches": sku_count[c]}
               for c, t in sku_t.items()], key=lambda x: -x["tonnes"])

cust_t = defaultdict(float)
for s in bstarts:
    cn = (s.get("CUST_NAME") or "").strip() or "(Unassigned)"
    cust_t[cn] += batch_tonnes(s.get("LOG_BATCH"))
customers = sorted([{"name": k, "tonnes": round(v, 1)} for k, v in cust_t.items()], key=lambda x: -x["tonnes"])

# Ingredient catalogue (derived from transactions; no INGS master)
control_by_code = {}
for w in bw_window:
    if w.get("CONTROL"):
        control_by_code[(w.get("MAT_CODE") or "").strip()] = True
acc_by_code = {i["code"]: i for i in ingredients}
ingredient_master = []
for code in ing_acc:
    acc = acc_by_code.get(code)
    ingredient_master.append({
        "ing_no": None, "code": code, "name": ing_nm.get(code, ""), "control": bool(control_by_code.get(code)),
        "is_flush": False, "uom": "kg", "stkttypno": 0, "desc": "",
        "formula_lines": 0, "in_batch_window": True,
        "weighs": acc["weighs"] if acc else 0,
        "in_tol_pct": acc["in_tol_pct"] if acc else None,
        "avg_abs_var": acc["avg_abs_var"] if acc else None,
        "weighers": mat_weighers.get(code, []),
        "primary_weigher": mat_weighers[code][0]["weigher"] if mat_weighers.get(code) else None,
    })
ingredient_master.sort(key=lambda x: -x["weighs"])
ingredient_catalog = {
    "total_slots": len(ingredient_master), "active": len(ingredient_master), "empty_slots": 0,
    "in_batch_window": len(ingredient_master),
    "in_formulas": sum(1 for i in ingredient_master if i["control"]),
    "items": ingredient_master,
}

# ============================================================ #
# 5. THROUGHPUT & CYCLE TIME  (replaces Energy)
# ============================================================ #
print("[5/9] Throughput & cycle time...")
batch_ing_count = Counter()
for w in bw_window:
    batch_ing_count[w.get("LOG_BATCH")] += 1


def batch_duration_min(s):
    st = parse_dt(s.get("START_TIME"))
    lb = s.get("LOG_BATCH")
    en = None
    e2 = bend2_by.get(lb)
    if e2:
        en = parse_dt(e2.get("FINISHTIME"))
    if en is None:
        e = bend_by.get(lb)
        if e:
            en = parse_dt(e.get("END_TIME"))
    if st and en and en > st:
        return st, (en - st).total_seconds() / 60
    return st, None


tp_batches = []
by_date = defaultdict(list)
by_hour = defaultdict(list)
by_route = defaultdict(list)
by_sku = defaultdict(list)
by_ingn = defaultdict(list)
tph_all = []
dur_all = []
for s in bstarts:
    lb = s.get("LOG_BATCH")
    st, dur = batch_duration_min(s)
    tonnes = batch_tonnes(lb)
    if dur is None or dur <= 0 or dur > 480 or tonnes <= 0:
        continue
    tph = tonnes / (dur / 60)
    frm = (s.get("FRM_CODE") or "").strip()
    route = (s.get("ROUTE") or "").strip()
    row = {
        "log_batch": str(lb), "date": st.strftime("%Y-%m-%d") if st else None,
        "hour": st.hour if st else None, "route": route, "frm_code": frm,
        "frm_name": sku_desc.get(frm, (s.get("FRM_NAME") or "").strip()),
        "tonnes": round(tonnes, 3), "duration_min": round(dur, 1),
        "t_per_h": round(tph, 3), "ingredients": batch_ing_count.get(lb, 0),
    }
    tp_batches.append(row)
    tph_all.append(tph)
    dur_all.append(dur)
    if row["date"]:
        by_date[row["date"]].append(row)
    if row["hour"] is not None:
        by_hour[row["hour"]].append(row)
    if route:
        by_route[route].append(row)
    if frm:
        by_sku[frm].append(row)
    by_ingn[row["ingredients"]].append(row)

tp_daily = [{
    "date": d, "batches": len(rs),
    "tonnes": round(sum(r["tonnes"] for r in rs), 1),
    "hours": round(sum(r["duration_min"] for r in rs) / 60, 1),
    "t_per_h": round(mean([r["t_per_h"] for r in rs]), 3),
    "duration_min_mean": round(mean([r["duration_min"] for r in rs]), 1),
} for d, rs in sorted(by_date.items())]

tp_hourly = [{
    "hour": h, "batches": len(rs),
    "t_per_h_mean": round(mean([r["t_per_h"] for r in rs]), 3),
    "duration_min_mean": round(mean([r["duration_min"] for r in rs]), 1),
} for h, rs in sorted(by_hour.items())]

by_month_tp = defaultdict(list)
for r in tp_batches:
    if r["date"]:
        by_month_tp[r["date"][:7]].append(r)
tp_monthly = [{
    "month": m, "batches": len(rs),
    "tonnes": round(sum(r["tonnes"] for r in rs), 1),
    "hours": round(sum(r["duration_min"] for r in rs) / 60, 1),
    "t_per_h": round(mean([r["t_per_h"] for r in rs]), 3),
    "duration_min_mean": round(mean([r["duration_min"] for r in rs]), 1),
} for m, rs in sorted(by_month_tp.items())]

tp_routes = [{
    "route": rt, "batches": len(rs),
    "tonnes": round(sum(r["tonnes"] for r in rs), 1),
    "hours": round(sum(r["duration_min"] for r in rs) / 60, 1),
    "t_per_h": round(mean([r["t_per_h"] for r in rs]), 3),
    "duration_min_mean": round(mean([r["duration_min"] for r in rs]), 1),
    "duration_min_stdev": stdev_safe([r["duration_min"] for r in rs]),
} for rt, rs in sorted(by_route.items(), key=lambda x: -len(x[1]))]

tp_skus = sorted([{
    "code": frm, "name": rs[0]["frm_name"] or sku_desc.get(frm, ""), "batches": len(rs),
    "tonnes": round(sum(r["tonnes"] for r in rs), 1),
    "hours": round(sum(r["duration_min"] for r in rs) / 60, 1),
    "t_per_h": round(mean([r["t_per_h"] for r in rs]), 3),
    "duration_min_mean": round(mean([r["duration_min"] for r in rs]), 1),
    "duration_min_stdev": stdev_safe([r["duration_min"] for r in rs]),
} for frm, rs in by_sku.items() if len(rs) >= 3], key=lambda x: -x["tonnes"])

tp_ingn = [{
    "ingredient_count": n, "batches": len(rs),
    "duration_min_mean": round(mean([r["duration_min"] for r in rs]), 1),
    "t_per_h_mean": round(mean([r["t_per_h"] for r in rs]), 3),
} for n, rs in sorted(by_ingn.items())]

# duration histogram
hist_bins = 12
distribution = []
if dur_all:
    lo, hi = min(dur_all), max(dur_all)
    width = (hi - lo) / hist_bins if hi > lo else 1
    for i in range(hist_bins):
        start = lo + i * width
        end = hi if i == hist_bins - 1 else lo + (i + 1) * width
        if i == hist_bins - 1:
            count = sum(1 for v in dur_all if start <= v <= hi)
        else:
            count = sum(1 for v in dur_all if start <= v < end)
        distribution.append({"bin_start": round(start, 1), "bin_end": round(end, 1), "count": count,
                             "label": f"{start:.0f}-{end:.0f}m"})

throughput = {
    "window_from": production["date_from"], "window_to": production["date_to"],
    "summary": {
        "batches_total": len(bstarts), "batches_timed": len(tp_batches),
        "pct_timed": round(100 * len(tp_batches) / max(len(bstarts), 1), 1),
        "total_tonnes": round(sum(r["tonnes"] for r in tp_batches), 1),
        "total_hours": round(sum(r["duration_min"] for r in tp_batches) / 60, 1),
        "t_per_h_mean": round(mean(tph_all), 3) if tph_all else 0,
        "t_per_h_stdev": stdev_safe(tph_all),
        "t_per_h_median": round(median(tph_all), 3) if tph_all else 0,
        "t_per_h_p10": percentile(tph_all, 10), "t_per_h_p90": percentile(tph_all, 90),
        "duration_min_mean": round(mean(dur_all), 1) if dur_all else 0,
        "duration_min_stdev": stdev_safe(dur_all),
        "batches_per_day_mean": round(len(tp_batches) / max(len(by_date), 1), 1),
    },
    "daily": tp_daily, "monthly": tp_monthly, "hourly": tp_hourly, "routes": tp_routes, "skus": tp_skus,
    "ingredient_count_buckets": tp_ingn, "distribution": distribution, "batches": tp_batches,
    "notes": [
        "Cycle time = BSTARTS.START_TIME -> BEND2S.FINISHTIME (fallback BENDS.END_TIME) per LOG_BATCH.",
        "Throughput rate t/h = batch tonnes / cycle hours. Batch tonnes from BEND2S.TOT_ACT (fallback summed BWEIGHS.ACTUAL).",
        f"{100 - round(100 * len(tp_batches) / max(len(bstarts), 1), 1):.0f}% of batches have no usable start/finish pair (open or out-of-range) and are excluded.",
        "epol has no kWh metering, so this replaces the Penmill energy view with a cycle-time / throughput view.",
    ],
}

# ============================================================ #
# 6. PDM (stock burn, weigher drift, manual events, alarms)
# ============================================================ #
print("[6/9] PDM (stock + manual + alarms)...")
# Stream MSTLOG (390k+ deduped rows) to aggregates only — no row retention.
mst_key = _keyfn("MSTLOG.DBF")
mst_seen = set()
mst_count = 0
outflow = defaultdict(float)
latest_stock = {}
name_map = {}
mdts_min = None
mdts_max = None
for path in _day_files("MSTLOG.DBF"):
    try:
        rows = DBF(path, encoding="latin-1", ignore_missing_memofile=True)
    except Exception:
        continue
    for r in rows:
        k = mst_key(r)
        if k in mst_seen:
            continue
        mst_seen.add(k)
        mst_count += 1
        d = parse_dt(r.get("DATE"))
        if not d:
            continue
        mdts_min = d if mdts_min is None or d < mdts_min else mdts_min
        mdts_max = d if mdts_max is None or d > mdts_max else mdts_max
        code = (r.get("MAT_CODE") or "").strip()
        if not code:
            continue
        name_map[code] = (r.get("MAT_NAME") or "").strip()
        if code not in latest_stock or d > latest_stock[code][0]:
            latest_stock[code] = (d, F(r.get("STOCK")))
        c = F(r.get("CHANGE"))
        if c < 0:
            outflow[code] += -c
mst_seen = None
span = max((mdts_max - mdts_min).days, 1) if mdts_min and mdts_max else 1

stock_forecast = []
for code, (d, stock) in latest_stock.items():
    burn = outflow.get(code, 0) / span
    if burn <= 0:
        continue
    days_left = stock / burn if stock > 0 else 0
    stock_forecast.append({
        "code": code, "name": name_map.get(code, ""),
        "stock_t": round(stock / 1000, 1), "burn_t_day": round(burn / 1000, 2),
        "days_left": round(days_left, 0),
        "status": "stockout" if stock <= 0 else "critical" if days_left < 7 else "warning" if days_left < 30 else "overstocked" if days_left > 150 else "ok",
        "value_gbp": 0,
    })
stock_forecast.sort(key=lambda x: x["days_left"])

manlog = merge("MANLOG.DBF")
manual_events = [{"name": n, "count": c} for n, c in
                 Counter((r.get("NAME") or "").strip() for r in manlog if (r.get("NAME") or "").strip()).most_common()]

# ---- ALMLOGS: streamed aggregate (2.5M+ rows) ----
print("       streaming alarms...")
import re as _re

ALM_NOISE = ("Update Windows Software", "Windows")
_HW_RE = _re.compile(r"^HW\d+$")


def alarm_name(raw):
    n = (raw or "").strip()
    if not n or any(x in n for x in ALM_NOISE) or _HW_RE.match(n):
        return None
    return n


def alarm_theme(name):
    u = name.upper()
    if any(k in u for k in ("LL ", "HL ", "LEVEL", "COVERED", "NOT OFF", "NOT ON", "HIGH LEVEL", "LOW LEVEL")):
        return "Level / bin management"
    if any(k in u for k in ("OVER WEIGHT", "UNDER WEIGHT", "TOLERANCE", "OUT OF TOL")):
        return "Process tolerance"
    if any(k in u for k in ("WEIGHER", "NO FEED", "ADDITIVE", "ADDS", "NOT PRESSED")):
        return "Weigher / feed"
    if any(k in u for k in ("V CLOSE FAIL", "V OPEN FAIL", "SLIDE", "VALVE", "GATE")):
        return "Valve / slide faults"
    if "MOTOR" in u or u.startswith(("MD", "BD")):
        return "Motor / drive"
    if any(k in u for k in ("PRESS", "PP2", "PP3", "PP4", "PELLET")):
        return "Press line"
    if "MIX" in u or u.startswith("MX"):
        return "Mixing"
    if u.startswith(("TH", "BH")):
        return "Bins / hoppers"
    if "FAIL" in u:
        return "Equipment faults"
    return "Other equipment"


alm_key = _keyfn("ALMLOGS.DBF")
alm_seen = set()
alm_total = 0
alm_op_total = 0
alm_themes = Counter()
alm_hourly = Counter()
alm_names = Counter()
alm_tol = Counter()
alm_by_batch = defaultdict(int)
alm_states = Counter()
alm_dts = []
# Active-duration edge pairing: STATE on = raised, off = cleared.
ALM_MAX_INTERVAL_SEC = 4 * 3600  # clamp runaway / missing-clear intervals
alm_open = {}                    # (alm_no, suffix) -> (raised_dt, name)
alm_dur_sec = defaultdict(float)  # alarm name -> total active seconds
alm_dur_cnt = defaultdict(int)    # alarm name -> completed intervals
alm_theme_dur = defaultdict(float)  # theme -> total active seconds
alm_dur_intervals = 0
alm_dur_capped = 0
alm_m_events = Counter()                              # operational events by month
alm_m_dur_sec = defaultdict(float)                   # active seconds by month (clear time)
alm_m_theme_dur = defaultdict(lambda: defaultdict(float))  # month -> theme -> active seconds
# Active intervals (raise_dt, clear_dt) kept so overlapping alarms can be merged
# into true wall-clock "alarm-active" time instead of an inflated sum.
alm_intervals = []                       # all (start, end) globally
alm_theme_intervals = defaultdict(list)  # theme -> [(start, end)]
alm_m_intervals = defaultdict(list)      # month (of raise) -> [(start, end)]
for path in _day_files("ALMLOGS.DBF"):
    try:
        rows = DBF(path, encoding="latin-1", ignore_missing_memofile=True)
    except Exception:
        continue
    for r in rows:
        k = hash(alm_key(r))
        if k in alm_seen:
            continue
        alm_seen.add(k)
        alm_total += 1
        nm = alarm_name(r.get("NAME"))
        if not nm:
            continue
        alm_op_total += 1
        alm_names[nm] += 1
        alm_themes[alarm_theme(nm)] += 1
        if "Tolerance" in nm or "Out Of Tol" in nm:
            alm_tol[nm] += 1
        t = parse_dt(r.get("BATCH_TIME")) or parse_dt(r.get("TIME"))
        if t:
            alm_hourly[t.hour] += 1
            alm_dts.append(t)
            alm_m_events[t.strftime("%Y-%m")] += 1
            pid = (r.get("ALM_NO"), (r.get("SUFFIX") or ""))
            if r.get("STATE"):
                # keep earliest raise so re-triggers don't shrink the active span
                alm_open.setdefault(pid, (t, nm))
            else:
                ot = alm_open.pop(pid, None)
                if ot and t > ot[0]:
                    secs = (t - ot[0]).total_seconds()
                    if secs > ALM_MAX_INTERVAL_SEC:
                        secs = ALM_MAX_INTERVAL_SEC
                        alm_dur_capped += 1
                    onm = ot[1]
                    oth = alarm_theme(onm)
                    start_dt = ot[0]
                    end_dt = start_dt + timedelta(seconds=secs)
                    alm_dur_sec[onm] += secs
                    alm_dur_cnt[onm] += 1
                    alm_theme_dur[oth] += secs
                    alm_dur_intervals += 1
                    cm = t.strftime("%Y-%m")
                    alm_m_dur_sec[cm] += secs
                    alm_m_theme_dur[cm][oth] += secs
                    # keep intervals for wall-clock (overlap-merged) totals
                    alm_intervals.append((start_dt, end_dt))
                    alm_theme_intervals[oth].append((start_dt, end_dt))
                    alm_m_intervals[start_dt.strftime("%Y-%m")].append((start_dt, end_dt))
        lb = r.get("LOG_BATCH")
        if lb:
            alm_by_batch[lb] += 1
alm_seen = None  # free memory

# ---- Alarm active-time rollups ----
def union_seconds(intervals):
    """Merge overlapping (start, end) intervals → total wall-clock seconds.
    Concurrent alarms overlap, so summing per-alarm durations overstates real
    time; the union is the true time during which at least one alarm was active."""
    if not intervals:
        return 0.0
    ivs = sorted(intervals)
    total = 0.0
    cur_s, cur_e = ivs[0]
    for s, e in ivs[1:]:
        if s <= cur_e:
            if e > cur_e:
                cur_e = e
        else:
            total += (cur_e - cur_s).total_seconds()
            cur_s, cur_e = s, e
    total += (cur_e - cur_s).total_seconds()
    return total

alm_dur_summed_sec = sum(alm_dur_sec.values())       # cumulative (overlaps double-count)
alm_dur_wall_sec = union_seconds(alm_intervals)      # true wall-clock active time
# Per-alarm intervals never overlap (one open span per alarm ID), so their summed
# time is already wall-clock-correct — keep it for the ranking table.
top_alarms_by_duration = sorted(
    ({"name": n,
      "events": alm_names.get(n, 0),
      "intervals": alm_dur_cnt[n],
      "total_min": round(s / 60, 1),
      "avg_min": round(s / 60 / alm_dur_cnt[n], 2) if alm_dur_cnt[n] else 0}
     for n, s in alm_dur_sec.items()),
    key=lambda x: -x["total_min"])[:20]
# Theme totals aggregate many alarms that can overlap → use the merged union.
theme_duration = sorted(
    ({"theme": th,
      "total_min": round(union_seconds(ivs) / 60, 1),
      "hours": round(union_seconds(ivs) / 3600, 1)}
     for th, ivs in alm_theme_intervals.items()),
    key=lambda x: -x["total_min"])
windows_noise = alm_total - alm_op_total

pdm_data = {
    "stock_forecast": stock_forecast,
    "weighers": weighers,
    "manual_events": manual_events,
    "alarms": [{"name": n, "count": c} for n, c in alm_names.most_common()],
    "totals": {
        "manual_events": len(manlog),
        "alarm_events": alm_op_total,
        "materials_tracked": len(latest_stock),
        "stockouts": sum(1 for s in stock_forecast if s["status"] == "stockout"),
        "critical": sum(1 for s in stock_forecast if s["status"] == "critical"),
        "overstocked": sum(1 for s in stock_forecast if s["status"] == "overstocked"),
        "inventory_value": 0,
    },
}

# ============================================================ #
# 7. ALARMS & CONFORMANCE  (+ CCLOGS carryover)
# ============================================================ #
print("[7/9] Alarms & conformance + carryover...")
batch_conform = {lb: all(oks) for lb, oks in by_batch.items() if oks}
conform_batches = {lb for lb, ok in batch_conform.items() if ok}
nonconform_batches = {lb for lb, ok in batch_conform.items() if not ok}


def batch_alarm_stats(batch_set):
    counts = [alm_by_batch.get(lb, 0) for lb in batch_set]
    if not batch_set:
        return {"batches": 0, "with_alarms": 0, "pct_with_alarms": 0, "avg_alarms": 0, "total_events": 0}
    return {"batches": len(batch_set), "with_alarms": sum(1 for c in counts if c > 0),
            "pct_with_alarms": round(100 * sum(1 for c in counts if c > 0) / len(batch_set), 1),
            "avg_alarms": round(mean(counts), 2), "total_events": sum(counts)}

# Carryover / cross-contamination from CCLOGS (streamed)
cc_key = _keyfn("CCLOGS.DBF")
cc_seen = set()
cc_total = 0
cc_changeovers_n = 0
cc_tested = 0
cc_changeover_tested = 0
cc_by_vessel = Counter()
cc_vessels = set()
cc_m_changeovers = defaultdict(int)
cc_m_tested = defaultdict(int)
for path in _day_files("CCLOGS.DBF"):
    try:
        rows = DBF(path, encoding="latin-1", ignore_missing_memofile=True)
    except Exception:
        continue
    for r in rows:
        k = cc_key(r)
        if k in cc_seen:
            continue
        cc_seen.add(k)
        cc_total += 1
        vessel = (r.get("VESSEL") or "").strip()
        cc_vessels.add(vessel)
        if r.get("CC_TEST"):
            cc_tested += 1
        if (r.get("PREV_FRM") or "") != (r.get("NEXT_FRM") or ""):
            cc_changeovers_n += 1
            cc_by_vessel[vessel] += 1
            cd = parse_dt(r.get("DATE"))
            if cd:
                cm = cd.strftime("%Y-%m")
                cc_m_changeovers[cm] += 1
                if r.get("CC_TEST"):
                    cc_m_tested[cm] += 1
            if r.get("CC_TEST"):
                cc_changeover_tested += 1
cc_seen = None
carryover = {
    "events_total": cc_total,
    "changeovers": cc_changeovers_n,
    "carryover_tests": cc_tested,
    "changeover_test_pct": round(100 * cc_changeover_tested / max(cc_changeovers_n, 1), 1),
    "vessels": len(cc_vessels),
    "by_vessel": [{"name": v, "count": c} for v, c in cc_by_vessel.most_common(15)],
}

weighment_totals = {
    "conform": sum(1 for r in (weigh_row(w) for w in bw_window) if r and r["ok"]),
    "nonconform": sum(1 for r in (weigh_row(w) for w in bw_window) if r and not r["ok"]),
}

_nc_w = Counter()
for w in bw_window:
    r = weigh_row(w)
    if r and not r["ok"]:
        _nc_w[whr_name(w.get("WHR_NO"))] += 1
nc_by_weigher = [{"name": w, "count": c} for w, c in _nc_w.most_common()]

# alarm enrichment on non-conform vs conform (using LOG_BATCH link, full window)
nc_with = [alm_by_batch.get(lb, 0) for lb in nonconform_batches]
c_with = [alm_by_batch.get(lb, 0) for lb in conform_batches]

man_by_batch_count = defaultdict(int)  # MANLOG has no LOG_BATCH; use date overlap-free count by name only
nc_man = Counter()
c_man = Counter()

alarm_log_hours = round((max(alm_dts) - min(alm_dts)).total_seconds() / 3600, 1) if len(alm_dts) > 1 else 0

# ---- Alarms month-on-month rollup (events, time lost, top theme, carryover) ----
alarms_monthly = []
for m in sorted(set(alm_m_events) | set(alm_m_dur_sec) | set(cc_m_changeovers)):
    themes_m = alm_m_theme_dur.get(m, {})
    top_theme = max(themes_m.items(), key=lambda x: x[1])[0] if themes_m else None
    co = cc_m_changeovers.get(m, 0)
    alarms_monthly.append({
        "month": m,
        "events": alm_m_events.get(m, 0),
        "time_lost_h": round(union_seconds(alm_m_intervals.get(m, [])) / 3600, 1),
        "top_theme": top_theme,
        "changeovers": co,
        "changeover_test_pct": round(100 * cc_m_tested.get(m, 0) / co, 1) if co else None,
    })

alarms_insights = {
    "coverage": {
        "alarm_log_from": min(alm_dts).strftime("%Y-%m-%d %H:%M") if alm_dts else None,
        "alarm_log_to": max(alm_dts).strftime("%Y-%m-%d %H:%M") if alm_dts else None,
        "alarm_log_hours": alarm_log_hours,
        "manual_log_from": production["date_from"], "manual_log_to": production["date_to"],
        "batch_window_from": production["date_from"], "batch_window_to": production["date_to"],
        "batch_window_count": production["batches"],
        "sep22_correlation_batches": len(conform_batches) + len(nonconform_batches),
        "log_batch_linked": False,
        "note": "Only hardware-heartbeat rows (HW1/HW2) carry a LOG_BATCH; real operational alarms have LOG_BATCH=0, so alarm-to-batch correlation is not available from a direct key. Alarm and batch windows both span Jan-Jun 2026.",
    },
    "totals": {
        "alarm_events_raw": alm_total, "alarm_events_operational": alm_op_total,
        "windows_noise_events": windows_noise,
        "alarm_matched_to_batches": sum(alm_by_batch.values()),
        "alarm_unmatched": alm_op_total - sum(alm_by_batch.values()),
        "unique_alarm_types": len(alm_names), "manual_events": len(manlog),
    },
    "batch_conformance": {
        "batches_conform": len(conform_batches), "batches_nonconform": len(nonconform_batches),
        "batches_conform_pct": accuracy["batch_summary"]["perfect_pct"],
        "weighments_conform": weighment_totals["conform"],
        "weighments_nonconform": weighment_totals["nonconform"],
        "weighments_conform_pct": round(100 * weighment_totals["conform"] / max(weighment_totals["conform"] + weighment_totals["nonconform"], 1), 1),
    },
    "themes": [{"theme": t, "count": c} for t, c in alm_themes.most_common()],
    "hourly": [{"hour": h, "count": alm_hourly[h]} for h in sorted(alm_hourly)],
    "top_alarms": [{"name": n, "count": c} for n, c in alm_names.most_common(20)],
    "tolerance_alarms": [{"name": n, "count": c} for n, c in alm_tol.most_common()],
    "duration": {
        "total_min": round(alm_dur_wall_sec / 60, 1),
        "total_hours": round(alm_dur_wall_sec / 3600, 1),
        "summed_hours": round(alm_dur_summed_sec / 3600, 1),
        "window_hours": alarm_log_hours,
        "active_pct": round(100 * alm_dur_wall_sec / 3600 / alarm_log_hours, 1) if alarm_log_hours else None,
        "intervals": alm_dur_intervals,
        "intervals_capped": alm_dur_capped,
        "cap_min": ALM_MAX_INTERVAL_SEC // 60,
        "unclosed": len(alm_open),
        "by_theme": theme_duration,
        "top_alarms": top_alarms_by_duration,
        "note": "Wall-clock active time = the union of all raise→clear intervals (overlapping/concurrent alarms merged, not summed), so it never exceeds elapsed time. Theme totals are likewise overlap-merged. Per-alarm rows below never overlap, so their times are exact. Intervals over the cap are clamped; alarms still active at period end are excluded.",
    },
    "monthly": alarms_monthly,
    "carryover": carryover,
    "sep22_correlation": {
        "date": None,
        "conform": batch_alarm_stats(conform_batches),
        "nonconform": batch_alarm_stats(nonconform_batches),
        "all": batch_alarm_stats(conform_batches | nonconform_batches),
        "top_on_nonconform": [],
        "enriched_on_nonconform": [],
        "nonconform_weighments_by_weigher": nc_by_weigher,
    },
    "manual_comparison": {
        "conform_avg_per_batch": 0, "nonconform_avg_per_batch": 0,
        "top_on_nonconform": [], "top_on_conform": [],
    },
    "takeaways": [
        {"tone": "red", "title": "Time lost is the priority signal",
         "body": (f"At least one alarm was active for ~{round(alm_dur_wall_sec / 3600):,}h of the {alarm_log_hours:,.0f}h logged "
                  f"({round(100 * alm_dur_wall_sec / 3600 / alarm_log_hours) if alarm_log_hours else 0}% of the period), across {alm_dur_intervals:,} raise→clear cycles. "
                  + (f"'{theme_duration[0]['theme']}' holds time the most ({theme_duration[0]['hours']:,}h)"
                     + (f", then '{theme_duration[1]['theme']}' ({theme_duration[1]['hours']:,}h)." if len(theme_duration) > 1 else ".")
                     if theme_duration else "No raise/clear pairs were found in the log."))},
        {"tone": "amber", "title": "Frequency is not priority",
         "body": (f"The most frequent alarm is '{alm_names.most_common(1)[0][0]}' ({alm_names.most_common(1)[0][1]:,} events), "
                  + (f"but the biggest time sink is '{top_alarms_by_duration[0]['name']}' at ~{round(top_alarms_by_duration[0]['total_min'] / 60):,}h active "
                     f"(avg {top_alarms_by_duration[0]['avg_min']:.0f} min per clear). Rank remediation by time waited, not by count."
                     if top_alarms_by_duration else "no paired durations available."))},
        {"tone": "green", "title": "Carryover testing on every changeover",
         "body": f"{carryover['changeovers']:,} formula changeovers recorded across {carryover['vessels']} vessels, {carryover['changeover_test_pct']}% with a carryover test (CCLOGS) — strong cross-contamination evidence."},
    ],
}

# ============================================================ #
# 8. INVENTORY (epol table catalog)
# ============================================================ #
print("[8/9] Inventory catalog...")
KNOWN_DESC = {
    "BSTARTS.DBF": ("Batch start headers — one row per batch initiated (formula, route, customer, batch size, start time).",
                    "Written by PLC sequencing when a batch is released from schedule.",
                    "Production timeline, customer attribution, join key to BWEIGHS / BEND2S via LOG_BATCH."),
    "BENDS.DBF": ("Batch completion markers — start/end time per finished batch.",
                  "Event row from the control system at batch completion.",
                  "Batch cycle time (paired with BSTARTS / BEND2S)."),
    "BEND2S.DBF": ("Batch completion totals — target vs actual total weight and finish time per batch.",
                   "Integrating load-cell totals captured at batch end.",
                   "Batch weight accuracy and the authoritative batch tonnage."),
    "BWEIGHS.DBF": ("Individual ingredient weighments per batch (target, actual, tolerance, lot, weigher).",
                    "Strain-gauge load cells under each scale hopper (bulk and additive).",
                    "Batching accuracy, traceability (LOT_NO), process-flow mass, certificates."),
    "BSTLOG.DBF": ("Bin stock log — per-bin stock balance changes (bin, material, stock, change).",
                   "Reconciles bin inflow/outflow.",
                   "Bin-level inventory and FIFO views."),
    "MSTLOG.DBF": ("Material stock log — chronological balance changes for every raw material.",
                   "Receipts, usage and adjustments against batching consumption.",
                   "Days-on-hand, burn-rate forecasts, working-capital."),
    "CCLOGS.DBF": ("Carryover / changeover log — formula transition per vessel with carryover-test flag.",
                   "Written at each formula changeover on a vessel (mixer, route, bin, press).",
                   "Cross-contamination defense and changeover discipline evidence."),
    "ALMLOGS.DBF": ("Alarm event log — every alarm that fired, with batch link and state.",
                    "Digital inputs (level, valve, motor) plus PLC software conditions.",
                    "Hot-spot analysis, batch conformance correlation, equipment health."),
    "MANLOG.DBF": ("Manual interventions — operator overrides of valves/motors via the HMI.",
                   "Operator presses on the HMI, logged by SCADA.",
                   "Process-instability hot-spots and maintenance signals."),
    "RTCLOGS.DBF": ("Route/recipe step log — sequence and step transitions per route.",
                    "Control-system sequencing events.",
                    "Recipe step timing and route behaviour."),
    "SCTLOGS.DBF": ("System counter log — DB/disk/TTY I/O and sequence-step counters per hour.",
                    "Software telemetry from the control server.",
                    "System health and activity level (not equipment cycle time)."),
    "PLNLOG.DBF": ("Plan / interlock log — schedule item state and interlock transitions.",
                   "Planner and interlock events.",
                   "Scheduling and interlock diagnostics."),
    "ONLNLOGS.DBF": ("Online system event log — free-text control-system events.",
                     "Control-system online/offline and status strings.",
                     "System audit and diagnostics."),
    "LBLPRINT.DBF": ("Label print log — fields and data sent to label printers.",
                     "Label request events at dispatch/packing.",
                     "Packaging and dispatch label traceability."),
    "INTLOGS.DBF": ("Intake log — raw-material receipts (material, amount, bin, vehicle, lot, docket).",
                    "Weighbridge/intake confirmations.",
                    "Stock receipts and supplier reconciliation."),
    "FRMLOG.DBF": ("Formula combination log — base + additive formula combined into a run formula.",
                   "Written when a combined formula is created.",
                   "Recipe lineage for combined formulas."),
}
inv_tables = sorted({p.name for p in STORE.glob("2026/*/*/*.DBF")})
loaded_counts = {
    "BSTARTS.DBF": len(bstarts), "BEND2S.DBF": len(bend2s), "BENDS.DBF": len(bends),
    "BWEIGHS.DBF": bweighs_total, "MSTLOG.DBF": mst_count, "CCLOGS.DBF": cc_total,
    "MANLOG.DBF": len(manlog), "ALMLOGS.DBF": alm_total,
}
inventory = []
for name in inv_tables:
    sample = sorted(STORE.glob(f"2026/*/*/{name}"))[-1]
    try:
        dbf = DBF(sample, encoding="latin-1", ignore_missing_memofile=True, load=False)
        fields = [{"n": fl.name, "t": fl.type, "l": fl.length} for fl in dbf.fields]
    except Exception:
        fields = []
    rec = loaded_counts.get(name)
    if rec is None:
        # fast: header row-count of the latest snapshot (avoids re-reading all days)
        try:
            rec = len(DBF(sample, encoding="latin-1", ignore_missing_memofile=True, load=False))
        except Exception:
            rec = 0
    desc = KNOWN_DESC.get(name, ("Operational table.", "Control-system events.", "Supporting data."))
    cat = ("Batch production" if name.startswith(("BST", "BEN", "BWE")) else
           "Inventory" if name in ("MSTLOG.DBF", "BSTLOG.DBF", "INTLOGS.DBF") else
           "Alarm" if name == "ALMLOGS.DBF" else
           "Operator action" if name == "MANLOG.DBF" else
           "Quality / Sieve" if name == "CCLOGS.DBF" else
           "Plan / Sequence" if name in ("PLNLOG.DBF", "RTCLOGS.DBF") else
           "Formula / Recipe" if name == "FRMLOG.DBF" else
           "Counter / Statistics" if name == "SCTLOGS.DBF" else
           "Transport / Outload" if name == "LBLPRINT.DBF" else "Setup / Reference")
    inventory.append({"n": name, "c": cat, "p": "Time-series log", "rec": rec, "kb": round(sample.stat().st_size / 1024, 1),
                      "w": desc[0], "s": desc[1], "y": desc[2], "f": fields[:24], "nf": len(fields), "r": []})

inv_out = {
    "tables": inventory,
    "cats": dict(Counter(t["c"] for t in inventory)),
    "purps": dict(Counter(t["p"] for t in inventory)),
    "total": len(inventory),
    "total_records": sum(t["rec"] for t in inventory),
}
(OUT / "inventory.json").write_text(json.dumps(inv_out, separators=(",", ":"), default=str))

# Timeline
timeline = [
    {"table": "BSTARTS.DBF", "label": "Batch headers", "records": len(bstarts),
     "from": production["date_from"], "to": production["date_to"],
     "span_days": (max(start_dts) - min(start_dts)).days if start_dts else 0,
     "note": "One row per batch; daily delta partitions merged."},
    {"table": "BWEIGHS.DBF", "label": "Ingredient weighments", "records": bweighs_total,
     "from": production["date_from"], "to": production["date_to"],
     "span_days": (max(start_dts) - min(start_dts)).days if start_dts else 0,
     "note": "Ring buffer (wraps at 20000); de-duplicated across snapshots."},
    {"table": "MSTLOG.DBF", "label": "Material stock log", "records": mst_count,
     "from": mdts_min.strftime("%Y-%m-%d") if mdts_min else None,
     "to": mdts_max.strftime("%Y-%m-%d") if mdts_max else None,
     "span_days": (mdts_max - mdts_min).days if mdts_min and mdts_max else 0, "note": "Drives burn-rate forecasts."},
    {"table": "CCLOGS.DBF", "label": "Carryover / changeover", "records": cc_total,
     "from": production["date_from"], "to": production["date_to"],
     "span_days": (max(start_dts) - min(start_dts)).days if start_dts else 0,
     "note": "Formula changeovers with carryover-test flag."},
    {"table": "ALMLOGS.DBF", "label": "Alarm log", "records": alm_total,
     "from": alarms_insights["coverage"]["alarm_log_from"], "to": alarms_insights["coverage"]["alarm_log_to"],
     "span_days": int(alarm_log_hours // 24), "note": "Batch-linked alarm events."},
]

# ============================================================ #
# 9. GAP ANALYSIS / KNOWLEDGE GRAPH / COMMERCIAL / CERTS
# ============================================================ #
print("[9/9] Gap analysis, knowledge graph, commercial, certificates...")

# data-driven figures for KPI scoring
lot_cov = round(100 * sum(1 for w in bw_window if F(w.get("LOT_NO")) > 0) / max(len(bw_window), 1), 1)
control_weighs = sum(1 for w in bw_window if w.get("CONTROL"))
macro = next((g for g in weigher_groups if g["group"] == "Macro (bulk)"), None)
micro = next((g for g in weigher_groups if g["group"] == "Micro (additive)"), None)
cv_day = round(100 * production["std_t_day"] / production["mean_t_day"], 0) if production["mean_t_day"] else 0

KPI_MATRIX = [
    ("1. Feed Mill Design & Layout", "Process elements", "Naming of routes / vessels", 4, "GREEN",
     f"{len(set(batch_route.values()))} production routes and {carryover['vessels']} vessels are named and tracked across CCLOGS / BSTARTS.",
     None, "BSTARTS, CCLOGS"),
    ("1. Feed Mill Design & Layout", "Outloading attribution", "% batches with customer assigned",
     2 if production["unassigned_pct"] > 15 else 4, "RED" if production["unassigned_pct"] > 15 else "GREEN",
     f"{production['unassigned_pct']}% of {production['batches']:,} batches have no CUST_NAME.",
     40000, "BSTARTS"),
    ("2. Raw Material Intake & Supplier Control", "Traceability & Labeling", "LOT_NO coverage on weighments",
     4 if lot_cov >= 80 else 2 if lot_cov >= 30 else 1, "GREEN" if lot_cov >= 80 else "AMBER" if lot_cov >= 30 else "RED",
     f"{lot_cov}% of {len(bw_window):,} in-window weighments carry a LOT_NO.",
     50000 if lot_cov < 30 else None, "BWEIGHS.LOT_NO"),
    ("2. Raw Material Intake & Supplier Control", "Medicated Additive Handling", "Control/medicated weighment tracking",
     4 if control_weighs > 0 else 2, "GREEN" if control_weighs > 0 else "AMBER",
     f"{control_weighs:,} weighments flagged CONTROL (medicated/regulated additive) with target/actual logged.",
     None, "BWEIGHS.CONTROL"),
    ("3. Storage & Inventory Management", "FIFO compliance", "% materials >150 days on hand",
     2 if pdm_data["totals"]["overstocked"] >= 5 else 4, "RED" if pdm_data["totals"]["overstocked"] >= 5 else "GREEN",
     f"{pdm_data['totals']['overstocked']} of {pdm_data['totals']['materials_tracked']} tracked materials are >150 days on hand.",
     9000, "MSTLOG"),
    ("3. Storage & Inventory Management", "Feed Safety - Cross-Contamination", "Carryover-test discipline",
     5 if carryover["changeover_test_pct"] >= 95 else 3, "GREEN" if carryover["changeover_test_pct"] >= 95 else "AMBER",
     f"{carryover['changeover_test_pct']}% of {carryover['changeovers']:,} formula changeovers carry a carryover test (CCLOGS).",
     None, "CCLOGS"),
    ("3. Storage & Inventory Management", "Micro-Ingredient Management", "Additive weigher accuracy",
     1 if micro and micro["in_tol_pct"] < 60 else 3, "RED" if micro and micro["in_tol_pct"] < 60 else "AMBER",
     f"Micro/additive weighers ~{micro['in_tol_pct'] if micro else 0}% in tolerance, {micro['avg_abs_var'] if micro else 0}% avg abs variance.",
     25000, "BWEIGHS (micro scales)"),
    ("4. Milling / Grinding Efficiency", "Throughput stability", "Daily throughput CV",
     2 if cv_day > 30 else 4, "RED" if cv_day > 30 else "GREEN",
     f"Daily throughput {production['mean_t_day']:.0f} +/- {production['std_t_day']:.0f} t (CV ~{cv_day:.0f}%).",
     None, "BSTARTS, BEND2S"),
    ("4. Milling / Grinding Efficiency", "Cycle time", "Batch cycle-time spread",
     3, "AMBER",
     f"Mean batch cycle {throughput['summary']['duration_min_mean']:.0f} min (+/-{throughput['summary']['duration_min_stdev']:.0f}); mean rate {throughput['summary']['t_per_h_mean']:.1f} t/h.",
     None, "BSTARTS->BEND2S"),
    ("5. Batching & Feed Mixing", "Scale calibration", "Macro vs micro tolerance",
     2, "AMBER",
     f"Macro weighers ~{macro['in_tol_pct'] if macro else 0}% in tol; micro ~{micro['in_tol_pct'] if micro else 0}% in tol.",
     25000, "BWEIGHS"),
    ("5. Batching & Feed Mixing", "Batching accuracy", "Batch-perfect rate",
     2 if accuracy["batch_summary"]["perfect_pct"] < 80 else 4, "RED" if accuracy["batch_summary"]["perfect_pct"] < 80 else "GREEN",
     f"{accuracy['batch_summary']['perfect_pct']}% of batches have every weighment in tolerance.",
     25000, "BWEIGHS"),
    ("8. Finished Product & Dispatch", "Load accuracy", "Batch weight completeness",
     4, "GREEN",
     f"BEND2S total target/actual present on {len(bend2s):,} of {len(bstarts):,} batches.",
     None, "BEND2S"),
    ("9. Quality, Food & Feed Safety", "Recall readiness", "Mock-recall feasibility",
     4 if lot_cov >= 80 else 2 if lot_cov >= 30 else 1, "GREEN" if lot_cov >= 80 else "AMBER" if lot_cov >= 30 else "RED",
     f"Mock recall feasibility tracks LOT_NO coverage ({lot_cov}%) plus carryover logs.",
     50000 if lot_cov < 30 else None, "BWEIGHS.LOT_NO, CCLOGS"),
    ("9. Quality, Food & Feed Safety", "Cross-contamination", "Changeover evidence",
     5 if carryover["changeover_test_pct"] >= 95 else 3, "GREEN" if carryover["changeover_test_pct"] >= 95 else "AMBER",
     f"{carryover['changeovers']:,} logged changeovers across {carryover['vessels']} vessels with carryover tests.",
     None, "CCLOGS"),
    ("10. Maintenance & Reliability", "MTBF / MTTR", "Manual intervention rate",
     2, "RED",
     f"{len(manlog):,} manual interventions logged; top: {manual_events[0]['name'] if manual_events else 'n/a'} ({manual_events[0]['count'] if manual_events else 0}x).",
     30000, "MANLOG"),
    ("10. Maintenance & Reliability", "Alarm load", "Operational alarm volume",
     2, "RED",
     f"{alm_op_total:,} operational alarm events; top theme '{alm_themes.most_common(1)[0][0] if alm_themes else 'n/a'}'.",
     15000, "ALMLOGS"),
    ("13. Systems, Data & Continuous Improvement", "ERP / MES integration", "Customer back-link",
     2 if production["unassigned_pct"] > 15 else 4, "RED" if production["unassigned_pct"] > 15 else "GREEN",
     f"{production['unassigned_pct']}% of batches missing CUST_NAME — MES<->ERP attribution gap.",
     40000, "BSTARTS"),
    ("13. Systems, Data & Continuous Improvement", "KPI visibility", "Live dashboard availability",
     2, "RED",
     "No live operational dashboard on site — this app closes the gap.",
     15000, "all"),
]
gap_kpis = [{"section": s, "control": c, "kpi": k, "score": sc, "rag": rag,
             "evidence": ev, "gap_gbp": g, "source": src}
            for (s, c, k, sc, rag, ev, g, src) in KPI_MATRIX]
sec_groups = defaultdict(list)
for k in gap_kpis:
    sec_groups[k["section"]].append(k)
section_summary = []
for sec, ks in sec_groups.items():
    scs = [k["score"] for k in ks if isinstance(k["score"], int)]
    section_summary.append({"section": sec, "avg": round(mean(scs), 2) if scs else None,
                            "green": sum(1 for k in ks if k["rag"] == "GREEN"),
                            "amber": sum(1 for k in ks if k["rag"] == "AMBER"),
                            "red": sum(1 for k in ks if k["rag"] == "RED"),
                            "total": len(ks), "gap_gbp": sum(k["gap_gbp"] or 0 for k in ks)})
section_summary.sort(key=lambda x: x["avg"] if x["avg"] is not None else 99)

# ---- Month-on-month gap scorecard: re-score threshold KPIs per month ----
# Only the controls whose metric we already bucket monthly, scored with the same
# thresholds used in KPI_MATRIX so the RAG is directly comparable.
GAP_MONTHLY_KPIS = ["Customer attribution", "Batching accuracy", "Weighment accuracy",
                    "Carryover discipline", "Throughput stability"]
month_day_tonnes = defaultdict(list)
for _d, _t in daily.items():
    month_day_tonnes[_d.strftime("%Y-%m")].append(_t)
_comm_by_month = {m["month"]: m for m in commercial_monthly}
_alm_by_month = {m["month"]: m for m in alarms_monthly}
gap_monthly = []
for m in sorted(_comm_by_month):
    cm = _comm_by_month[m]
    am = _alm_by_month.get(m, {})
    bp = cm["batch_perfect_pct"] or 0
    it = cm["in_tol_pct"] or 0
    ct = am.get("changeover_test_pct")
    dts = month_day_tonnes.get(m, [])
    cvm = (stdev(dts) / mean(dts) * 100) if len(dts) > 1 and mean(dts) else 0
    scores = {
        "Customer attribution": 4 if cm["unassigned_pct"] <= 15 else 2,
        "Batching accuracy": 4 if bp >= 80 else 2 if bp >= 20 else 1,
        "Weighment accuracy": 5 if it >= 90 else 3 if it >= 60 else 1,
        "Carryover discipline": 5 if (ct is not None and ct >= 95) else 3 if (ct is not None and ct >= 50) else 1,
        "Throughput stability": 4 if cvm <= 30 else 2,
    }
    avg = round(mean(scores.values()), 2)
    gap_monthly.append({
        "month": m, "scores": scores, "avg": avg,
        "rag": "GREEN" if avg >= 4 else "AMBER" if avg >= 3 else "RED",
        "metrics": {
            "unassigned_pct": cm["unassigned_pct"], "batch_perfect_pct": round(bp, 1),
            "in_tol_pct": round(it, 1), "changeover_test_pct": ct, "tonne_cv": round(cvm, 0),
        },
    })

gap_out = {
    "kpis": gap_kpis, "sections": section_summary,
    "monthly": gap_monthly, "monthly_kpis": GAP_MONTHLY_KPIS,
    "summary": {"total": len(gap_kpis),
                "green": sum(1 for k in gap_kpis if k["rag"] == "GREEN"),
                "amber": sum(1 for k in gap_kpis if k["rag"] == "AMBER"),
                "red": sum(1 for k in gap_kpis if k["rag"] == "RED"),
                "total_gap_gbp": sum(k["gap_gbp"] or 0 for k in gap_kpis),
                "matrix_total": 77, "scored_from_data": len(gap_kpis)},
}
(OUT / "gap-analysis.json").write_text(json.dumps(gap_out, default=str))

kg = {
    "tables": [
        {"id": "BSTARTS", "label": "BSTARTS", "sub": "batch headers", "cat": "production"},
        {"id": "BEND2S", "label": "BEND2S", "sub": "batch totals", "cat": "production"},
        {"id": "BWEIGHS", "label": "BWEIGHS", "sub": "ingredient weighments", "cat": "production"},
        {"id": "CCLOGS", "label": "CCLOGS", "sub": "carryover / changeover", "cat": "compliance"},
        {"id": "MSTLOG", "label": "MSTLOG", "sub": "material stock log", "cat": "inventory"},
        {"id": "BSTLOG", "label": "BSTLOG", "sub": "bin stock log", "cat": "inventory"},
        {"id": "INTLOGS", "label": "INTLOGS", "sub": "raw intake", "cat": "inventory"},
        {"id": "MANLOG", "label": "MANLOG", "sub": "manual interventions", "cat": "equipment"},
        {"id": "ALMLOGS", "label": "ALMLOGS", "sub": "alarms (batch-linked)", "cat": "equipment"},
        {"id": "RTCLOGS", "label": "RTCLOGS / PLNLOG", "sub": "route & plan steps", "cat": "equipment"},
        {"id": "FRMLOG", "label": "FRMLOG", "sub": "formula combos", "cat": "master"},
        {"id": "LBLPRINT", "label": "LBLPRINT", "sub": "dispatch labels", "cat": "master"},
    ],
    "concepts": [
        {"id": "BATCH", "label": "Batch production"},
        {"id": "RECIPE", "label": "Recipe control"},
        {"id": "MATERIAL", "label": "Material & stock"},
        {"id": "THROUGHPUT", "label": "Throughput & cycle time"},
        {"id": "EQHEALTH", "label": "Equipment health"},
        {"id": "TRACE", "label": "Traceability"},
        {"id": "XCONTAM", "label": "Cross-contamination"},
        {"id": "CUST", "label": "Customer attribution"},
    ],
    "products": [
        {"id": "P_CERT", "label": "Per-batch certificate", "value": 40000, "note": "Batch totals + weighments + carryover"},
        {"id": "P_GAP", "label": "Evidence-based Gap Analysis", "value": 360000, "note": "Auto-scored KPIs from data"},
        {"id": "P_PDM", "label": "Predictive maintenance", "value": 30000, "note": "Weigher drift, manual events, alarms"},
        {"id": "P_WC", "label": "Working-capital release", "value": 90000, "note": "Days-on-hand model from MSTLOG"},
        {"id": "P_TPUT", "label": "Throughput optimisation", "value": 45000, "note": "Cycle time & t/h by route/SKU"},
        {"id": "P_FLUSH", "label": "Cross-contam carryover audit", "value": 60000, "note": "CCLOGS changeover discipline"},
        {"id": "P_KPI", "label": "Live KPI dashboard", "value": 15000, "note": "Decision-speed"},
        {"id": "P_RECALL", "label": "Mock-recall pack", "value": 50000, "note": "LOT_NO + carryover traceability"},
    ],
    "edges_table_concept": [
        ("BSTARTS", "BATCH"), ("BSTARTS", "CUST"), ("BEND2S", "BATCH"), ("BEND2S", "THROUGHPUT"),
        ("BWEIGHS", "BATCH"), ("BWEIGHS", "MATERIAL"), ("BWEIGHS", "TRACE"),
        ("CCLOGS", "XCONTAM"), ("CCLOGS", "TRACE"),
        ("MSTLOG", "MATERIAL"), ("BSTLOG", "MATERIAL"), ("INTLOGS", "MATERIAL"), ("INTLOGS", "TRACE"),
        ("MANLOG", "EQHEALTH"), ("ALMLOGS", "EQHEALTH"), ("ALMLOGS", "BATCH"),
        ("RTCLOGS", "THROUGHPUT"), ("FRMLOG", "RECIPE"), ("LBLPRINT", "TRACE"),
    ],
    "edges_concept_product": [
        ("BATCH", "P_CERT"), ("RECIPE", "P_CERT"), ("TRACE", "P_CERT"), ("XCONTAM", "P_CERT"),
        ("BATCH", "P_GAP"), ("MATERIAL", "P_GAP"), ("EQHEALTH", "P_GAP"), ("XCONTAM", "P_GAP"),
        ("EQHEALTH", "P_PDM"), ("THROUGHPUT", "P_PDM"),
        ("MATERIAL", "P_WC"),
        ("THROUGHPUT", "P_TPUT"), ("BATCH", "P_TPUT"),
        ("XCONTAM", "P_FLUSH"), ("TRACE", "P_FLUSH"),
        ("BATCH", "P_KPI"), ("THROUGHPUT", "P_KPI"), ("EQHEALTH", "P_KPI"),
        ("TRACE", "P_RECALL"), ("MATERIAL", "P_RECALL"), ("XCONTAM", "P_RECALL"),
    ],
}
(OUT / "knowledge-graph.json").write_text(json.dumps(kg))

commercial = {
    "production": production,
    "monthly": commercial_monthly,
    "timeline": timeline,
    "accuracy": accuracy,
    "throughput": {
        "t_per_h_mean": throughput["summary"]["t_per_h_mean"],
        "duration_min_mean": throughput["summary"]["duration_min_mean"],
        "total_hours": throughput["summary"]["total_hours"],
        "batches_timed": throughput["summary"]["batches_timed"],
        "pct_timed": throughput["summary"]["pct_timed"],
    },
    "weighers": weighers,
    "skus": skus,
    "customers": customers,
    "ingredient_catalog": ingredient_catalog,
    "weigher_ingredient": weigher_ingredient,
    "inventory_value_gbp": 0,
    "alerts": [
        {"level": "red" if production["unassigned_pct"] > 15 else "amber",
         "title": "Customer attribution gap", "value": f"{production['unassigned_pct']}% batches unassigned",
         "impact_gbp": 40000, "note": "Batches without CUST_NAME break MES->ERP attribution."},
        {"level": "amber", "title": "Additive batching accuracy",
         "value": f"{micro['in_tol_pct'] if micro else 0}% in tolerance", "impact_gbp": 25000,
         "note": "Micro/additive scales sit well below macro weigher accuracy."},
        {"level": "red" if lot_cov < 30 else "green", "title": "Lot traceability",
         "value": f"{lot_cov}% LOT_NO coverage", "impact_gbp": 50000 if lot_cov < 30 else 0,
         "note": "Drives mock-recall feasibility."},
        {"level": "green", "title": "Carryover discipline",
         "value": f"{carryover['changeover_test_pct']}% changeovers tested", "impact_gbp": 0,
         "note": f"{carryover['changeovers']:,} formula changeovers logged with carryover tests."},
        {"level": "amber", "title": "Working-capital trapped",
         "value": f"{pdm_data['totals']['overstocked']} materials >150 days", "impact_gbp": 90000,
         "note": "FIFO discipline opportunity on slow-moving bulks."},
    ],
}
(OUT / "commercial.json").write_text(json.dumps(commercial, default=str))

cert_index = []
for s in bstarts:
    lb = s.get("LOG_BATCH")
    if not lb:
        continue
    e2 = bend2_by.get(lb)
    cert_index.append({
        "log_batch": str(lb), "frm_code": (s.get("FRM_CODE") or "").strip(),
        "cust_name": (s.get("CUST_NAME") or "").strip() or "(Unassigned)",
        "start": str(s.get("START_TIME") or "")[:19],
        "target_wgt": F(e2.get("TOT_TGT")) if e2 else 0,
        "actual_wgt": F(e2.get("TOT_ACT")) if e2 else 0,
        "kwh": 0,
    })
(OUT / "certificates.json").write_text(json.dumps({"batches": cert_index}, default=str))
(OUT / "pdm.json").write_text(json.dumps(pdm_data, default=str))
(OUT / "alarms-insights.json").write_text(json.dumps(alarms_insights, default=str))
(OUT / "throughput.json").write_text(json.dumps(throughput, default=str))
(OUT / "weighments.json").write_text(json.dumps(weighments, default=str))
(OUT / "process-flow.json").write_text(json.dumps(process_flow, default=str))

print("\nDone. Files written to data/:")
for f in sorted(OUT.iterdir()):
    print(f"  {f.name:30s} {f.stat().st_size/1024:>8.1f} KB")
