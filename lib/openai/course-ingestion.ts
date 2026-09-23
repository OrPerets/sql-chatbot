import { createHash } from "crypto";
import fs from "fs";
import path from "path";

export type CourseArtifactDocType = "lecture_pdf" | "homework" | "schema_guide" | "solution_explanation" | "other";

export type CourseArtifact = {
  absolutePath: string;
  relativePath: string;
  courseId: string;
  term: string;
  module: string;
  version: string;
  docType: CourseArtifactDocType;
  content: string;
};

export type ChunkedArtifact = {
  id: string;
  text: string;
  metadata: {
    course_id: string;
    term: string;
    doc_type: CourseArtifactDocType;
    module: string;
    version: string;
    source_path: string;
    chunk_index: number;
    checksum: string;
  };
};

export function inferDocType(relativePath: string): CourseArtifactDocType {
  const normalized = relativePath.toLowerCase();
  if (normalized.includes("lecture") && normalized.endsWith(".pdf")) return "lecture_pdf";
  if (normalized.includes("schema")) return "schema_guide";
  if (normalized.includes("solution")) return "solution_explanation";
  if (normalized.includes("hw") || normalized.includes("homework") || normalized.includes("assignment")) {
    return "homework";
  }
  return "other";
}

export function buildChecksum(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function chunkText(content: string, size = 1000, overlap = 200): string[] {
  const normalized = String(content || "").trim();
  if (!normalized) return [];
  if (overlap >= size) throw new Error("overlap must be smaller than chunk size");

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + size, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

export function chunkArtifact(artifact: CourseArtifact, size = 1000, overlap = 200): ChunkedArtifact[] {
  const chunks = chunkText(artifact.content, size, overlap);
  const fileChecksum = buildChecksum(artifact.content);
  return chunks.map((text, index) => ({
    id: `${buildChecksum(`${artifact.relativePath}:${index}:${text.slice(0, 60)}`)}`,
    text,
    metadata: {
      course_id: artifact.courseId,
      term: artifact.term,
      doc_type: artifact.docType,
      module: artifact.module,
      version: artifact.version,
      source_path: artifact.relativePath,
      chunk_index: index,
      checksum: fileChecksum,
    },
  }));
}

export function validateIngestion(chunks: ChunkedArtifact[], minChunkCount = 1): string[] {
  const errors: string[] = [];
  if (chunks.length < minChunkCount) {
    errors.push(`chunk_count_below_threshold:${chunks.length}<${minChunkCount}`);
  }

  for (const chunk of chunks) {
    if (!chunk.text.trim()) {
      errors.push(`empty_chunk:${chunk.id}`);
    }
    const md = chunk.metadata;
    const required = [md.course_id, md.term, md.doc_type, md.module, md.version, md.source_path, md.checksum];
    if (required.some((entry) => !String(entry || "").trim())) {
      errors.push(`missing_metadata:${chunk.id}`);
    }
  }

  return errors;
}

export type IngestionManifestEntry = {
  path: string;
  checksum: string;
  updatedAt: string;
};

export function diffManifest(
  previous: IngestionManifestEntry[],
  current: IngestionManifestEntry[]
): { changed: IngestionManifestEntry[]; unchanged: IngestionManifestEntry[]; stale: IngestionManifestEntry[] } {
  const prevMap = new Map(previous.map((item) => [item.path, item]));
  const currMap = new Map(current.map((item) => [item.path, item]));

  const changed = current.filter((item) => prevMap.get(item.path)?.checksum !== item.checksum);
  const unchanged = current.filter((item) => prevMap.get(item.path)?.checksum === item.checksum);
  const stale = previous.filter((item) => !currMap.has(item.path));

  return { changed, unchanged, stale };
}

export function readTextFileSafe(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

export function collectCourseTextArtifacts(rootDir: string): string[] {
  const results: string[] = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (/\.(md|txt|sql|csv|json)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}
