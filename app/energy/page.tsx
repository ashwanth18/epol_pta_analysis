import { Callout, PageHeader, Pill, Stat } from "@/components/ui";
import { energyEstimate } from "@/lib/data";
import { fmtGbp, fmtNumber } from "@/lib/format";
import { EnergyClient } from "./Client";

export default function EnergyPage() {
  const e = energyEstimate;
  const all = e.scenarios.all;
  const range =
    e.window_from && e.window_to ? `${e.window_from} → ${e.window_to}` : "batch window";

  const grossKwh = all.est_kwh_grossed ?? all.est_kwh;
  const grossCost = all.est_cost_grossed_gbp ?? all.est_cost_gbp;
  const lowKwh = Math.round((grossKwh * e.model.kwh_per_t_p10) / e.model.kwh_per_t_mean);
  const highKwh = Math.round((grossKwh * e.model.kwh_per_t_p90) / e.model.kwh_per_t_mean);

  return (
    <div>
      <PageHeader
        title="Estimated Energy"
        subtitle={`Estimated press/pelleting energy and cost · ${range}.`}
        right={<Pill tone="amber">Estimated · not metered</Pill>}
      />

      <Callout title="Estimated figures — for guidance" tone="amber">
        epol has no energy meter, so these are <strong>modelled estimates</strong>, not measured
        readings. Based on a typical pelleting rate of <strong>{e.model.kwh_per_t_mean} kWh/tonne</strong>{" "}
        and an assumed <strong>£{e.tariff_gbp_per_kwh.toFixed(2)}/kWh</strong> electricity price.
      </Callout>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-6">
        <Stat
          value={`${fmtNumber(grossKwh)} kWh`}
          label="Estimated energy"
          tone="info"
          hint={`range ${fmtNumber(lowKwh)}–${fmtNumber(highKwh)} kWh`}
        />
        <Stat value={fmtGbp(grossCost)} label="Estimated cost" tone="amber" hint={`@ £${e.tariff_gbp_per_kwh.toFixed(2)}/kWh`} />
        <Stat value={`${e.model.kwh_per_t_mean}`} label="kWh per tonne" hint="typical pelleting rate" />
        <Stat value={`${fmtNumber(e.coverage.total_tonnes)} t`} label="Tonnes produced" />
      </div>

      <EnergyClient data={e} />
    </div>
  );
}
