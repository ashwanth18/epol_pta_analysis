import type { TooltipProps } from "recharts";

/** Consistent tooltip styling — avoids inheriting body text colour onto Recharts' default white box. */
export const chartTooltipProps: Partial<TooltipProps<number, string>> = {
  contentStyle: {
    backgroundColor: "var(--chart-tooltip-bg)",
    border: "1px solid var(--chart-tooltip-border)",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
    color: "var(--chart-tooltip-text)",
    padding: "8px 12px",
  },
  labelStyle: {
    color: "var(--chart-tooltip-label)",
    fontWeight: 600,
    marginBottom: 4,
  },
  itemStyle: {
    color: "var(--chart-tooltip-text)",
  },
};
