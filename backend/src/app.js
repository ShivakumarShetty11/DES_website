const express = require("express");
const cors = require("cors");
const path = require("path");
const tableRoutes = require("./routes/tableRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok"
  });
});

app.use("/api", tableRoutes);

app.use(express.static(path.join(__dirname, "..", "..", "frontend", "public")));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: "Unexpected server error"
  });
});

module.exports = app;
