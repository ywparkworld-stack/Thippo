// supabase/migrations の SQL を順番どおり1つにまとめて supabase/setup-all.sql に書き出す（付録 D39）。
// Supabase の SQL Editor に貼り付けて、新しいプロジェクトのデータベースを手作業で用意するため。
// --check を付けると、書き出さずに最新かどうかだけを確かめる（CI で使う）。
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dir = join(root, "supabase", "migrations");
const out = join(root, "supabase", "setup-all.sql");

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const parts = [
  "-- thippo のデータベースの設定（supabase/migrations のファイルを順番どおりにまとめたもの）",
  "-- 自動生成：pnpm db:bundle。直接編集しない。",
  "-- 新しい Supabase プロジェクトの SQL Editor に全部貼り付けて「Run」を1回押す（docs/manual-setup.md）。",
  "",
];
for (const f of files) {
  parts.push(`-- ===== ${f} =====`, readFileSync(join(dir, f), "utf8").trimEnd(), "");
}
const sql = parts.join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(out, "utf8");
  } catch {
    // まだない
  }
  if (current !== sql) {
    console.error("supabase/setup-all.sql が古くなっています。pnpm db:bundle を実行してください。");
    process.exit(1);
  }
  console.log(`supabase/setup-all.sql は最新です（${files.length} ファイル）`);
} else {
  writeFileSync(out, sql);
  console.log(`supabase/setup-all.sql を書き出しました（${files.length} ファイル）`);
}
