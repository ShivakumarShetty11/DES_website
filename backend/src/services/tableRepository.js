const fs = require("fs/promises");
const path = require("path");

const TABLES_DIR = path.join(__dirname, "..", "..", "data", "tables");
const METADATA_DIR = path.join(__dirname, "..", "..", "data", "metadata");

async function listTableFiles() {
  const entries = await fs.readdir(TABLES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(TABLES_DIR, entry.name));
}

async function readTableFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function listMetadataFiles() {
  try {
    const entries = await fs.readdir(METADATA_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => path.join(METADATA_DIR, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readMetadataFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function getAllTables() {
  const files = await listTableFiles();
  const records = await Promise.all(files.map((file) => readTableFile(file)));
  return records.sort((a, b) => {
    const left = normalizeId(a?.dataset?.dataset_id);
    const right = normalizeId(b?.dataset?.dataset_id);
    return left.localeCompare(right);
  });
}

async function getAllMetadata() {
  const files = await listMetadataFiles();
  const records = await Promise.all(files.map((file) => readMetadataFile(file)));
  return records;
}

async function getMetadataMap() {
  const metadataRecords = await getAllMetadata();
  return new Map(
    metadataRecords
      .map((record) => [normalizeId(record?.metadata?.metadata_id), record])
      .filter(([metadataId]) => Boolean(metadataId))
  );
}

function mergeTableWithMetadata(record, metadataRecord) {
  const sharedMetadata = metadataRecord?.metadata || {};
  const sharedClassifications = metadataRecord?.classifications || {};
  const sharedConcepts = metadataRecord?.concepts || [];

  return {
    ...record,
    metadata: sharedMetadata,
    classifications: {
      ...(sharedClassifications || {}),
      ...(record?.classifications || {})
    },
    concepts: Array.from(new Set([...(sharedConcepts || []), ...(record?.concepts || [])])),
    dataset: {
      ...(sharedMetadata || {}),
      ...(record?.dataset || {}),
      metadata_id: record?.dataset?.metadata_id || sharedMetadata?.metadata_id || null
    }
  };
}

async function getAllTablesWithMetadata() {
  const tables = await getAllTables();
  const metadataMap = await getMetadataMap();

  return tables.map((record) => {
    const metadataId = normalizeId(record?.dataset?.metadata_id);
    const metadataRecord = metadataMap.get(metadataId) || null;
    return metadataRecord ? mergeTableWithMetadata(record, metadataRecord) : record;
  });
}

async function getTableSummaries() {
  const tables = await getAllTablesWithMetadata();
  return tables.map((record) => ({
    dataset_id: record?.dataset?.dataset_id,
    table_id: record?.dataset?.table_id,
    title: record?.dataset?.title,
    description: record?.metadata?.description || record?.dataset?.description || null,
    category: record?.dataset?.category,
    geography: record?.dataset?.geography,
    frequency: record?.dataset?.frequency,
    time_period: record?.dataset?.time_period || null,
    data_source: record?.dataset?.data_source || null,
    metadata_id: record?.dataset?.metadata_id,
    metadata_title: record?.metadata?.title || null
  }));
}

async function getTableById(datasetId) {
  const wanted = normalizeId(datasetId);
  const tables = await getAllTablesWithMetadata();
  return (
    tables.find((record) => normalizeId(record?.dataset?.dataset_id) === wanted) || null
  );
}

async function getMetadataExcelPath(metadataId) {
  const metadataMap = await getMetadataMap();
  const record = metadataMap.get(normalizeId(metadataId));
  const filename = record?.metadata?.metadata_excel;
  if (!filename) return null;
  return path.join(METADATA_DIR, filename);
}

module.exports = {
  getTableSummaries,
  getTableById,
  getMetadataExcelPath
};
