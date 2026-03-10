"use client";

import { FormEvent, useState } from "react";
import styles from "./page.module.css";

type StreamEvent = {
  type: "status" | "thinking" | "answer" | "done" | "error";
  message?: string;
  delta?: string;
};

export default function PrivateAdminPage() {
  const [question, setQuestion] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [thinking, setThinking] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pdfFile || !question.trim()) {
      setError("Please provide both a question and a PDF file.");
      return;
    }

    setLoading(true);
    setError("");
    setThinking("");
    setAnswer("");
    setStatus("Starting...");

    try {
      const formData = new FormData();
      formData.append("question", question);
      formData.append("pdf", pdfFile);

      const response = await fetch("/api/admin/private", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to start stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const streamEvent = JSON.parse(line) as StreamEvent;
          if (streamEvent.type === "status") {
            setStatus(streamEvent.message || "Working...");
          }
          if (streamEvent.type === "thinking" && streamEvent.delta) {
            setThinking((current) => current + streamEvent.delta);
          }
          if (streamEvent.type === "answer" && streamEvent.delta) {
            setAnswer((current) => current + streamEvent.delta);
          }
          if (streamEvent.type === "error") {
            setError(streamEvent.message || "Unexpected error.");
          }
          if (streamEvent.type === "done") {
            setStatus("Completed");
          }
        }
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unexpected error.";
      setError(message);
      setStatus("Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Private Admin GPT-5.4 Pro</h1>
      <p className={styles.subtitle}>
        Upload a PDF, ask a question, and stream reasoning summaries + final response in real time.
      </p>

      <form className={styles.form} onSubmit={onSubmit}>
        <textarea
          className={styles.textarea}
          placeholder="Enter your question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />

        <input
          className={styles.input}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
        />

        <button className={styles.button} disabled={loading} type="submit">
          {loading ? "Running..." : "Run with gpt-5.4-pro-2026-03-05"}
        </button>
      </form>

      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.status}>Status: {status}</div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Thinking Logs</h2>
          <pre className={styles.pre}>{thinking || "(waiting for model reasoning summary stream...)"}</pre>
        </section>

        <section className={styles.panel}>
          <h2>Response</h2>
          <pre className={styles.pre}>{answer || "(waiting for answer stream...)"}</pre>
        </section>
      </div>
    </div>
  );
}
