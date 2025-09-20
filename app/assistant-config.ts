// Current GPT-5-nano assistant ID
export let assistantId = "asst_9bDfXIUHAqyYGa6SZgzBjE87"; // set your assistant ID here

// Future GPT-5 assistant ID (when available)
export let assistantIdGPT5 = process.env.OPENAI_ASSISTANT_ID_GPT5 || "";

// Feature flag for model selection
export const useLatestModel = process.env.USE_LATEST_MODEL === "true";
export const useGPT5 = process.env.USE_GPT5_ASSISTANT === "true";

// Dynamic assistant ID getter with fallback logic
export const getAssistantId = (): string => {
  // If GPT-5 is available and enabled, use it
  if (useGPT5 && assistantIdGPT5) {
    return assistantIdGPT5;
  }
  
  // Use the current assistant ID (upgraded to GPT-5-nano)
  if (assistantId === "") {
    assistantId = process.env.OPENAI_ASSISTANT_ID || "asst_9bDfXIUHAqyYGa6SZgzBjE87";
  }
  
  return assistantId;
};

// Get current model information
export const getCurrentModel = (): string => {
  if (useGPT5 && assistantIdGPT5) {
    return "gpt-5-nano";
  }
  return "gpt-5-nano";
};

// Assistant configuration metadata
export const assistantConfig = {
  getCurrentAssistantId: getAssistantId,
  getCurrentModel,
  isUsingLatestModel: useLatestModel,
  isUsingGPT5: useGPT5 && !!assistantIdGPT5
};
