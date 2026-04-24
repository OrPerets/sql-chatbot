import fs from "fs/promises";
import path from "path";

async function pruneNextImageCache() {
  const cacheDir = path.join(process.cwd(), ".next", "cache", "images");

  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
    console.log(`Pruned Next image cache directory: ${cacheDir}`);
  } catch (error) {
    console.error(`Failed to prune image cache at ${cacheDir}:`, error);
    process.exit(1);
  }
}

pruneNextImageCache();
