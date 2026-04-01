import { chunkText, diffManifest, validateIngestion } from "@/lib/openai/course-ingestion";

describe("course ingestion helpers", () => {
  it("chunks text with overlap", () => {
    const text = "a".repeat(260);
    const chunks = chunkText(text, 100, 20);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].length).toBe(100);
  });

  it("detects stale entries in manifest diff", () => {
    const diff = diffManifest(
      [{ path: "docs/a.md", checksum: "old", updatedAt: "2026-01-01" }],
      [{ path: "docs/b.md", checksum: "new", updatedAt: "2026-01-02" }]
    );
    expect(diff.stale).toHaveLength(1);
    expect(diff.changed).toHaveLength(1);
  });

  it("validates metadata completeness", () => {
    const errors = validateIngestion([
      {
        id: "1",
        text: "content",
        metadata: {
          course_id: "",
          term: "2026",
          doc_type: "other",
          module: "m1",
          version: "v1",
          source_path: "docs/a.md",
          chunk_index: 0,
          checksum: "abc",
        },
      },
    ]);

    expect(errors.some((entry) => entry.startsWith("missing_metadata"))).toBe(true);
  });
});
