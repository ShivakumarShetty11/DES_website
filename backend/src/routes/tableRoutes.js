const express = require("express");
const {
  getTableSummaries,
  getTableById
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

module.exports = router;
