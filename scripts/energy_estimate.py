#!/usr/bin/env python3
"""Estimate epol PTA press/pelleting energy by transferring Penmill's metered
kWh/tonne benchmark onto epol's batch tonnage.

WHY THIS IS A MODELLED ESTIMATE, NOT A MEASUREMENT
--------------------------------------------------
epol has NO energy metering (no KWH field on BENDS/BEND2S). Penmill DOES: a
press-line kWh sub-meter on the main pellet-press motor (BENDS.KWH). Both mills
run the same SCADA/DBF schema and the same "PP" press-route naming, so Penmill's
press intensity is a reasonable benchmark for epol's pelleting.

WHY A FLAT TRANSFERABLE BENCHMARK, NOT A BLACK-BOX ML MODEL
----------------------------------------------------------
We could train a regression/GBM on Penmill (target = kWh/t; features = tonnes,
throughput t/h, ingredient count). But the only features shared by both plants
sit in DIFFERENT ranges:
  - throughput: Penmill ~4.3 t/h vs epol ~0.6 t/h
  - batch size: Penmill ~3.0 t  vs epol ~2.0 t
  - ingredient count: Penmill ~12-18 vs epol ~16-22
A model that learned feature-dependence on Penmill would be EXTRAPOLATING for
epol, and there is no epol ground truth to validate against. So the only robustly
transferable quantity is the marginal kWh/tonne DISTRIBUTION (mean + p10/p90).
We apply that as the central estimate with an uncertainty band, and expose the
ingredient-count sensitivity for transparency only (not applied, because epol's
counts sit largely outside Penmill's training range).
"""
import json
import os
from collections import defaultdict
from datetime import datetime
from statistics import mean

HERE = os.path.dirname(os.path.abspath(__file__))
EPOL_ROOT = os.path.dirname(HERE)
PENMILL_ENERGY = os.path.join(os.path.dirname(EPOL_ROOT), "data", "energy.json")
EPOL_THROUGHPUT = os.path.join(EPOL_ROOT, "data", "throughput.json")
EPOL_COMMERCIAL = os.path.join(EPOL_ROOT, "data", "commercial.json")
OUT = os.path.join(EPOL_ROOT, "data", "energy-estimate.json")

# Assumed industrial electricity tariff. Clearly an assumption — adjust to the
# customer's actual unit rate. UK industrial ~£0.25/kWh in 2025-26.
GBP_PER_KWH = 0.25

# Penmill-derived fallback coefficients (snapshot of data/energy.json summary),
# used only if the live Penmill export is unavailable so the build stays
# reproducible.
FALLBACK = {
    "trained_on_batches": 725,
    "kwh_per_t_mean": 5.009,
    "kwh_per_t_median": 4.898,
    "kwh_per_t_p10": 3.942,
    "kwh_per_t_p90": 5.941,
    "kwh_per_t_stdev": 1.226,
    "ingredient_buckets": [],
}


def load_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def build_model():
    pen = load_json(PENMILL_ENERGY)
    if not pen:
        m = dict(FALLBACK)
        m["source"] = "Metered pelleting benchmark (kWh/tonne) — reference, fallback constants"
        return m
    s = pen["summary"]
    buckets = []
    for b in pen.get("ingredient_count_buckets", []):
        if b.get("batches", 0) >= 20:  # only reliable buckets
            buckets.append(
                {
                    "ingredient_count": b["ingredient_count"],
                    "kwh_per_t": round(b["kwh_per_t_mean"], 3),
                    "batches": b["batches"],
                }
            )
    return {
        "source": "Metered pelleting benchmark (kWh/tonne) — reference press line",
        "trained_on_batches": s.get("batches_metered"),
        "kwh_per_t_mean": s["kwh_per_t_mean"],
        "kwh_per_t_median": s["kwh_per_t_median"],
        "kwh_per_t_p10": s["kwh_per_t_p10"],
        "kwh_per_t_p90": s["kwh_per_t_p90"],
        "kwh_per_t_stdev": s["kwh_per_t_stdev"],
        "ingredient_buckets": buckets,
        "distribution": pen.get("distribution", []),
    }


def main():
    model = build_model()
    tp = load_json(EPOL_THROUGHPUT)
    if not tp:
        raise SystemExit("epol throughput.json not found — run export-data first.")
    comm = load_json(EPOL_COMMERCIAL) or {}

    cen = model["kwh_per_t_mean"]
    lo = model["kwh_per_t_p10"]
    hi = model["kwh_per_t_p90"]

    batches = tp["batches"]
    timed_tonnes = sum(b["tonnes"] for b in batches)

    # Total production tonnage (all batches, timed or not) for a grossed-up view.
    total_tonnes = None
    if comm.get("production"):
        total_tonnes = comm["production"].get("tonnes")
    if not total_tonnes:
        total_tonnes = timed_tonnes
    gross_up = (total_tonnes / timed_tonnes) if timed_tonnes else 1.0

    def scen(rows):
        t = sum(r["tonnes"] for r in rows)
        return {
            "batches": len(rows),
            "tonnes": round(t, 1),
            "est_kwh": round(t * cen),
            "est_kwh_low": round(t * lo),
            "est_kwh_high": round(t * hi),
            "kwh_per_t": cen,
            "est_cost_gbp": round(t * cen * GBP_PER_KWH),
            "est_cost_low_gbp": round(t * lo * GBP_PER_KWH),
            "est_cost_high_gbp": round(t * hi * GBP_PER_KWH),
        }

    press_rows = [b for b in batches if str(b.get("route", "")).upper().startswith("PP")]
    all_scen = scen(batches)
    all_scen["est_kwh_grossed"] = round(timed_tonnes * cen * gross_up)
    all_scen["est_cost_grossed_gbp"] = round(timed_tonnes * cen * gross_up * GBP_PER_KWH)

    scenarios = {"all": all_scen, "press_only": scen(press_rows)}

    # Monthly (all-product scenario).
    m_t = defaultdict(float)
    for b in batches:
        d = b.get("date")
        if not d:
            continue
        m_t[d[:7]] += b["tonnes"]
    monthly = []
    for m in sorted(m_t):
        t = m_t[m]
        monthly.append(
            {
                "month": m,
                "tonnes": round(t, 1),
                "est_kwh": round(t * cen),
                "est_kwh_low": round(t * lo),
                "est_kwh_high": round(t * hi),
                "est_cost_gbp": round(t * cen * GBP_PER_KWH),
            }
        )

    # By route.
    r_t = defaultdict(float)
    r_b = defaultdict(int)
    for b in batches:
        r_t[b["route"]] += b["tonnes"]
        r_b[b["route"]] += 1
    by_route = []
    for r in sorted(r_t, key=lambda x: -r_t[x]):
        t = r_t[r]
        by_route.append(
            {
                "route": r,
                "press": str(r).upper().startswith("PP"),
                "batches": r_b[r],
                "tonnes": round(t, 1),
                "est_kwh": round(t * cen),
                "kwh_per_t": cen,
            }
        )

    # By SKU/formula (top 30 by tonnage).
    sku_t = defaultdict(float)
    sku_b = defaultdict(int)
    sku_name = {}
    for b in batches:
        code = b.get("frm_code") or "—"
        sku_t[code] += b["tonnes"]
        sku_b[code] += 1
        sku_name.setdefault(code, b.get("frm_name") or "")
    by_sku = []
    for code in sorted(sku_t, key=lambda x: -sku_t[x])[:30]:
        t = sku_t[code]
        by_sku.append(
            {
                "code": code,
                "name": sku_name[code],
                "batches": sku_b[code],
                "tonnes": round(t, 1),
                "est_kwh": round(t * cen),
                "kwh_per_t": cen,
            }
        )

    # Daily.
    d_t = defaultdict(float)
    for b in batches:
        if b.get("date"):
            d_t[b["date"]] += b["tonnes"]
    daily = [
        {"date": d, "tonnes": round(d_t[d], 1), "est_kwh": round(d_t[d] * cen)}
        for d in sorted(d_t)
    ]

    # Ingredient-count sensitivity (informational; NOT applied to the central
    # estimate). Shows what an ingredient-conditioned model would imply, and how
    # much of epol's volume sits outside Penmill's trained range.
    bucket_map = {b["ingredient_count"]: b["kwh_per_t"] for b in model.get("ingredient_buckets", [])}
    pen_counts = sorted(bucket_map) if bucket_map else []
    pen_min = pen_counts[0] if pen_counts else None
    pen_max = pen_counts[-1] if pen_counts else None
    ic_t = defaultdict(float)
    ic_b = defaultdict(int)
    for b in batches:
        ic = b.get("ingredients")
        if ic:
            ic_t[ic] += b["tonnes"]
            ic_b[ic] += 1
    ingredient_sensitivity = []
    for ic in sorted(ic_t):
        in_range = pen_min is not None and pen_min <= ic <= pen_max
        coeff = bucket_map.get(ic, cen)
        ingredient_sensitivity.append(
            {
                "ingredient_count": ic,
                "batches": ic_b[ic],
                "tonnes": round(ic_t[ic], 1),
                "model_kwh_per_t": coeff,
                "in_training_range": bool(in_range),
            }
        )

    out = {
        "window_from": tp.get("window_from"),
        "window_to": tp.get("window_to"),
        "tariff_gbp_per_kwh": GBP_PER_KWH,
        "model": model,
        "coverage": {
            "timed_batches": len(batches),
            "timed_tonnes": round(timed_tonnes, 1),
            "total_tonnes": round(total_tonnes, 1),
            "tonnes_coverage_pct": round(100 * timed_tonnes / total_tonnes, 1) if total_tonnes else 100.0,
            "gross_up_factor": round(gross_up, 3),
            "pen_training_ingredient_range": [pen_min, pen_max],
        },
        "scenarios": scenarios,
        "monthly": monthly,
        "by_route": by_route,
        "by_sku": by_sku,
        "daily": daily,
        "ingredient_sensitivity": ingredient_sensitivity,
        "distribution": model.get("distribution", []),
        "notes": [
            "ESTIMATED VALUES — NOT GROUND TRUTH. epol has no on-site energy metering. "
            "Figures are inferred from a metered pelleting benchmark (kWh/tonne), not measured.",
            f"Central estimate = tonnes x {cen} kWh/t (benchmark mean). Band = p10 {lo} to p90 {hi} kWh/t.",
            "The benchmark covers press/pelleting only — meal/mash that is not pelleted "
            "would use far less. The 'all product' scenario therefore upper-bounds "
            "pelleting energy; 'press routes only' (PP*) lower-bounds it.",
            f"Cost assumes £{GBP_PER_KWH:.2f}/kWh — replace with the customer's actual unit rate.",
            "Estimate covers timed batches; the grossed-up figure scales to all "
            "production by tonnage and assumes untimed batches share the same intensity.",
            "Cannot be validated without an epol sub-meter — fitting one is the cheapest "
            "way to turn this estimate into a measurement (a gap-analysis action).",
        ],
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }

    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    print(f"[energy-estimate] wrote {OUT}")
    print(f"  timed tonnes={timed_tonnes:.0f}  total tonnes={total_tonnes:.0f}  coverage={out['coverage']['tonnes_coverage_pct']}%")
    print(f"  ALL scenario:    {all_scen['est_kwh']:,} kWh  (band {all_scen['est_kwh_low']:,}–{all_scen['est_kwh_high']:,})  ~£{all_scen['est_cost_gbp']:,}")
    print(f"  grossed to all:  {all_scen['est_kwh_grossed']:,} kWh  ~£{all_scen['est_cost_grossed_gbp']:,}")
    print(f"  PRESS-only (PP*):{scenarios['press_only']['est_kwh']:,} kWh  ({scenarios['press_only']['tonnes']:,} t)")


if __name__ == "__main__":
    main()
