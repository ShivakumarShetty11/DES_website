const { Storage } = require("@google-cloud/storage");

const storage = new Storage();

function parseGcsUrl(gsUrl) {
  const match = gsUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid GCS URL: ${gsUrl}`);
  return { bucket: match[1], object: match[2] };
}

function streamGcsFile(gsUrl, res) {
  const { bucket, object } = parseGcsUrl(gsUrl);
  const filename = object.split("/").pop();
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  storage.bucket(bucket).file(object).createReadStream()
    .on("error", (err) => {
      if (!res.headersSent) res.status(500).json({ message: "Failed to download file from storage" });
      console.error("GCS stream error:", err);
    })
    .pipe(res);
}

module.exports = { streamGcsFile };
