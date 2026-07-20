const { Storage } = require("@google-cloud/storage");

const storage = new Storage();

async function signGcsUrl(gsUrl) {
  const match = gsUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid GCS URL: ${gsUrl}`);
  const [, bucket, object] = match;

  const [url] = await storage
    .bucket(bucket)
    .file(object)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });

  return url;
}

module.exports = { signGcsUrl };
