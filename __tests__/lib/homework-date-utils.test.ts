import { normalizeHomeworkDateTime } from "../../lib/homework-date-utils";

describe("normalizeHomeworkDateTime", () => {
  it("interprets an offsetless summer datetime as Jerusalem local time", () => {
    expect(normalizeHomeworkDateTime("2026-08-05T20:00")).toBe("2026-08-05T17:00:00.000Z");
  });

  it("interprets an offsetless winter datetime as Jerusalem local time", () => {
    expect(normalizeHomeworkDateTime("2026-12-05T20:00")).toBe("2026-12-05T18:00:00.000Z");
  });

  it("preserves timestamps that already include a timezone", () => {
    expect(normalizeHomeworkDateTime("2026-08-05T17:00:00.000Z")).toBe(
      "2026-08-05T17:00:00.000Z",
    );
    expect(normalizeHomeworkDateTime("2026-08-05T20:00:00.000+03:00")).toBe(
      "2026-08-05T20:00:00.000+03:00",
    );
  });
});
