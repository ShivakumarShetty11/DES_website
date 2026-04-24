const express = require("express");
const path = require("path");
const {
  getTableSummaries,
  getTableById,
  getAllMetadata,
  getMetadataById,
  getMetadataExcelPath
} = require("../services/tableRepository");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const base = `${proto}://${req.get("host")}`;
    const tables = await getTableSummaries();
    res.json({
      name: "DES Data Catalog API",
      description: "Vital statistics data for the National Capital Territory (NCT) of Delhi. Published by the Directorate of Economics & Statistics (DES), Government of NCT of Delhi.",
      documentation: `${base}/llms.txt`,
      data_page: `${base}/data`,
      endpoints: {
        list_datasets: {
          method: "GET",
          url: `${base}/api/tables`,
          description: "Returns all datasets with title, category, geography, frequency and description"
        },
        get_dataset: {
          method: "GET",
          url: `${base}/api/tables/:dataset_id`,
          description: "Returns full dataset including all data rows. Replace :dataset_id with any dataset_id from the list above.",
          example: `${base}/api/tables/${tables[0]?.dataset_id || "T-01"}`
        },
        list_metadata: {
          method: "GET",
          url: `${base}/api/metadata`,
          description: "Returns all metadata records — descriptions, classifications, key statistics, dataset inventory, and source information"
        },
        get_metadata: {
          method: "GET",
          url: `${base}/api/metadata/:metadata_id`,
          description: "Returns full metadata for a given metadata group including classifications, concepts, and dataset inventory list",
          example: `${base}/api/metadata/DELHI-MEDICAL-CAUSE-2024`
        },
        download_metadata_excel: {
          method: "GET",
          url: `${base}/api/metadata/:metadata_id/download`,
          description: "Downloads the Excel metadata file for a given metadata group"
        }
      },
      available_datasets: tables.map((t) => ({
        dataset_id: t.dataset_id,
        table_id: t.table_id,
        title: t.title,
        category: t.category,
        geography: t.geography,
        frequency: t.frequency,
        url: `${base}/api/tables/${encodeURIComponent(t.dataset_id)}`
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get("/tables", async (_req, res, next) => {
  try {
    const tables = await getTableSummaries();
    res.json({
      count: tables.length,
      tables
    });
  } catch (error) {
    next(error);
  }
});

router.get("/tables/:datasetId", async (req, res, next) => {
  try {
    const table = await getTableById(req.params.datasetId);
    if (!table) {
      res.status(404).json({
        message: `Dataset not found: ${req.params.datasetId}`
      });
      return;
    }
    res.json(table);
  } catch (error) {
    next(error);
  }
});

router.get("/metadata", async (_req, res, next) => {
  try {
    const records = await getAllMetadata();
    res.json({
      count: records.length,
      metadata: records.map((r) => ({
        metadata_id: r?.metadata?.metadata_id,
        title: r?.metadata?.title,
        product: r?.metadata?.product,
        description: r?.metadata?.description,
        category: r?.metadata?.category,
        geography: r?.metadata?.geography,
        frequency: r?.metadata?.frequency,
        time_period: r?.metadata?.time_period,
        data_source: r?.metadata?.data_source,
        last_updated_date: r?.metadata?.last_updated_date,
        future_release: r?.metadata?.future_release,
        key_statistics: r?.metadata?.key_statistics,
        remarks: r?.metadata?.remarks,
        table_ids: r?.metadata?.table_ids || [],
        classifications: r?.classifications || {},
        concepts: r?.concepts || []
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get("/metadata/:metadataId", async (req, res, next) => {
  try {
    const record = await getMetadataById(req.params.metadataId);
    if (!record) {
      res.status(404).json({ message: `Metadata not found: ${req.params.metadataId}` });
      return;
    }
    res.json(record);
  } catch (error) {
    next(error);
  }
});

router.get("/metadata/:metadataId/download", async (req, res, next) => {
  try {
    const filePath = await getMetadataExcelPath(req.params.metadataId);
    if (!filePath) {
      res.status(404).json({ message: `No metadata file for: ${req.params.metadataId}` });
      return;
    }
    const filename = path.basename(filePath);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
