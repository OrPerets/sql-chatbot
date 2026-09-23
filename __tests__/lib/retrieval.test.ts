import {
  buildRetrievalInstructions,
  hasVisibleCitationSection,
  shouldUseRetrieval,
  SOURCE_OF_TRUTH_CORPUS,
} from "@/lib/openai/retrieval";

describe("retrieval helpers", () => {
  it("detects retrieval-worthy prompts in English and Hebrew", () => {
    expect(shouldUseRetrieval("What does the homework rubric say about week 5?")).toBe(true);
    expect(shouldUseRetrieval("מה כתוב בהנחיות של שיעורי הבית לשבוע 4?")).toBe(true);
    expect(shouldUseRetrieval("Which tables are allowed in the week 6 schema notes?")).toBe(true);
    expect(shouldUseRetrieval("באיזו עמודה צריך להשתמש אם הסכמה לא ברורה מהמסמך?")).toBe(true);
    expect(shouldUseRetrieval("Write a simple SELECT query")).toBe(false);
  });

  it("documents the full source-of-truth corpus", () => {
    const instructions = buildRetrievalInstructions();

    expect(SOURCE_OF_TRUTH_CORPUS.map((item) => item.label)).toEqual([
      "official course material",
      "homework instructions",
      "worked examples",
      "FAQ and policy notes",
    ]);
    expect(instructions).toContain("Use file_search");
    expect(instructions).toContain("official course material");
    expect(instructions).toContain("homework instructions");
    expect(instructions).toContain("worked examples");
    expect(instructions).toContain("FAQ and policy notes");
    expect(instructions).toContain("keep source citations visible");
  });

  it("recognizes visible citation sections in both supported languages", () => {
    expect(hasVisibleCitationSection("Answer\n\nSources:\n- [1] notes.pdf")).toBe(true);
    expect(hasVisibleCitationSection("תשובה\n\nמקורות:\n- [1] lecture.pdf")).toBe(true);
    expect(hasVisibleCitationSection("Answer without citations")).toBe(false);
  });
});
