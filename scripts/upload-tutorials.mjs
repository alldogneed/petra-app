// scripts/upload-tutorials.mjs
// Usage: BLOB_READ_WRITE_TOKEN=... node scripts/upload-tutorials.mjs
// (or `node --env-file=.env.local scripts/upload-tutorials.mjs`). Never commit the token.
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) {
  console.error("Missing BLOB_READ_WRITE_TOKEN — set it in the environment before running this script.");
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, "..", "my-video", "out");

async function uploadVideos() {
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".mp4"));

  if (files.length === 0) {
    console.log("No MP4 files found in my-video/out/");
    return;
  }

  console.log(`Found ${files.length} video(s) to upload:\n`);
  const results = [];

  for (const file of files) {
    const filePath = path.join(OUT_DIR, file);
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

    console.log(`⬆️  Uploading: ${file} (${sizeMB} MB)...`);

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const blobName = `tutorials/${file}`;

      const blob = await put(blobName, fileBuffer, {
        access: "public",
        token: TOKEN,
        contentType: "video/mp4",
      });

      console.log(`✅ Done: ${blob.url}\n`);
      results.push({ file, url: blob.url, sizeMB });
    } catch (err) {
      console.error(`❌ Failed: ${file}`, err.message);
    }
  }

  console.log("\n=== Upload Summary ===");
  results.forEach(({ file, url }) => {
    console.log(`${file}\n  → ${url}\n`);
  });

  // Output as JSON for easy copy-paste into config
  console.log("\n=== JSON Config (copy into tutorials-config.ts) ===");
  console.log(JSON.stringify(results, null, 2));
}

uploadVideos();
