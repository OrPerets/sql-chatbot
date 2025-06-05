export let assistantId = ""; // set your assistant ID here

if (assistantId === "") {
  assistantId = process.env.OPENAI_ASSISTANT_ID || "";
}

// Add validation and better error messaging
if (!assistantId) {
  console.error('⚠️ MISSING ASSISTANT ID: Please set OPENAI_ASSISTANT_ID in your environment variables or directly in assistant-config.ts');
}
