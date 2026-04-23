# DES Catalog Website

Scalable structure with separate backend and frontend.

## Directory Structure

```text
DES_website/
	backend/
		data/
			metadata/
				delhi-medical-cause-2024.json
				still-birth-2024.json
			tables/
				t-01.json
		src/
			routes/
			services/
			app.js
			server.js
		package.json
	frontend/
		public/
			index.html
			styles.css
			app.js
	Still_Birth Rates_Meta_Data_File v1.xlsx
	Screenshot 2026-04-17 221405.png
```

## Backend

- API base: `http://localhost:4000/api`
- Endpoints:
	- `GET /api/health`
	- `GET /api/tables`
	- `GET /api/tables/:datasetId`
- Tables are loaded from JSON files in `backend/data/tables/`.
- Shared workbook metadata is stored once in `backend/data/metadata/` and linked from table JSON files with `metadata_id`.
- Shared metadata records exist for both the still birth tables and the medical cause tables.
- To add a new table, add one new JSON file in `backend/data/tables/` with the same schema and point it at an existing `metadata_id` when applicable.

## Frontend

- Located in `frontend/public/`
- No hardcoded dataset file path.
- Loads dataset list from backend and lets user select any dataset.
- Supports accordion panels and JSON/CSV/Excel downloads.

## Run Locally

### 1) Start backend

```powershell
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:4000`.

### 2) Start frontend (static server)

In a new terminal:

```powershell
cd frontend/public
c:/Users/SHIVA KUMAR/Documents/internship/DES_website/.venv/Scripts/python.exe -m http.server 5500
```

Open `http://localhost:5500/`.
