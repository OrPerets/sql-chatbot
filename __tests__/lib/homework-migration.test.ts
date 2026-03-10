import {
  buildHomeworkAvailabilityBackfill,
  needsHomeworkAvailabilityBackfill,
} from "@/lib/homework-migration";

describe("homework migration helpers", () => {
  it("backfills availability fields from legacy dueAt and createdAt", () => {
    const result = buildHomeworkAvailabilityBackfill(
      {
        dueAt: "2026-03-20T10:00:00.000Z",
        createdAt: "2026-03-01T08:00:00.000Z",
      },
      "2026-03-06T10:00:00.000Z",
    );

    expect(result).toEqual({
      availableFrom: "2026-03-01T08:00:00.000Z",
      availableUntil: "2026-03-20T10:00:00.000Z",
      dueAt: "2026-03-20T10:00:00.000Z",
      entryMode: "listed",
    });
  });

  it("detects when a homework record already has the required fields", () => {
    expect(
      needsHomeworkAvailabilityBackfill({
        dueAt: "2026-03-20T10:00:00.000Z",
        availableFrom: "2026-03-01T08:00:00.000Z",
        availableUntil: "2026-03-20T10:00:00.000Z",
        entryMode: "direct",
      }),
    ).toBe(false);
  });
});
