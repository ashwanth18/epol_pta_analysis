import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const TABLE_RE = /^[A-Za-z0-9_]+(?:\.DBF)?$/i;

export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table");
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10) || 100));
  const search = req.nextUrl.searchParams.get("search") ?? "";

  if (!table || !TABLE_RE.test(table)) {
    return NextResponse.json({ error: "invalid_table" }, { status: 400 });
  }

  const script = path.join(process.cwd(), "scripts/read_dbf.py");
  const args = [script, table, "--offset", String(offset), "--limit", String(limit)];
  if (search.trim()) args.push("--search", search.trim());

  try {
    const { stdout, stderr } = await execFileAsync("python3", args, {
      maxBuffer: 20 * 1024 * 1024,
    });
    const data = JSON.parse(stdout);
    if (data.error) {
      const status = data.error === "not_found" ? 404 : 400;
      return NextResponse.json(data, { status });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const execErr = err as { stderr?: string; message?: string };
    const detail = (execErr.stderr || execErr.message || "").trim();
    const hint = detail.includes("dbfread")
      ? "Run: npm run setup-python"
      : "Ensure epolPTA/ exists and python3 + dbfread are installed.";
    return NextResponse.json(
      {
        error: "read_failed",
        message: detail ? `${detail}. ${hint}` : `Could not read DBF. ${hint}`,
      },
      { status: 500 },
    );
  }
}
