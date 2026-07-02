// Run once: node scripts/migrate.js
// Reads all JSON files from /data and loads them into PostgreSQL

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");

const TABLES_DIR   = path.join(__dirname, "..", "data", "tables");
const METADATA_DIR = path.join(__dirname, "..", "data", "metadata");
const SCHEMA_FILE  = path.join(__dirname, "..", "src", "schema.sql");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function applySchema(client) {
  const sql = await fs.readFile(SCHEMA_FILE, "utf8");
  await client.query(sql);
  console.log("Schema applied.");
}

async function migrateMetadata(client) {
  const entries = await fs.readdir(METADATA_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => path.join(METADATA_DIR, e.name));

  for (const file of files) {
    const record = await readJson(file);
    const m = record.metadata || {};

    await client.query(
      `INSERT INTO metadata_groups (
        metadata_id, title, description, product, category, geography,
        frequency, time_period, data_source, last_updated_date,
        future_release, key_statistics, remarks, metadata_excel,
        table_ids, classifications, concepts, full_record
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (metadata_id) DO UPDATE SET
        title              = EXCLUDED.title,
        description        = EXCLUDED.description,
        classifications    = EXCLUDED.classifications,
        full_record        = EXCLUDED.full_record`,
      [
        m.metadata_id,
        m.title,
        m.description,
        m.product,
        m.category,
        m.geography,
        m.frequency,
        m.time_period,
        m.data_source,
        m.last_updated_date,
        m.future_release,
        m.key_statistics,
        m.remarks,
        m.metadata_excel,
        m.table_ids || [],
        JSON.stringify(record.classifications || {}),
        record.concepts || [],
        JSON.stringify(record),
      ]
    );
    console.log(`  Metadata: ${m.metadata_id}`);
  }
}

async function migrateTable(client, file) {
  const record = await readJson(file);
  const d = record.dataset || {};
  const t = record.table   || {};

  await client.query(
    `INSERT INTO datasets (
      dataset_id, unique_dataset_id, table_id, metadata_id,
      title, short_description, long_description,
      category, geography, frequency, time_period, data_source,
      units, classifications, concepts, age_column_keys
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (dataset_id) DO UPDATE SET
      title             = EXCLUDED.title,
      classifications   = EXCLUDED.classifications,
      units             = EXCLUDED.units`,
    [
      d.dataset_id,
      d.unique_dataset_id,
      d.table_id,
      d.metadata_id     || null,
      d.title,
      d.short_description,
      d.long_description,
      d.category,
      d.geography,
      d.frequency,
      d.time_period,
      d.data_source,
      t.units           || null,
      JSON.stringify(record.classifications || {}),
      record.concepts   || [],
      JSON.stringify(t.age_column_keys || null),
    ]
  );

  // Delete existing rows for this dataset then re-insert
  await client.query("DELETE FROM dataset_rows WHERE dataset_id = $1", [d.dataset_id]);

  const rows = t.rows || [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    await client.query(
      `INSERT INTO dataset_rows (dataset_id, sl_no, row_index, row_data)
       VALUES ($1, $2, $3, $4)`,
      [d.dataset_id, String(row.sl_no ?? ""), i, JSON.stringify(row)]
    );
  }

  console.log(`  Dataset: ${d.dataset_id} (${rows.length} rows)`);
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("Connected to PostgreSQL.");
    await applySchema(client);

    console.log("\nMigrating metadata...");
    await migrateMetadata(client);

    console.log("\nMigrating tables...");
    const entries = await fs.readdir(TABLES_DIR, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => path.join(TABLES_DIR, e.name));

    for (const file of files) {
      await migrateTable(client, file);
    }

    console.log("\nMigration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
