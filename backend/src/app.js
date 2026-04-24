const express = require("express");
const cors = require("cors");
const path = require("path");
const tableRoutes = require("./routes/tableRoutes");
const publicRoutes = require("./routes/publicRoutes");

const app = express();

app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok"
  });
});

app.use("/api", tableRoutes);
app.use("/", publicRoutes);

app.use(express.static(path.join(__dirname, "..", "..", "frontend", "public"), {
  setHeaders(res) {
    res.setHeader("Link", '</api>; rel="api", </llms.txt>; rel="describedby"');
  }
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: "Unexpected server error"
  });
});

module.exports = app;
