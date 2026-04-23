const API_BASE = "http://localhost:4000/api";

const elements = {
  datasetStream: document.getElementById("datasetStream"),
  queryInput: document.getElementById("queryInput"),
  clearQueryBtn: document.getElementById("clearQueryBtn"),
  queryResult: document.getElementById("queryResult")
};

const state = {
  datasetsByKey: new Map(),
  allResults: [],
  query: ""
};

init();

async function init() {
  try {
    const summariesPayload = await fetchJson(`${API_BASE}/tables`);
    const summaries = summariesPayload.tables || [];

    if (summaries.length === 0) {
      elements.datasetStream.innerHTML = '<article class="card error-card"><h2>No datasets found</h2></article>';
      return;
    }

    const details = await Promise.all(
      summaries.map(async (summary) => {
        const datasetId = summary.dataset_id;
        try {
          const data = await fetchJson(`${API_BASE}/tables/${encodeURIComponent(datasetId)}`);
          return { ok: true, data };
        } catch (error) {
          return { ok: false, datasetId, error };
        }
      })
    );

    state.allResults = details;
    applyFiltersAndRender();
    attachQueryHandlers();
  } catch (error) {
    elements.datasetStream.innerHTML = `<article class="card error-card"><h2>Unable to load datasets</h2><p>${escapeHtml(error.message)}</p></article>`;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function renderDatasets(results) {
  state.datasetsByKey.clear();

  elements.datasetStream.innerHTML = results
    .map((result) => {
      if (!result.ok) {
        return `<article class="card error-card"><h2>Dataset ${escapeHtml(result.datasetId)}</h2><p>${escapeHtml(result.error.message)}</p></article>`;
      }

      const key = getDatasetKey(result.data.dataset.dataset_id);
      state.datasetsByKey.set(key, result.data);
      return renderDatasetRow(result.data, key, state.query);
    })
    .join("");
}

function renderDatasetRow(data, key, query) {
  const allRows = data?.table?.rows || [];
  const { dataset, classifications, concepts } = data;

  return `
    <section class="dataset-row" data-dataset-key="${key}">
      <article class="card main-card">
        <div class="dataset-id-header">
          <span class="kicker">Dataset ID</span>
          <strong class="dataset-id-badge">${escapeHtml(dataset.unique_dataset_id || dataset.dataset_id)}</strong>
        </div>
        <h2>${escapeHtml(dataset.title || "Untitled Dataset")}</h2>

        <div class="stats-grid">
          ${renderStat("Rows", allRows.length, `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`)}
          ${renderStat("Geography", dataset.geography || "N/A", `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`)}
          ${renderStat("Frequency", dataset.frequency || "N/A", `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`)}
          ${renderStat("Source", dataset.data_source || "N/A", `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>`)}
        </div>

        <div class="action-row">
          <button class="btn btn-secondary panel-btn" data-dataset-key="${key}" data-view="catalog" aria-pressed="false">Meta Data Summary</button>
          <button class="btn btn-primary panel-btn" data-dataset-key="${key}" data-view="download" aria-pressed="false">Download Dataset</button>
        </div>

        <section class="inline-panel" id="panel-${key}">
          <div class="panel-empty is-open" data-empty>
            <h3>Details Panel</h3>
            <p>Use the buttons above to open details here.</p>
          </div>

          <section class="panel-view" data-view="catalog">
            <h3>Meta Data Summary</h3>
            <dl>${renderCatalog(data)}</dl>
          </section>

          <section class="panel-view" data-view="download">
            <h3>Download Dataset</h3>
            <p class="muted">Choose format to export this dataset.</p>
            <div class="download-row">
              <button class="btn btn-secondary download-json" data-dataset-key="${key}">Download JSON</button>
              <button class="btn btn-primary download-csv" data-dataset-key="${key}">Download CSV</button>
              <button class="btn btn-secondary download-xlsx" data-dataset-key="${key}">Download Excel</button>
            </div>
          </section>
        </section>
      </article>
    </section>
  `;
}

function attachEventHandlers() {
  document.querySelectorAll(".panel-btn").forEach((button) => {
    button.addEventListener("click", onPanelButtonClick);
  });

  document.querySelectorAll(".download-json").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.datasetKey;
      const data = state.datasetsByKey.get(key);
      if (!data) {
        return;
      }
      downloadBlob(JSON.stringify(data, null, 2), `${data.dataset.unique_dataset_id || data.dataset.dataset_id}.json`, "application/json");
    });
  });

  document.querySelectorAll(".download-csv").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.datasetKey;
      const data = state.datasetsByKey.get(key);
      if (!data) {
        return;
      }
      const csv = generateCsv(data.table.rows || []);
      downloadBlob(csv, `${data.dataset.unique_dataset_id || data.dataset.dataset_id}.csv`, "text/csv");
    });
  });

  document.querySelectorAll(".download-xlsx").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.datasetKey;
      const data = state.datasetsByKey.get(key);
      if (!data) {
        return;
      }
      downloadExcel(data.table.rows || [], data);
    });
  });

}

function attachQueryHandlers() {
  elements.queryInput.addEventListener("input", onFiltersChanged);
  elements.clearQueryBtn.addEventListener("click", onClearFilters);
}

function onFiltersChanged() {
  state.query = (elements.queryInput.value || "").trim();

  applyFiltersAndRender();
}

function onClearFilters() {
  elements.queryInput.value = "";
  state.query = "";
  onFiltersChanged();
}

function applyFiltersAndRender() {
  const query = state.query.trim().toLowerCase();
  const filtered = state.allResults.filter((result) => matchesKeyword(result, query));

  if (filtered.length === 0) {
    elements.datasetStream.innerHTML =
      '<article class="card error-card"><h2>No matching datasets</h2><p>Try broadening your search or clearing filters.</p></article>';
    if (elements.queryResult) {
      elements.queryResult.textContent = "0 datasets match current query";
    }
    return;
  }

  renderDatasets(filtered);
  attachEventHandlers();

  if (elements.queryResult) {
    elements.queryResult.textContent = `${filtered.length} dataset(s) match current query`;
  }
}

function matchesKeyword(result, query) {
  if (!result.ok) {
    return true;
  }

  if (!query) {
    return true;
  }

  const datasetText = buildDatasetSearchText(result.data);
  const hasDatasetMatch = datasetText.includes(query);
  const hasTableMatch = (result.data?.table?.rows || []).some((row) => rowMatchesQuery(row, query));
  return hasDatasetMatch || hasTableMatch;
}

function buildDatasetSearchText(data) {
  const dataset = data?.dataset || {};
  return [
    dataset.dataset_id,
    dataset.table_id,
    dataset.title,
    dataset.short_description,
    dataset.long_description,
    dataset.product,
    dataset.category,
    dataset.geography,
    dataset.frequency,
    dataset.time_period,
    dataset.data_source
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function rowMatchesQuery(row, queryText) {
  const query = String(queryText || "").toLowerCase();
  if (!query) {
    return true;
  }
  return flattenValueForSearch(row).includes(query);
}

function flattenValueForSearch(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }

  if (Array.isArray(value)) {
    return value.map((item) => flattenValueForSearch(item)).join(" ");
  }

  if (typeof value === "object") {
    return Object.values(value)
      .map((item) => flattenValueForSearch(item))
      .join(" ");
  }

  return "";
}

function onPanelButtonClick(event) {
  const button = event.currentTarget;
  const key = button.dataset.datasetKey;
  const selectedView = button.dataset.view;
  const row = document.querySelector(`.dataset-row[data-dataset-key="${key}"]`);
  if (!row) {
    return;
  }

  const panel = row.querySelector(".inline-panel");
  const empty = panel.querySelector("[data-empty]");
  const allViews = panel.querySelectorAll(".panel-view");
  const target = panel.querySelector(`.panel-view[data-view="${selectedView}"]`);
  const isAlreadyOpen = target.classList.contains("is-open");

  allViews.forEach((view) => view.classList.remove("is-open"));
  row.querySelectorAll(".panel-btn").forEach((btn) => btn.setAttribute("aria-pressed", "false"));

  if (isAlreadyOpen) {
    empty.classList.add("is-open");
    return;
  }

  empty.classList.remove("is-open");
  target.classList.add("is-open");
  button.setAttribute("aria-pressed", "true");
}

function renderCatalog(data) {
  const dataset = data?.dataset || {};
  const catalog = data?.metadata?.catalog_metadata_tab || {};

  const pairs = [
    ["Product", catalog.product || dataset.product],
    ["Category", catalog.category || dataset.category],
    ["Geography", catalog.geography || dataset.geography],
    ["Frequency", catalog.frequency || dataset.frequency],
    ["Time Period", catalog.time_period || dataset.time_period],
    ["Source", catalog.data_source || dataset.data_source],
    ["Description", catalog.description || data?.metadata?.description],
    ["Last Updated", catalog.last_updated_date || dataset.last_updated_date],
    ["Future Release", catalog.future_release || data?.metadata?.future_release],
    ["Key Statistics", catalog.key_statistics || data?.metadata?.key_statistics],
    ["Remarks", catalog.remarks || data?.metadata?.remarks]
  ];

  return pairs
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value || "Not Available"))}</dd></div>`)
    .join("");
}

function renderClassification(classifications) {
  return Object.entries(classifications || {})
    .map(([key, values]) => {
      const heading = key
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      const text = Array.isArray(values) ? values.join(", ") : String(values || "");
      return `<li><strong>${escapeHtml(heading)}:</strong> ${escapeHtml(text)}</li>`;
    })
    .join("");
}

function renderStat(label, value, icon = "") {
  return `
    <article class="stat">
      ${icon ? `<div class="stat-icon">${icon}</div>` : ""}
      <div class="stat-text">
        <p>${escapeHtml(String(label))}</p>
        <strong>${escapeHtml(String(value))}</strong>
      </div>
    </article>`;
}

function getDatasetKey(datasetId) {
  return String(datasetId || "dataset")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function flattenRow(row) {
  const record = { sl_no: row.sl_no, district: row.district, row_type: row.row_type };
  Object.entries(row).forEach(([key, value]) => {
    if (key === "sl_no" || key === "district" || key === "row_type") return;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.entries(value).forEach(([sub, v]) => {
        record[`${key}_${sub}`] = v ?? "";
      });
    }
  });
  return record;
}

function generateCsv(rows) {
  const flatRows = rows.map(flattenRow);
  if (flatRows.length === 0) return "";

  const header = Object.keys(flatRows[0]);
  const lines = flatRows.map((row) => header.map((col) => row[col] ?? ""));

  return [header, ...lines]
    .map((line) =>
      line
        .map((cell) => {
          const text = String(cell ?? "");
          if (text.includes(",") || text.includes('"')) {
            return `"${text.replaceAll('"', '""')}"`;
          }
          return text;
        })
        .join(",")
    )
    .join("\n");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadExcel(rows, data) {
  if (!window.XLSX) {
    window.alert("Excel export library failed to load. Please refresh and try again.");
    return;
  }

  const exportRows = rows.map(flattenRow);

  const worksheet = window.XLSX.utils.json_to_sheet(exportRows);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "Table_Data");
  window.XLSX.writeFile(workbook, `${data.dataset.unique_dataset_id || data.dataset.dataset_id}.xlsx`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
