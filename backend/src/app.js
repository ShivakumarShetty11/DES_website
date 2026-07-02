const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");
const tableRoutes = require("./routes/tableRoutes");
const publicRoutes = require("./routes/publicRoutes");
const { createMcpRouter } = require("./mcp");

const app = express();

app.set("trust proxy", 1);

app.use(compression());
app.use(cors());
app.use(express.json());

// Tell browsers and CDNs to cache API responses for 5 minutes
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok"
  });
});

const apiLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true });
const mcpLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true });

app.use("/api", apiLimiter, tableRoutes);
app.use("/mcp", mcpLimiter, createMcpRouter());
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
