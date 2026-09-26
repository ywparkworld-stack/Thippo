/**
 * Docker なしで Supabase 形式の型定義（Database 型）を生成する予備のスクリプト。
 * 通常は `pnpm db:types`（supabase gen types、Docker が必要）を使う。
 *
 *   DATABASE_URL=postgres://... pnpm --filter @thippo/db gen:types:pg
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const scalar: Record<string, string> = {
  uuid: "string",
  text: "string",
  bool: "boolean",
  int2: "number",
  int4: "number",
  int8: "number",
  float8: "number",
  numeric: "number",
  date: "string",
  time: "string",
  timestamptz: "string",
  tstzrange: "string",
  jsonb: "Json",
  void: "undefined",
  json: "Json",
};

function tsType(udt: string, enums: Set<string>): string {
  if (udt.startsWith("_")) return `${tsType(udt.slice(1), enums)}[]`;
  if (enums.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
  return scalar[udt] ?? "unknown";
}

async function main() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const enumRows = (
    await client.query<{ name: string; values: string[] }>(`
      select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder)::text[] as values
      from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' group by t.typname order by t.typname`)
  ).rows;
  const enums = new Set(enumRows.map((e) => e.name));
  const cols = (
    await client.query<{
      table_name: string;
      column_name: string;
      udt_name: string;
      is_nullable: "YES" | "NO";
      column_default: string | null;
      is_identity: "YES" | "NO";
      is_generated: "ALWAYS" | "NEVER";
    }>(`
      select c.table_name, c.column_name, c.udt_name, c.is_nullable, c.column_default, c.is_identity, c.is_generated
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and t.table_type in ('BASE TABLE', 'VIEW')
      order by c.table_name, c.column_name`)
  ).rows;
  const fnParams = (
    await client.query<{
      routine_name: string;
      specific_name: string;
      parameter_mode: "IN" | "OUT" | "INOUT" | null;
      parameter_name: string | null;
      udt_name: string | null;
      ordinal_position: number | null;
      routine_udt: string;
      parameter_default: string | null;
    }>(`
      select r.routine_name, r.specific_name, p.parameter_mode, p.parameter_name, p.udt_name,
             p.ordinal_position, r.type_udt_name as routine_udt, p.parameter_default
      from information_schema.routines r
      left join information_schema.parameters p
        on p.specific_schema = r.specific_schema and p.specific_name = r.specific_name
      where r.routine_schema = 'public' and r.routine_type = 'FUNCTION'
      order by r.routine_name, p.ordinal_position`)
  ).rows;
  const fks = (
    await client.query<{
      table_name: string;
      name: string;
      columns: string[];
      ref_table: string;
      ref_columns: string[];
      one_to_one: boolean;
    }>(`
      select c.conrelid::regclass::text as table_name, c.conname as name,
        array(select a.attname from unnest(c.conkey) k join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k)::text[] as columns,
        c.confrelid::regclass::text as ref_table,
        array(select a.attname from unnest(c.confkey) k join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k)::text[] as ref_columns,
        exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indisunique and i.indpred is null
                and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x) = (select array_agg(x order by x) from unnest(c.conkey) x)) as one_to_one
      from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where c.contype = 'f' and n.nspname = 'public' and c.confrelid::regclass::text not like '%.%'
      order by 1, 2`)
  ).rows;
  const viewNames = new Set(
    (
      await client.query<{ table_name: string }>(
        "select table_name from information_schema.views where table_schema = 'public'",
      )
    ).rows.map((r) => r.table_name),
  );
  await client.end();

  const tables = new Map<string, typeof cols>();
  const views = new Map<string, typeof cols>();
  for (const c of cols) {
    const target = viewNames.has(c.table_name) ? views : tables;
    target.set(c.table_name, [...(target.get(c.table_name) ?? []), c]);
  }

  const out: string[] = [];
  out.push("// このファイルは自動生成です。直接編集しないでください（packages/db/README.md）。");
  out.push(
    "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];",
  );
  out.push("");
  out.push("export type Database = {");
  out.push("  public: {");
  out.push("    Tables: {");
  for (const [table, columns] of tables) {
    out.push(`      ${table}: {`);
    for (const kind of ["Row", "Insert", "Update"] as const) {
      out.push(`        ${kind}: {`);
      for (const c of columns) {
        const t = tsType(c.udt_name, enums);
        const nullable = c.is_nullable === "YES";
        const type = nullable ? `${t} | null` : t;
        const hasDefault = c.column_default !== null || c.is_identity === "YES" || nullable;
        if (kind === "Row") out.push(`          ${c.column_name}: ${type};`);
        else if (c.is_generated === "ALWAYS" || (c.is_identity === "YES" && kind === "Insert")) {
          out.push(`          ${c.column_name}?: never;`);
        } else if (kind === "Insert" && !hasDefault)
          out.push(`          ${c.column_name}: ${type};`);
        else out.push(`          ${c.column_name}?: ${type};`);
      }
      out.push("        };");
    }
    const rels = fks.filter((f) => f.table_name === table);
    if (rels.length === 0) out.push("        Relationships: [];");
    else {
      out.push("        Relationships: [");
      for (const f of rels) {
        out.push(
          `          { foreignKeyName: ${JSON.stringify(f.name)}; columns: ${JSON.stringify(f.columns)}; isOneToOne: ${f.one_to_one}; referencedRelation: ${JSON.stringify(f.ref_table)}; referencedColumns: ${JSON.stringify(f.ref_columns)} },`,
        );
      }
      out.push("        ];");
    }
    out.push("      };");
  }
  out.push("    };");
  if (views.size === 0) out.push("    Views: { [_ in never]: never };");
  else {
    out.push("    Views: {");
    for (const [view, columns] of views) {
      out.push(`      ${view}: {`);
      out.push("        Row: {");
      for (const c of columns)
        out.push(`          ${c.column_name}: ${tsType(c.udt_name, enums)} | null;`);
      out.push("        };");
      out.push("        Relationships: [];");
      out.push("      };");
    }
    out.push("    };");
  }
  out.push("    Functions: {");
  const byFn = new Map<string, typeof fnParams>();
  for (const r of fnParams) byFn.set(r.routine_name, [...(byFn.get(r.routine_name) ?? []), r]);
  for (const [name, params] of byFn) {
    const ins = params.filter((p) => p.parameter_mode === "IN" && p.parameter_name);
    const outs = params.filter((p) => p.parameter_mode === "OUT" && p.parameter_name);
    const args = ins.map(
      (p) =>
        `${p.parameter_name}${p.parameter_default === null ? "" : "?"}: ${tsType(p.udt_name!, enums)}`,
    );
    const ret =
      outs.length > 0
        ? `{ ${outs.map((p) => `${p.parameter_name}: ${tsType(p.udt_name!, enums)}`).join("; ")} }[]`
        : tsType(params[0]!.routine_udt, enums);
    out.push(`      ${name}: { Args: { ${args.join("; ")} }; Returns: ${ret} };`);
  }
  out.push("    };");
  out.push("    Enums: {");
  for (const e of enumRows)
    out.push(`      ${e.name}: ${e.values.map((v) => JSON.stringify(v)).join(" | ")};`);
  out.push("    };");
  out.push("    CompositeTypes: { [_ in never]: never };");
  out.push("  };");
  out.push("};");
  out.push("");
  out.push(
    'export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];',
  );
  out.push(
    'export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];',
  );
  out.push(
    'export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];',
  );
  out.push(
    'export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];',
  );
  out.push("");
  writeFileSync(join(import.meta.dirname, "..", "src", "database.types.ts"), out.join("\n"));
}

await main();
