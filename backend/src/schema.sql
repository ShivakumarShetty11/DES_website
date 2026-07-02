-- DES Data Catalog — PostgreSQL Schema
-- Run once to initialise the database

CREATE TABLE IF NOT EXISTS metadata_groups (
  metadata_id        TEXT PRIMARY KEY,
  title              TEXT,
  description        TEXT,
  product            TEXT,
  category           TEXT,
  geography          TEXT,
  frequency          TEXT,
  time_period        TEXT,
  data_source        TEXT,
  last_updated_date  TEXT,
  future_release     TEXT,
  key_statistics     TEXT,
  remarks            TEXT,
  metadata_excel     TEXT,
  table_ids          TEXT[],
  classifications    JSONB,
  concepts           TEXT[],
  full_record        JSONB  -- full original JSON for completeness
);

CREATE TABLE IF NOT EXISTS datasets (
  dataset_id         TEXT PRIMARY KEY,
  unique_dataset_id  TEXT,
  table_id           TEXT,
  metadata_id        TEXT REFERENCES metadata_groups(metadata_id),
  title              TEXT,
  short_description  TEXT,
  long_description   TEXT,
  category           TEXT,
  geography          TEXT,
  frequency          TEXT,
  time_period        TEXT,
  data_source        TEXT,
  units              TEXT,
  classifications    JSONB,
  concepts           TEXT[],
  age_column_keys    JSONB
);

CREATE TABLE IF NOT EXISTS dataset_rows (
  id          SERIAL PRIMARY KEY,
  dataset_id  TEXT NOT NULL REFERENCES datasets(dataset_id) ON DELETE CASCADE,
  sl_no       TEXT,
  row_index   INTEGER,
  row_data    JSONB NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON dataset_rows(dataset_id);
CREATE INDEX IF NOT EXISTS idx_datasets_metadata_id    ON datasets(metadata_id);
CREATE INDEX IF NOT EXISTS idx_datasets_category       ON datasets(category);

-- Full-text search index on dataset title + description
CREATE INDEX IF NOT EXISTS idx_datasets_fts ON datasets
  USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(short_description,'')));

-- JSONB index on row_data for fast field queries
CREATE INDEX IF NOT EXISTS idx_dataset_rows_jsonb ON dataset_rows USING GIN (row_data);
