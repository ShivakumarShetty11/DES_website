const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const {
  getTableSummaries,
  getTableById,
  getAllMetadata,
  getMetadataById,
} = require("./services/tableRepository");

function buildMcpServer() {
  const server = new McpServer({
    name: "des-data-catalog",
    version: "1.0.0",
  });

  server.tool(
    "list_datasets",
    "List all available datasets published by the Directorate of Economics & Statistics (DES), Government of NCT of Delhi. " +
      "Covers vital statistics including infant deaths, maternal mortality, still births, and death by cause. " +
      "Returns dataset IDs, titles, categories, geography, frequency, and descriptions. Call this first to discover what data is available.",
    {},
    async () => {
      const tables = await getTableSummaries();
      return { content: [{ type: "text", text: JSON.stringify(tables, null, 2) }] };
    }
  );

  server.tool(
    "get_dataset",
    "Fetch the full data rows for a specific DES Delhi dataset by its dataset_id (e.g. 'D-10', 'D-11', 'S1-URBAN'). " +
      "Use list_datasets first to get valid IDs. Use the limit parameter to avoid large responses — " +
      "start with limit=20 to preview structure, then fetch more if needed.",
    {
      dataset_id: z.string().describe("Dataset ID from list_datasets, e.g. 'D-10' or 'S1-URBAN'"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("Max rows to return. Omit for all rows."),
    },
    async ({ dataset_id, limit }) => {
      const table = await getTableById(dataset_id);
      if (!table) {
        return {
          content: [{ type: "text", text: `Dataset not found: ${dataset_id}. Use list_datasets to see valid IDs.` }],
          isError: true,
        };
      }
      let result = table;
      if (limit && table.table?.rows) {
        const totalRows = table.table.rows.length;
        result = {
          ...table,
          table: {
            ...table.table,
            rows: table.table.rows.slice(0, limit),
            _pagination: { showing: Math.min(limit, totalRows), total: totalRows },
          },
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search_datasets",
    "Search DES Delhi datasets by keyword in title, description, or category. " +
      "Useful for finding relevant datasets before calling get_dataset. " +
      "Try keywords like 'infant', 'maternal', 'still birth', 'cause of death', 'urban', 'rural'.",
    {
      query: z.string().describe("Search keyword, e.g. 'infant mortality' or 'maternal death'"),
    },
    async ({ query }) => {
      const tables = await getTableSummaries();
      const q = query.toLowerCase();
      const matches = tables.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q)
      );
      const message =
        matches.length === 0
          ? `No datasets matched "${query}". Try list_datasets to see all available datasets.`
          : JSON.stringify(matches, null, 2);
      return { content: [{ type: "text", text: message }] };
    }
  );

  server.tool(
    "list_metadata",
    "List all metadata groups for the DES Delhi vital statistics catalog. " +
      "Returns metadata IDs, titles, descriptions, time periods, and key statistics. " +
      "Use get_metadata with a metadata_id for full details including classifications and concepts.",
    {},
    async () => {
      const records = await getAllMetadata();
      const summaries = records.map((r) => ({
        metadata_id: r?.metadata?.metadata_id,
        title: r?.metadata?.title,
        description: r?.metadata?.description,
        category: r?.metadata?.category,
        geography: r?.metadata?.geography,
        time_period: r?.metadata?.time_period,
        key_statistics: r?.metadata?.key_statistics,
        table_ids: r?.metadata?.table_ids || [],
      }));
      return { content: [{ type: "text", text: JSON.stringify(summaries, null, 2) }] };
    }
  );

  server.tool(
    "get_metadata",
    "Get detailed metadata for a specific metadata group by its metadata_id " +
      "(e.g. 'DELHI-DEATH-CAUSE-2024', 'DELHI-MEDICAL-CAUSE-2024', 'STILL-BIRTH-2024'). " +
      "Includes classifications, concepts, dataset inventory, and source information. " +
      "Use list_metadata first to find valid metadata IDs.",
    {
      metadata_id: z.string().describe("Metadata group ID from list_metadata, e.g. 'DELHI-DEATH-CAUSE-2024'"),
    },
    async ({ metadata_id }) => {
      const record = await getMetadataById(metadata_id);
      if (!record) {
        return {
          content: [{ type: "text", text: `Metadata not found: ${metadata_id}. Use list_metadata to see valid IDs.` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(record, null, 2) }] };
    }
  );

  return server;
}

function createMcpRouter() {
  const router = express.Router();

  // Stateless Streamable HTTP transport — each POST is an independent MCP session
  router.post("/", async (req, res) => {
    try {
      const server = buildMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request error:", err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal MCP error" } });
      }
    }
  });

  router.get("/", (_req, res) => {
    res.json({
      name: "DES Data Catalog MCP Server",
      transport: "Streamable HTTP (stateless)",
      endpoint: "POST /mcp",
      tools: ["list_datasets", "get_dataset", "search_datasets", "list_metadata", "get_metadata"],
    });
  });

  return router;
}

module.exports = { createMcpRouter };
