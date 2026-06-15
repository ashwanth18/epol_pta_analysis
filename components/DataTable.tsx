"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  align?: "left" | "right" | "center";
  sortValue?: (row: T) => string | number;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  searchPlaceholder?: string;
  searchText?: (row: T) => string;
  defaultSort?: { id: string; dir: SortDir };
  pageSize?: number;
  headerRight?: ReactNode;
  emptyMessage?: string;
  /** When this value changes, the search box is updated (e.g. jump from a chart click). */
  initialQuery?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchPlaceholder = "Search…",
  searchText,
  defaultSort,
  pageSize = 25,
  headerRight,
  emptyMessage = "No rows match the current filters.",
  initialQuery = "",
}: DataTableProps<T>) {
  const [query, setQuery] = useState(initialQuery);
  const [sortId, setSortId] = useState(defaultSort?.id ?? columns[0]?.id ?? "");
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.dir ?? "desc");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setQuery(initialQuery);
    setPage(0);
  }, [initialQuery]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    let list = rows;
    if (q && searchText) {
      list = list.filter((r) => searchText(r).toUpperCase().includes(q));
    }
    const col = columns.find((c) => c.id === sortId);
    if (col?.sortValue) {
      list = [...list].sort((a, b) => {
        const av = col.sortValue!(a);
        const bv = col.sortValue!(b);
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return list;
  }, [rows, query, searchText, columns, sortId, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const setSort = (id: string) => {
    if (id === sortId) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortId(id);
      setSortDir("desc");
    }
    setPage(0);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-ink-200 dark:border-ink-700">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder={searchPlaceholder}
          className="flex-1 min-w-[180px] text-sm px-3 py-1.5 border border-ink-200 dark:border-ink-700 rounded-md bg-white dark:bg-ink-800"
        />
        <div className="text-xs text-ink-500 tabular-nums">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}
        </div>
        {headerRight}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
            <tr className="text-left">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={[
                    "px-4 py-2 font-medium",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "",
                    col.sortValue ? "cursor-pointer select-none hover:text-accent" : "",
                  ].join(" ")}
                  onClick={col.sortValue ? () => setSort(col.id) : undefined}
                >
                  {col.header}
                  {col.sortValue && sortId === col.id ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-ink-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={rowKey(row, i)} className="border-b border-ink-100 dark:border-ink-800">
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={[
                        "px-4 py-2",
                        col.align === "right" ? "text-right tabular-nums" : col.align === "center" ? "text-center" : "",
                      ].join(" ")}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > pageSize && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-ink-200 dark:border-ink-700">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs text-ink-500">
            Page {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage >= totalPages - 1}
            className="text-xs px-3 py-1 border border-ink-200 dark:border-ink-700 rounded disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/** Hook for chart views — same search/sort, optional limit for bar chart height */
export function useFilteredRows<T>(
  rows: T[],
  options: {
    searchText?: (row: T) => string;
    query: string;
    sortValue?: (row: T) => number | string;
    sortDir?: SortDir;
    limit?: number;
  },
) {
  return useMemo(() => {
    const q = options.query.trim().toUpperCase();
    let list = rows;
    if (q && options.searchText) {
      list = list.filter((r) => options.searchText!(r).toUpperCase().includes(q));
    }
    if (options.sortValue) {
      list = [...list].sort((a, b) => {
        const av = options.sortValue!(a);
        const bv = options.sortValue!(b);
        if (typeof av === "number" && typeof bv === "number") {
          return (options.sortDir ?? "desc") === "asc" ? av - bv : bv - av;
        }
        return (options.sortDir ?? "desc") === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    if (options.limit && options.limit > 0) {
      list = list.slice(0, options.limit);
    }
    return list;
  }, [rows, options]);
}
