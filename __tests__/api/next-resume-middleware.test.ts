import { hasBlockedNextResumeHeader } from "@/lib/security/next-resume";

describe("next-resume security middleware", () => {
  it("detects blocked next-resume header payloads", () => {
    const oversizedPayload = "x".repeat(200_000);
    const headers = new Headers({
      "next-resume": oversizedPayload,
    });
    expect(hasBlockedNextResumeHeader(headers)).toBe(true);
  });
});
