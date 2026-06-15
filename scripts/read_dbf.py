#!/usr/bin/env python3
"""Read paginated rows from a storaweigh/*.DBF for the Data Explorer API."""
import argparse
import json
import re
import sys
from pathlib import Path

from dbfread import DBF

ROOT = Path(__file__).resolve().parent.parent
EPOL = ROOT / "epolPTA"
TABLE_RE = re.compile(r"^[A-Za-z0-9_]+\.DBF$", re.I)


def latest_day_dir():
    days = sorted(EPOL.glob("2026/*/*"))
    return days[-1] if days else EPOL


STORE = latest_day_dir()


def serialize(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    return str(value)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("table", help="Table name, e.g. BWEIGHS.DBF")
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--search", default="", help="Case-insensitive substring filter")
    args = parser.parse_args()

    name = args.table if args.table.upper().endswith(".DBF") else f"{args.table}.DBF"
    if not TABLE_RE.match(name):
        print(json.dumps({"error": "invalid_table", "table": name}))
        sys.exit(1)

    path = STORE / name
    if not path.exists():
        print(json.dumps({"error": "not_found", "table": name}))
        sys.exit(1)

    meta = DBF(str(path), load=False)
    fields = list(meta.field_names)
    total_records = len(meta)
    table = DBF(str(path), encoding="latin-1", ignore_missing_memofile=True)
    q = args.search.strip().upper()

    if q:
        matched = []
        for rec in table:
            row = {f: serialize(rec.get(f)) for f in fields}
            if any(q in str(v).upper() for v in row.values() if v is not None):
                matched.append(row)
        total = len(matched)
        rows = matched[args.offset : args.offset + args.limit]
    else:
        total = total_records
        rows = []
        for i, rec in enumerate(table):
            if i < args.offset:
                continue
            rows.append({f: serialize(rec.get(f)) for f in fields})
            if len(rows) >= args.limit:
                break

    print(
        json.dumps(
            {
                "table": name,
                "fields": fields,
                "total": total,
                "offset": args.offset,
                "limit": args.limit,
                "search": args.search,
                "rows": rows,
            },
            default=str,
        )
    )


if __name__ == "__main__":
    main()
