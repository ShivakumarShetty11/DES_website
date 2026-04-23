const express = require("express");
const path = require("path");
const {
  getTableSummaries,
  getTableById,
  getMetadataExcelPath
} = require("../services/tableRepository");

const router = express.Router();

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
