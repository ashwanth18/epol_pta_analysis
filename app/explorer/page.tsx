import { PageHeader } from "@/components/ui";
import { inventory, weighments } from "@/lib/data";
import { ExplorerClient } from "./Client";

export default function ExplorerPage() {
  return (
    <div>
      <PageHeader
        title="DBF Data Explorer"
        subtitle={`Interactive catalog of every DBF table in the epol PTA install. ${inventory.total.toLocaleString()} tables · ${inventory.total_records.toLocaleString()} records · ${Object.keys(inventory.cats).length} categories. Click a row to inspect schema, browse the latest daily snapshot, and see joined tables.`}
      />
      <ExplorerClient inventory={inventory} weighments={weighments} />
    </div>
  );
}
