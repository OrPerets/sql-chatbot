/**
 * @jest-environment node
 */

const mockCreate = jest.fn();

jest.mock("@/app/openai", () => ({
  openai: {
    responses: {
      create: (...args: any[]) => mockCreate(...args),
    },
  },
}));

jest.mock("@/app/agent-config", () => ({
  getAgentModel: () => "gpt-4.1-mini",
  getAgentInstructions: () => "Test instructions",
  getAgentTools: () => [{ type: "function", name: "get_course_week_context" }],
}));

describe("responses-client", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("extractOutputText prefers output_text", async () => {
    const { extractOutputText } = await import("@/lib/openai/responses-client");
    expect(extractOutputText({ output_text: "hello" })).toBe("hello");
  });

  it("runToolLoop executes function calls and chains previous_response_id", async () => {
    mockCreate
      .mockResolvedValueOnce({
        id: "resp_1",
        output: [
          {
            type: "function_call",
            call_id: "call_1",
            name: "get_course_week_context",
            arguments: "{\"week\":9}",
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "resp_2",
        output_text: "Week 9 allows JOIN and subqueries.",
      });

    const { runToolLoop, extractOutputText } = await import("@/lib/openai/responses-client");

    const response = await runToolLoop({
      input: [{ role: "user", content: [{ type: "input_text", text: "what can we use?" }] }],
      toolHandler: async () => "{\"weekNumber\":9}",
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].previous_response_id).toBe("resp_1");
    expect(extractOutputText(response)).toBe("Week 9 allows JOIN and subqueries.");
  });
});
