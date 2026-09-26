/**
 * Generate lib/database.types.ts dari skema database yang sedang berjalan.
 *
 * Kenapa tidak `supabase gen types`: perintah itu menjalankan generator di
 * dalam container, jadi Docker Desktop harus hidup setiap kali skema berubah.
 * Introspeksi langsung lewat koneksi `pg` yang sudah dipakai runner lain
 * menghapus ketergantungan itu sepenuhnya.
 *
 * Cakupan: BASE TABLE di schema public beserta foreign key-nya. Skema ini
 * tidak memakai enum, view, atau function ber-return table (docs/Database.md
 * memakai text + CHECK, bukan tipe ENUM), jadi bagian itu dibiarkan kosong.
 * Kalau suatu saat menambah view atau enum, generator ini perlu diperluas.
 *
 * Pakai: npm run gen:types
 */
import { writeFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL kosong -- cek .env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

/** Pemetaan tipe Postgres -> TypeScript, mengikuti konvensi Supabase. */
function toTs(udt) {
  switch (udt) {
    case "uuid":
    case "text":
    case "varchar":
    case "bpchar":
    case "date":
    case "timestamptz":
    case "timestamp":
    case "time":
    case "timetz":
      return "string";
    case "int2":
    case "int4":
    case "int8":
    case "numeric":
    case "float4":
    case "float8":
      return "number";
    case "bool":
      return "boolean";
    case "json":
    case "jsonb":
      return "Json";
    default:
      return "unknown";
  }
}

try {
  const { rows: columns } = await client.query(`
    select
      c.table_name,
      c.column_name,
      c.udt_name,
      c.is_nullable = 'YES' as nullable,
      c.column_default is not null as has_default
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
    order by c.table_name, c.ordinal_position
  `);

  const { rows: fks } = await client.query(`
    select
      con.conname as name,
      src.relname as table_name,
      tgt.relname as referenced_relation,
      (select array_agg(a.attname::text order by k.ord)
         from unnest(con.conkey) with ordinality k(attnum, ord)
         join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
      ) as columns,
      (select array_agg(a.attname::text order by k.ord)
         from unnest(con.confkey) with ordinality k(attnum, ord)
         join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum
      ) as referenced_columns
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace n on n.oid = src.relnamespace
    join pg_namespace tn on tn.oid = tgt.relnamespace
    where con.contype = 'f' and n.nspname = 'public' and tn.nspname = 'public'
    order by src.relname, con.conname
  `);

  // Skema ini memakai text + CHECK, bukan tipe ENUM Postgres (lihat alasannya
  // di 0001_init.sql). Akibatnya kolom seperti `status` akan jadi `string`
  // longgar -- typo seperti "complete" bukannya "completed" lolos compile dan
  // baru ketahuan saat database menolaknya di runtime.
  // Solusinya: baca daftar nilai dari CHECK constraint dan jadikan union.
  const { rows: checks } = await client.query(`
    select t.relname as table_name, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'c' and n.nspname = 'public'
  `);

  /** "tabel.kolom" -> union literal, mis. `"open" | "closed"` */
  const unions = new Map();

  for (const { table_name, def } of checks) {
    const match = def.match(/^CHECK \(\((\w+) = ANY \(ARRAY\[(.+)\]\)\)\)$/);
    if (!match) continue;

    const [, column, list] = match;
    const values = [...list.matchAll(/'([^']+)'::text/g)].map((m) => m[1]);
    if (values.length) {
      unions.set(`${table_name}.${column}`, values.map((v) => `"${v}"`).join(" | "));
    }
  }

  const columnType = (table, c) =>
    unions.get(`${table}.${c.column_name}`) ?? toTs(c.udt_name);

  // --- Fungsi yang bisa dipanggil lewat .rpc() -----------------------
  // Tanpa bagian ini, setiap pemanggilan .rpc() ditolak TypeScript karena
  // daftar Functions-nya kosong.
  const { rows: functions } = await client.query(`
    select
      p.proname as name,
      pg_get_function_arguments(p.oid) as args,
      pg_get_function_result(p.oid)    as result
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_function_result(p.oid) <> 'trigger'
    order by p.proname
  `);

  /** "nama tipe, nama tipe" -> baris TypeScript. */
  const parseFields = (raw, indent) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const spasi = s.indexOf(" ");
        const nama = s.slice(0, spasi);
        const tipe = s.slice(spasi + 1).trim();
        return `${indent}${nama}: ${toTs(pgToUdt(tipe))}`;
      })
      .join("\n");

  /** Nama tipe SQL (mis. "timestamp with time zone") -> udt_name. */
  function pgToUdt(tipe) {
    const t = tipe.toLowerCase().replace(/\(.*\)/, "").trim();
    if (t.startsWith("timestamp with")) return "timestamptz";
    if (t.startsWith("timestamp")) return "timestamp";
    if (t === "character varying") return "varchar";
    if (t === "double precision") return "float8";
    if (t === "integer") return "int4";
    if (t === "bigint") return "int8";
    if (t === "smallint") return "int2";
    if (t === "boolean") return "bool";
    return t;
  }

  const functionsBody = functions
    .map((f) => {
      const args = f.args.trim()
        ? parseFields(f.args, "          ")
        : "          [key: string]: never";

      const tableMatch = f.result.match(/^TABLE\((.*)\)$/s);
      const returns = tableMatch
        ? `{\n${parseFields(tableMatch[1], "          ")}\n        }[]`
        : toTs(pgToUdt(f.result));

      return `      ${f.name}: {
        Args: {
${args}
        }
        Returns: ${returns}
      }`;
    })
    .join("\n");

  const tables = [...new Set(columns.map((c) => c.table_name))].sort();

  const body = tables
    .map((table) => {
      const cols = columns.filter((c) => c.table_name === table);

      const row = cols
        .map((c) => `          ${c.column_name}: ${columnType(table, c)}${c.nullable ? " | null" : ""}`)
        .join("\n");

      // Kolom boleh dilewatkan saat insert kalau nullable atau punya default.
      const insert = cols
        .map((c) => {
          const optional = c.nullable || c.has_default ? "?" : "";
          return `          ${c.column_name}${optional}: ${columnType(table, c)}${c.nullable ? " | null" : ""}`;
        })
        .join("\n");

      const update = cols
        .map((c) => `          ${c.column_name}?: ${columnType(table, c)}${c.nullable ? " | null" : ""}`)
        .join("\n");

      const rels = fks
        .filter((f) => f.table_name === table)
        .map(
          (f) => `          {
            foreignKeyName: "${f.name}"
            columns: [${f.columns.map((c) => `"${c}"`).join(", ")}]
            isOneToOne: false
            referencedRelation: "${f.referenced_relation}"
            referencedColumns: [${f.referenced_columns.map((c) => `"${c}"`).join(", ")}]
          }`,
        )
        // Antar entri butuh koma -- tanpa ini file hasil generate tidak
        // valid TypeScript sama sekali.
        .join(",\n");

      return `      ${table}: {
        Row: {
${row}
        }
        Insert: {
${insert}
        }
        Update: {
${update}
        }
        Relationships: [
${rels}
        ]
      }`;
    })
    .join("\n");

  const output = `// DIGENERATE OTOMATIS -- JANGAN DIEDIT MANUAL.
// Sumber: skema database Supabase. Regenerate dengan \`npm run gen:types\`
// setiap kali ada migration baru.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
${body}
    }
    Views: Record<never, never>
    Functions: {
${functionsBody}
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
`;

  await writeFile("lib/database.types.ts", output);
  console.log(`lib/database.types.ts: ${tables.length} tabel, ${fks.length} relasi`);
  console.log(tables.join(", "));
} finally {
  await client.end();
}
