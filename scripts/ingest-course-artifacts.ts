import fs from "fs";
import path from "path";

import {
  buildChecksum,
  chunkArtifact,
  collectCourseTextArtifacts,
  diffManifest,
  inferDocType,
  IngestionManifestEntry,
  readTextFileSafe,
  validateIngestion,
} from "@/lib/openai/course-ingestion";

type CliArgs = {
  sourceDir: string;
  courseId: string;
  term: string;
  module: string;
  version: string;
  chunkSize: number;
  chunkOverlap: number;
  minChunkCount: number;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const read = (key: string, fallback: string) => {
    const match = args.find((arg) => arg.startsWith(`--${key}=`));
    return match ? match.split("=").slice(1).join("=") : fallback;
  };

  return {
    sourceDir: read("source", "docs"),
    courseId: read("course", "sql-course"),
    term: read("term", "2026-spring"),
    module: read("module", "general"),
    version: read("version", new Date().toISOString().slice(0, 10)),
    chunkSize: Number(read("chunkSize", "1000")),
    chunkOverlap: Number(read("chunkOverlap", "200")),
    minChunkCount: Number(read("minChunkCount", "1")),
  };
}

async function main() {
  const cli = parseArgs();
  const sourceDir = path.resolve(process.cwd(), cli.sourceDir);
  const manifestPath = path.join(sourceDir, ".ingestion-manifest.json");

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  const files = collectCourseTextArtifacts(sourceDir);
  const currentManifest: IngestionManifestEntry[] = files.map((filePath) => {
    const rel = path.relative(process.cwd(), filePath);
    const text = readTextFileSafe(filePath);
    return {
      path: rel,
      checksum: buildChecksum(text),
      updatedAt: new Date().toISOString(),
    };
  });

  const previousManifest: IngestionManifestEntry[] = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : [];

  const manifestDiff = diffManifest(previousManifest, currentManifest);
  const changedSet = new Set(manifestDiff.changed.map((entry) => entry.path));

  let totalChunks = 0;
  const allErrors: string[] = [];

  for (const filePath of files) {
    const relativePath = path.relative(process.cwd(), filePath);
    if (!changedSet.has(relativePath)) {
      continue;
    }

    const content = readTextFileSafe(filePath);
    const chunks = chunkArtifact(
      {
        absolutePath: filePath,
        relativePath,
        courseId: cli.courseId,
        term: cli.term,
        module: cli.module,
        version: cli.version,
        docType: inferDocType(relativePath),
        content,
      },
      cli.chunkSize,
      cli.chunkOverlap
    );

    totalChunks += chunks.length;
    allErrors.push(...validateIngestion(chunks, cli.minChunkCount).map((error) => `${relativePath}:${error}`));

    // Placeholder: upsert chunks into vector store / DB.
    console.log(`[ingest] upsert ${chunks.length} chunks from ${relativePath}`);
  }

  if (manifestDiff.stale.length > 0) {
    for (const stale of manifestDiff.stale) {
      console.log(`[ingest] stale file detected, safe-delete chunks for ${stale.path}`);
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(currentManifest, null, 2));

  console.log(
    JSON.stringify(
      {
        scannedFiles: files.length,
        changedFiles: manifestDiff.changed.length,
        unchangedFiles: manifestDiff.unchanged.length,
        staleFiles: manifestDiff.stale.length,
        totalChunks,
        validationErrors: allErrors,
      },
      null,
      2
    )
  );

  if (allErrors.length) {
    process.exitCode = 2;
  }
}

void main();
