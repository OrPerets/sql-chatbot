import {
  ACADEMIC_SEMESTER_OPTIONS,
  buildAcademicPeriodSearchParams,
  formatAcademicPeriodLabel,
  parseAcademicPeriodFromSearchParams,
} from "@/lib/academic-period";

describe("academic period", () => {
  it("offers semester C as the third admin semester", () => {
    expect(ACADEMIC_SEMESTER_OPTIONS).toEqual([
      { value: 1, label: "A" },
      { value: 2, label: "B" },
      { value: 3, label: "C" },
    ]);
    expect(formatAcademicPeriodLabel({ year: 2026, semester: 3 })).toBe("2026/C");
  });

  it("round-trips semester C through the API query format", () => {
    const query = buildAcademicPeriodSearchParams({ year: 2026, semester: 3 });

    expect(parseAcademicPeriodFromSearchParams(new URLSearchParams(query))).toEqual({
      year: 2026,
      semester: 3,
    });
  });
});
