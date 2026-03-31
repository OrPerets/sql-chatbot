"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, BrainCircuit, FileText, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import type { ResponseCitation, ResponseTurnMetadata } from "@/lib/openai/contracts";
import styles from "./test-gpt.module.css";

type ReasoningEffort = "medium" | "high" | "xhigh";

type UploadedPdf = {
  fileId: string;
  filename: string;
  bytes?: number;
};

type StreamEvent =
  | {
      type: "response.created";
      responseId?: string;
      reasoningSummaryEnabled?: boolean;
    }
  | {
      type: "response.output_text.delta";
      delta: string;
    }
  | {
      type: "response.reasoning_summary_text.delta";
      delta: string;
    }
  | {
      type: "response.reasoning_summary_text.done";
      text: string;
    }
  | {
      type: "response.completed";
      responseId?: string;
      outputText?: string;
      citations?: ResponseCitation[];
      metadata?: ResponseTurnMetadata | null;
    }
  | {
      type: "response.error";
      message: string;
    };

function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TestGptPage() {
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("medium");
  const [includeReasoningSummary, setIncludeReasoningSummary] = useState(true);
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [reasoningText, setReasoningText] = useState("");
  const [responseText, setResponseText] = useState("");
  const [responseId, setResponseId] = useState("");
  const [citations, setCitations] = useState<ResponseCitation[]>([]);
  const [responseMetadata, setResponseMetadata] = useState<ResponseTurnMetadata | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      window.location.href = "/login";
      return;
    }

    const user = JSON.parse(storedUser) as { email?: string };
    const email = typeof user.email === "string" ? user.email.toLowerCase() : null;
    setCurrentAdminEmail(email);
  }, []);

  const adminHeaders = useMemo(() => {
    if (!currentAdminEmail) {
      return {};
    }

    return {
      "x-user-email": currentAdminEmail,
    };
  }, [currentAdminEmail]);

  const appendLog = (message: string) => {
    setEventLog((current) => [...current, message]);
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !currentAdminEmail) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        appendLog(`Uploading ${file.name}`);

        const response = await fetch("/api/admin/test-gpt/files", {
          method: "POST",
          headers: adminHeaders,
          body: formData,
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || `Upload failed for ${file.name}`);
        }

        setUploadedPdfs((current) => [
          ...current,
          {
            fileId: payload.fileId,
            filename: payload.filename || file.name,
            bytes: payload.bytes,
          },
        ]);

        appendLog(`Uploaded ${payload.filename || file.name}`);
      }
    } catch (uploadError: any) {
      setError(uploadError?.message || "Failed to upload PDF.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePdf = async (fileId: string) => {
    if (!currentAdminEmail) {
      return;
    }

    const target = uploadedPdfs.find((file) => file.fileId === fileId);
    setUploadedPdfs((current) => current.filter((file) => file.fileId !== fileId));

    try {
      await fetch("/api/admin/test-gpt/files", {
        method: "DELETE",
        headers: {
          ...adminHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId }),
      });
      appendLog(`Removed ${target?.filename || fileId}`);
    } catch {
      appendLog(`Removed local attachment ${target?.filename || fileId}`);
    }
  };

  const runPrompt = async () => {
    if (!currentAdminEmail || running) {
      return;
    }

    if (!prompt.trim() && uploadedPdfs.length === 0) {
      setError("Write a prompt or attach at least one PDF.");
      return;
    }

    setRunning(true);
    setError(null);
    setReasoningText("");
    setResponseText("");
    setResponseId("");
    setCitations([]);
    setResponseMetadata(null);
    setEventLog([]);

    try {
      const response = await fetch("/api/responses/messages", {
        method: "POST",
        headers: {
          ...adminHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: prompt,
          fileIds: uploadedPdfs.map((file) => file.fileId),
          stream: true,
          context: "admin",
          reasoningEffort,
          includeReasoningSummary,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to start GPT request.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
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

          const event = JSON.parse(line) as StreamEvent;

          if (event.type === "response.created") {
            setResponseId(event.responseId || "");
            appendLog(
              event.reasoningSummaryEnabled === false
                ? `Started ${event.responseId || "response"} without reasoning summaries`
                : `Started ${event.responseId || "response"}`
            );
            continue;
          }

          if (event.type === "response.reasoning_summary_text.delta") {
            setReasoningText((current) => current + event.delta);
            continue;
          }

          if (event.type === "response.reasoning_summary_text.done") {
            setReasoningText(event.text);
            appendLog("Reasoning summary complete");
            continue;
          }

          if (event.type === "response.output_text.delta") {
            setResponseText((current) => current + event.delta);
            continue;
          }

          if (event.type === "response.completed") {
            setResponseId(event.responseId || "");
            setResponseText(event.outputText || "");
            setCitations(Array.isArray(event.citations) ? event.citations : []);
            setResponseMetadata(event.metadata || null);

            if (event.metadata?.webSearchCallCount) {
              appendLog(
                `web_search completed: ${event.metadata.webSearchCallCount} call(s), ${event.metadata.webSearchSourceCount || 0} source(s)`
              );
            }

            if (event.metadata?.connectorUsage?.length) {
              appendLog(
                `Connector sources: ${event.metadata.connectorUsage
                  .map((entry) => `${entry.label} (${entry.toolNames.join(", ")})`)
                  .join(" | ")}`
              );
            }

            appendLog(`Completed ${event.responseId || "response"}`);
            continue;
          }

          if (event.type === "response.error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (runError: any) {
      setError(runError?.message || "Failed to run GPT request.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <AdminShell>
      <div className={styles.page}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Admin Playground</p>
          <h1 className={styles.title}>GPT-5.4 Pro Test Console</h1>
          <p className={styles.subtitle}>
            Runs on the shared Responses pipeline with admin-only hosted tools, selectable reasoning
            effort, PDF attachments, streamed reasoning summaries, citations, and final-answer diagnostics.
          </p>
        </div>

        <a href="/admin" className={styles.backLink}>
          Back to admin
        </a>
      </div>

      <div className={styles.notice}>
        OpenAI exposes reasoning summaries here, not the model&apos;s hidden raw chain of thought.
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.composerCard}>
        <div className={styles.cardHeader}>
          <Sparkles size={18} />
          <h2>Request</h2>
        </div>

        <label className={styles.label} htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          className={styles.textarea}
          placeholder="Ask anything. If you attach PDFs, refer to them directly in the prompt."
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />

        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label className={styles.label} htmlFor="reasoningEffort">
              Reasoning effort
            </label>
            <select
              id="reasoningEffort"
              className={styles.select}
              value={reasoningEffort}
              onChange={(event) => setReasoningEffort(event.target.value as ReasoningEffort)}
            >
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="xhigh">xhigh</option>
            </select>
          </div>

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={includeReasoningSummary}
              onChange={(event) => setIncludeReasoningSummary(event.target.checked)}
            />
            Stream reasoning summaries
          </label>
        </div>

        <div className={styles.uploadRow}>
          <input
            ref={fileInputRef}
            className={styles.hiddenInput}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleUpload}
          />
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || running}
          >
            <FileText size={16} />
            {uploading ? "Uploading PDFs..." : "Attach PDFs"}
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={runPrompt}
            disabled={running || uploading || !currentAdminEmail}
          >
            {running ? <Loader2 size={16} className={styles.spin} /> : <Send size={16} />}
            {running ? "Running..." : "Run prompt"}
          </button>
        </div>

        {uploadedPdfs.length ? (
          <div className={styles.filesList}>
            {uploadedPdfs.map((file) => (
              <div key={file.fileId} className={styles.fileChip}>
                <div>
                  <strong>{file.filename}</strong>
                  <span>{formatBytes(file.bytes)}</span>
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => removePdf(file.fileId)}
                  disabled={running}
                  aria-label={`Remove ${file.filename}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.resultsGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <BrainCircuit size={18} />
            <h2>Thinking Summary</h2>
          </div>
          <div className={styles.panelMeta}>
            <span>Reasoning: {reasoningEffort}</span>
            <span>{includeReasoningSummary ? "Enabled" : "Disabled"}</span>
          </div>
          <div className={styles.panelBody}>
            {reasoningText ? (
              <ReactMarkdown>{reasoningText}</ReactMarkdown>
            ) : (
              <p className={styles.placeholder}>
                {running
                  ? "Waiting for reasoning summary events..."
                  : "Reasoning summaries will stream here if enabled and supported."}
              </p>
            )}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <Bot size={18} />
            <h2>Full Response</h2>
          </div>
          <div className={styles.panelMeta}>
            <span>{responseId ? `Response ID: ${responseId}` : "No response yet"}</span>
            <span>Sources: {citations.length}</span>
            <span>Web search calls: {responseMetadata?.webSearchCallCount || 0}</span>
            <span>Connector calls: {responseMetadata?.connectorCallCount || 0}</span>
          </div>
          <div className={styles.panelBody}>
            {responseText ? (
              <>
                <ReactMarkdown>{responseText}</ReactMarkdown>
                {responseMetadata?.connectorUsage?.length ? (
                  <div className={styles.sourcesSection}>
                    <h3>Connector Sources</h3>
                    <ul className={styles.sourcesList}>
                      {responseMetadata.connectorUsage.map((entry) => (
                        <li key={entry.label}>
                          <strong>{entry.label}</strong> via {entry.toolNames.join(", ")} ({entry.callCount} call
                          {entry.callCount === 1 ? "" : "s"})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {citations.length ? (
                  <div className={styles.sourcesSection}>
                    <h3>Sources</h3>
                    <ul className={styles.sourcesList}>
                      {citations.map((citation, index) => (
                        <li key={`${citation.url || citation.fileId || "citation"}-${index}`}>
                          {citation.type === "url_citation" && citation.url ? (
                            <a href={citation.url} target="_blank" rel="noreferrer">
                              {citation.title || citation.url}
                            </a>
                          ) : (
                            <span>{citation.filename || citation.fileId || "Course file"}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className={styles.placeholder}>
                {running ? "Streaming response..." : "The final model output will appear here."}
              </p>
            )}
          </div>
        </article>

        <article className={`${styles.panel} ${styles.logPanel}`}>
          <div className={styles.panelHeader}>
            <Sparkles size={18} />
            <h2>Event Log</h2>
          </div>
          <div className={styles.panelBody}>
            {eventLog.length ? (
              <ul className={styles.logList}>
                {eventLog.map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.placeholder}>Upload files or run a prompt to populate the log.</p>
            )}
          </div>
        </article>
      </section>
      </div>
    </AdminShell>
  );
}
