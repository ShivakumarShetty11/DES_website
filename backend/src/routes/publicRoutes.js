const express = require("express");
const { getTableSummaries } = require("../services/tableRepository");

const router = express.Router();

function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  return `${proto}://${req.get("host")}`;
}

router.get("/robots.txt", (req, res) => {
  const base = baseUrl(req);
  res.type("text/plain").send(
    `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`
  );
});

router.get("/sitemap.xml", async (req, res, next) => {
  try {
    const base = baseUrl(req);
    const urls = ["/", "/data", "/llms.txt"]
      .map((p) => `  <url><loc>${base}${p}</loc><changefreq>monthly</changefreq></url>`)
      .join("\n");
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    );
  } catch (error) {
    next(error);
  }
});

router.get("/llms.txt", async (req, res, next) => {
  try {
    const base = baseUrl(req);
    const datasets = await getTableSummaries();

    const datasetLines = datasets.map((d) => {
      const lines = [
        `- [${d.table_id} — ${d.title}](${base}/api/tables/${encodeURIComponent(d.dataset_id)}): ${d.description || "No description available."}`,
        `  - Geography: ${d.geography || "N/A"}`,
        `  - Frequency: ${d.frequency || "N/A"}`,
        `  - Time Period: ${d.time_period || "N/A"}`,
        `  - Category: ${d.category || "N/A"}`,
        `  - Source: ${d.data_source || "N/A"}`
      ];
      return lines.join("\n");
    });

    const text = [
      `# DES Data Catalog — Delhi Vital Statistics`,
      ``,
      `> Open vital statistics data for the National Capital Territory (NCT) of Delhi,`,
      `> published by the Directorate of Economics & Statistics (DES), Government of NCT of Delhi.`,
      ``,
      `## Datasets`,
      ``,
      datasetLines.join("\n\n"),
      ``,
      `## API`,
      ``,
      `All datasets and metadata are queryable via REST API. Responses include full row-level data.`,
      ``,
      `- \`GET ${base}/api\` — API index with all endpoints and dataset list`,
      `- \`GET ${base}/api/tables\` — list all datasets with titles and metadata`,
      `- \`GET ${base}/api/tables/:id\` — full dataset with all data rows (JSON)`,
      `- \`GET ${base}/api/metadata\` — all metadata records (descriptions, classifications, key statistics, source info)`,
      `- \`GET ${base}/api/metadata/:metadataId\` — full metadata for a specific group`,
      `- \`GET ${base}/api/metadata/:metadataId/download\` — download metadata Excel file`,
      ``,
      `## Data Page`,
      ``,
      `Human and machine readable summary of all datasets: ${base}/data`,
      ``
    ].join("\n");

    res.type("text/plain").send(text);
  } catch (error) {
    next(error);
  }
});

router.get("/data", async (req, res, next) => {
  try {
    const base = baseUrl(req);
    const datasets = await getTableSummaries();

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "DataCatalog",
      "name": "DES Data Catalog — Delhi Vital Statistics",
      "description": "Open vital statistics data for the National Capital Territory (NCT) of Delhi, published by the Directorate of Economics & Statistics (DES), Government of NCT of Delhi.",
      "url": `${base}/data`,
      "publisher": {
        "@type": "GovernmentOrganization",
        "name": "Directorate of Economics & Statistics, Government of NCT of Delhi"
      },
      "dataset": datasets.map((d) => ({
        "@type": "Dataset",
        "name": d.title,
        "description": d.description || d.title,
        "identifier": d.dataset_id,
        "keywords": [d.category, d.geography, "vital statistics", "Delhi", d.frequency].filter(Boolean),
        "spatialCoverage": d.geography,
        "temporalCoverage": d.time_period,
        "measurementTechnique": d.data_source,
        "distribution": {
          "@type": "DataDownload",
          "contentUrl": `${base}/api/tables/${encodeURIComponent(d.dataset_id)}`,
          "encodingFormat": "application/json"
        }
      }))
    };

    const datasetCards = datasets.map((d) => `
      <article>
        <h2>${esc(d.table_id)} — ${esc(d.title)}</h2>
        <table>
          <tr><th>Dataset ID</th><td>${esc(d.dataset_id)}</td></tr>
          <tr><th>Category</th><td>${esc(d.category || "N/A")}</td></tr>
          <tr><th>Geography</th><td>${esc(d.geography || "N/A")}</td></tr>
          <tr><th>Frequency</th><td>${esc(d.frequency || "N/A")}</td></tr>
          <tr><th>Time Period</th><td>${esc(d.time_period || "N/A")}</td></tr>
          <tr><th>Source</th><td>${esc(d.data_source || "N/A")}</td></tr>
          ${d.description ? `<tr><th>Description</th><td>${esc(d.description)}</td></tr>` : ""}
        </table>
        <p><a href="${base}/api/tables/${encodeURIComponent(d.dataset_id)}">Download JSON</a></p>
      </article>`
    ).join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DES Data Catalog — All Datasets</title>
  <meta name="description" content="Open vital statistics data for the National Capital Territory (NCT) of Delhi. Infant mortality, maternal mortality, still birth, and cause-of-death datasets published by DES, Government of NCT of Delhi." />
  <script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1f2a3a; line-height: 1.6; }
    h1 { font-size: 1.8rem; border-bottom: 2px solid #0f5f7a; padding-bottom: 12px; }
    h2 { font-size: 1.1rem; color: #0f5f7a; margin-top: 2rem; }
    article { border: 1px solid #d4ddea; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th { text-align: left; padding: 6px 12px; background: #f4f7fb; width: 140px; font-weight: 600; }
    td { padding: 6px 12px; border-top: 1px solid #eee; }
    a { color: #0f5f7a; }
    .meta { color: #5d6b7f; font-size: 0.9rem; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <h1>DES Data Catalog — Delhi Vital Statistics</h1>
  <p class="meta">
    Open vital statistics for the National Capital Territory (NCT) of Delhi.<br/>
    Published by the Directorate of Economics &amp; Statistics (DES), Government of NCT of Delhi.<br/>
    <a href="${base}/llms.txt">llms.txt</a> &nbsp;|&nbsp;
    <a href="${base}/api/tables">JSON API</a> &nbsp;|&nbsp;
    <a href="${base}/">Interactive Catalog</a>
  </p>
  ${datasetCards}
</body>
</html>`;

    res.type("text/html").send(html);
  } catch (error) {
    next(error);
  }
});

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = router;
