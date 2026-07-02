const path = require("path");
const pool = require("../db");

const METADATA_DIR = path.join(__dirname, "..", "..", "data", "metadata");

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeId(value) {
  return String(value || "").trim().toLowerCase();
}

function buildSummary(row) {
  return {
    dataset_id:      row.dataset_id,
    table_id:        row.table_id,
    title:           row.title,
    description:     row.short_description,
    category:        row.category,
    geography:       row.geography,
    frequency:       row.frequency,
    time_period:     row.time_period,
    data_source:     row.data_source,
    metadata_id:     row.metadata_id,
    metadata_title:  row.metadata_title || null,
  };
}

// ── public API ────────────────────────────────────────────────────────────────

async function getTableSummaries() {
  const { rows } = await pool.query(`
    SELECT
      d.dataset_id, d.table_id, d.title, d.short_description,
      COALESCE(d.category,    m.category)    AS category,
      COALESCE(d.geography,   m.geography)   AS geography,
      COALESCE(d.frequency,   m.frequency)   AS frequency,
      COALESCE(d.time_period, m.time_period) AS time_period,
      COALESCE(d.data_source, m.data_source) AS data_source,
      d.metadata_id,
      m.title AS metadata_title
    FROM datasets d
    LEFT JOIN metadata_groups m USING (metadata_id)
    ORDER BY d.dataset_id
  `);
  return rows.map(buildSummary);
}

async function getTableById(datasetId) {
  const wanted = normalizeId(datasetId);

  const { rows: datasets } = await pool.query(
    `SELECT
       d.*,
       m.title            AS meta_title,
       m.description      AS meta_description,
       m.category         AS meta_category,
       m.geography        AS meta_geography,
       m.frequency        AS meta_frequency,
       m.time_period      AS meta_time_period,
       m.data_source      AS meta_data_source,
       m.last_updated_date,
       m.future_release,
       m.key_statistics,
       m.remarks,
       m.classifications  AS meta_classifications,
       m.concepts         AS meta_concepts,
       m.full_record      AS metadata
     FROM datasets d
     LEFT JOIN metadata_groups m USING (metadata_id)
     WHERE LOWER(d.dataset_id) = $1`,
    [wanted]
  );

  if (!datasets.length) return null;
  const dataset = datasets[0];

  const { rows: dataRows } = await pool.query(
    `SELECT row_data FROM dataset_rows
     WHERE dataset_id = $1
     ORDER BY row_index`,
    [dataset.dataset_id]
  );

  return {
    dataset: {
      dataset_id:        dataset.dataset_id,
      unique_dataset_id: dataset.unique_dataset_id,
      table_id:          dataset.table_id,
      metadata_id:       dataset.metadata_id,
      title:             dataset.title,
      short_description: dataset.short_description,
      long_description:  dataset.long_description,
      category:          dataset.category,
      geography:         dataset.geography,
      frequency:         dataset.frequency,
      time_period:       dataset.time_period,
      data_source:       dataset.data_source,
    },
    metadata: dataset.metadata?.metadata || {},
    classifications: {
      ...(dataset.meta_classifications || {}),
      ...(dataset.classifications     || {}),
    },
    concepts: Array.from(new Set([
      ...(dataset.meta_concepts || []),
      ...(dataset.concepts      || []),
    ])),
    table: {
      units:           dataset.units,
      age_column_keys: dataset.age_column_keys || undefined,
      rows:            dataRows.map((r) => r.row_data),
    },
  };
}

async function getAllMetadata() {
  const { rows } = await pool.query(`
    SELECT full_record FROM metadata_groups ORDER BY metadata_id
  `);
  return rows.map((r) => r.full_record);
}

async function getMetadataById(metadataId) {
  const wanted = normalizeId(metadataId);
  const { rows } = await pool.query(
    `SELECT full_record FROM metadata_groups WHERE LOWER(metadata_id) = $1`,
    [wanted]
  );
  return rows.length ? rows[0].full_record : null;
}

async function getMetadataExcelPath(metadataId) {
  const wanted = normalizeId(metadataId);
  const { rows } = await pool.query(
    `SELECT metadata_excel FROM metadata_groups WHERE LOWER(metadata_id) = $1`,
    [wanted]
  );
  if (!rows.length || !rows[0].metadata_excel) return null;
  return path.join(METADATA_DIR, rows[0].metadata_excel);
}

// warmCache kept for API compatibility — PostgreSQL has its own connection pool
async function warmCache() {
  await pool.query("SELECT 1");
  const { rows } = await pool.query("SELECT COUNT(*) FROM datasets");
  console.log(`PostgreSQL ready: ${rows[0].count} datasets loaded`);
}

module.exports = {
  warmCache,
  getTableSummaries,
  getTableById,
  getAllMetadata,
  getMetadataById,
  getMetadataExcelPath,
};
