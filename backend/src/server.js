require("dotenv").config();
const app = require("./app");
const { warmCache } = require("./services/tableRepository");

const PORT = process.env.PORT || 4000;

warmCache()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`DES backend API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to warm cache on startup:", err);
    process.exit(1);
  });
