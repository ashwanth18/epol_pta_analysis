import { Callout, Card, CardBody, CardHeader, PageHeader, Pill, Stat } from "@/components/ui";
import { certificates } from "@/lib/data";
import { CertClient } from "./Client";

export default function CertificatesPage() {
  return (
    <div>
      <PageHeader
        title="Batch Certificates"
        subtitle="Per-batch traceability documents for feed-safety compliance. Joined from BSTARTS + BEND2S totals + BWEIGHS + CCLOGS carryover."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat value={certificates.batches.length.toLocaleString()} label="Batches indexed" />
        <Stat value={new Set(certificates.batches.map((b) => b.frm_code)).size.toString()} label="Unique formulas" tone="info" />
        <Stat value={new Set(certificates.batches.map((b) => b.cust_name)).size.toString()} label="Distinct customers" />
        <Stat
          value={`${Math.round((100 * certificates.batches.filter((b) => b.cust_name !== "(Unassigned)").length) / Math.max(certificates.batches.length, 1))}%`}
          label="Batches with customer"
          tone="info"
        />
      </div>

      <Callout title="Certificate value proposition" tone="info">
        Each generated certificate documents target vs. actual weights per ingredient, total batch weight, customer attribution, and carryover-test
        provenance at changeover. This is exactly the document a feed-safety auditor expects to see — and what a feed-buying customer can use to validate
        compliance claims.
      </Callout>

      <CertClient batches={certificates.batches} />
    </div>
  );
}
