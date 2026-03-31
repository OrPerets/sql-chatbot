"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import { useEffect, useState } from "react";
import { RECOMMENDED_RUNTIME_MODEL } from "@/lib/openai/model-registry";
import styles from "./ModelManagement.module.css";

interface RuntimeConfig {
  model: string;
  toolsCount: number;
  enabledToolNames?: string[];
  updatedAt?: string | null;
  source?: string;
}

interface FeatureFlagDiagnostic {
  name: string;
  enabled: boolean;
  defaultValue: boolean;
  description: string;
}

interface ToolBoundary {
  purpose: string;
  webSearchAllowed: boolean;
  notes: string[];
}

interface ToolMatrixEntry {
  name: string;
  lifecycle: string;
  rolloutPhase: string;
  allowedRoles: string[];
  loggingSensitivity: string;
  runtimeEnabled: boolean;
  featureFlag?: string | null;
  featureFlagEnabled?: boolean;
}

interface ToolMatrixRow {
  context: string;
  boundary: ToolBoundary;
  tools: ToolMatrixEntry[];
}

interface RuntimeConfigResponse {
  success?: boolean;
  mode?: string;
  config?: RuntimeConfig;
  featureFlags?: FeatureFlagDiagnostic[];
  instructorConnectorCapabilities?: Array<{
    id: string;
    label: string;
    delivery: string;
    connectorId?: string;
    enabled: boolean;
    featureFlagEnabled: boolean;
    authConfigured: boolean;
    status: string;
    statusDetail: string;
    allowedTools: string[];
    useCases: string[];
    oauthScopes: string[];
    implementationDecision: string;
  }>;
  toolContextBoundaries?: Record<string, ToolBoundary>;
  toolRolloutMatrix?: ToolMatrixRow[];
  toolUsageLoggingPlan?: {
    destination: string;
    notes: string[];
  };
  error?: string;
}

interface TestResult {
  success: boolean;
  model: string;
  testType: string;
  executionTimeMs: number;
  results: {
    success: boolean;
    responseQuality: string;
    languageSupport: string;
    functionCalling: string;
    functionCallsCount: number;
    responseLength: number;
    containsExample: boolean;
    containsHebrew: boolean;
    issues: string[];
  };
  preview?: string;
}

interface UsageAnalytics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
  modelBreakdown: Record<string, any>;
}

export default function ModelManagement() {
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [apiMode, setApiMode] = useState<string>("unknown");
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagDiagnostic[]>([]);
  const [instructorConnectorCapabilities, setInstructorConnectorCapabilities] = useState<
    NonNullable<RuntimeConfigResponse["instructorConnectorCapabilities"]>
  >([]);
  const [toolRolloutMatrix, setToolRolloutMatrix] = useState<ToolMatrixRow[]>([]);
  const [toolUsageLoggingPlan, setToolUsageLoggingPlan] = useState<RuntimeConfigResponse["toolUsageLoggingPlan"] | null>(null);
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadRuntimeConfig();
    void loadUsageAnalytics();
  }, []);

  const loadRuntimeConfig = async () => {
    try {
      const response = await fetch("/api/responses/runtime");
      if (!response.ok) {
        throw new Error("Failed to load runtime config.");
      }

      const data = (await response.json()) as RuntimeConfigResponse;
      if (!data.success || !data.config) {
        throw new Error(data.error || "Failed to load runtime config.");
      }

      setRuntimeConfig(data.config);
      setApiMode(data.mode || "unknown");
      setFeatureFlags(Array.isArray(data.featureFlags) ? data.featureFlags : []);
      setInstructorConnectorCapabilities(
        Array.isArray(data.instructorConnectorCapabilities)
          ? data.instructorConnectorCapabilities
          : []
      );
      setToolRolloutMatrix(Array.isArray(data.toolRolloutMatrix) ? data.toolRolloutMatrix : []);
      setToolUsageLoggingPlan(data.toolUsageLoggingPlan || null);
    } catch (err: any) {
      setError(err.message || "Failed to load runtime config.");
    }
  };

  const loadUsageAnalytics = async () => {
    try {
      const response = await fetch("/api/analytics/model-usage?timeRange=24h");
      if (response.ok) {
        const data = await response.json();
        setUsageAnalytics(data.analytics);
      }
    } catch (err) {
      console.error("Failed to load usage analytics:", err);
    }
  };

  const applyRecommendedConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/responses/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: RECOMMENDED_RUNTIME_MODEL,
          reason: "admin recommended config",
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Config update failed");
      }

      await loadRuntimeConfig();
      alert(`Runtime model config updated to ${data?.config?.model || RECOMMENDED_RUNTIME_MODEL}`);
    } catch (err: any) {
      setError(err.message || "Config update failed");
    } finally {
      setLoading(false);
    }
  };

  const runTest = async (testType: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/responses/runtime/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testType }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Test failed");
      }

      setTestResults(data as TestResult);
    } catch (err: any) {
      setError(err.message || "Test failed");
    } finally {
      setLoading(false);
    }
  };

  const rollbackConfig = async (reason: string) => {
    if (!confirm(`Rollback runtime config? Reason: ${reason}`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/responses/runtime/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, rollbackTo: "previous-stable" }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Rollback failed");
      }

      await loadRuntimeConfig();
      alert(`Rollback complete: ${data.message}`);
    } catch (err: any) {
      setError(err.message || "Rollback failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell>
      <div className={styles.container}>
      <div className={styles.navigation}>
        <button onClick={() => (window.location.href = "/admin")} className={styles.backButton}>
          ← חזור לדשבורד ניהול
        </button>
      </div>

      <div className={styles.header}>
        <h1>ניהול מודלי AI</h1>
        <p>ניהול קונפיגורציית OpenAI runtime עבור Michael על גבי Responses API. נתיבי ה-Assistants נשארים כ-aliases זמניים בלבד.</p>
      </div>

      {error && <div className={styles.error}>Error: {error}</div>}

      <section className={styles.section}>
        <h2>קונפיגורציית Runtime נוכחית</h2>
        {runtimeConfig ? (
          <div className={styles.info}>
            <p>
              <strong>API Mode:</strong> {apiMode}
            </p>
            <p>
              <strong>Model:</strong> {runtimeConfig.model}
            </p>
            <p>
              <strong>Enabled Tools:</strong> {runtimeConfig.toolsCount}
            </p>
            <p>
              <strong>Config Source:</strong> {runtimeConfig.source || "default"}
            </p>
            <p>
              <strong>Updated At:</strong> {runtimeConfig.updatedAt || "N/A"}
            </p>
          </div>
        ) : (
          <p>טוען קונפיגורציה...</p>
        )}

        <div className={styles.actions}>
          <button onClick={applyRecommendedConfig} disabled={loading} className={styles.upgradeButton}>
            {loading ? "מעדכן..." : `Apply Recommended Config (${RECOMMENDED_RUNTIME_MODEL})`}
          </button>

          <button
            onClick={() => rollbackConfig("Manual rollback from admin panel")}
            disabled={loading}
            className={styles.rollbackButton}
          >
            {loading ? "מחזיר..." : "Rollback to Previous Stable"}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Feature Flags</h2>
        {featureFlags.length ? (
          <div className={styles.diagnosticGrid}>
            {featureFlags.map((flag) => (
              <div key={flag.name} className={styles.diagnosticCard}>
                <div className={styles.diagnosticHeader}>
                  <strong>{flag.name}</strong>
                  <span className={flag.enabled ? styles.flagOn : styles.flagOff}>
                    {flag.enabled ? "ON" : "OFF"}
                  </span>
                </div>
                <p>{flag.description}</p>
                <small>Default: {flag.defaultValue ? "ON" : "OFF"}</small>
              </div>
            ))}
          </div>
        ) : (
          <p>לא נמצאו feature flags.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Instructor Connectors</h2>
        {instructorConnectorCapabilities.length ? (
          <div className={styles.diagnosticGrid}>
            {instructorConnectorCapabilities.map((connector) => (
              <div key={connector.id} className={styles.diagnosticCard}>
                <div className={styles.diagnosticHeader}>
                  <strong>{connector.label}</strong>
                  <span className={connector.status === "ready" ? styles.flagOn : styles.flagOff}>
                    {connector.status}
                  </span>
                </div>
                <p>{connector.statusDetail}</p>
                <p>
                  Delivery: {connector.delivery}
                  {connector.connectorId ? ` | Connector ID: ${connector.connectorId}` : ""}
                </p>
                <p>Enabled: {connector.enabled ? "yes" : "no"} | Auth token: {connector.authConfigured ? "configured" : "missing"}</p>
                <p>Allowed tools: {connector.allowedTools.join(", ")}</p>
                <p>Use cases: {connector.useCases.join(", ")}</p>
                <small>Scopes: {connector.oauthScopes.join(", ")}</small>
                <p>{connector.implementationDecision}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>Instructor connector diagnostics are unavailable.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Tool Rollout Matrix</h2>
        {toolRolloutMatrix.length ? (
          <div className={styles.contextStack}>
            {toolRolloutMatrix.map((row) => (
              <div key={row.context} className={styles.contextCard}>
                <div className={styles.contextHeader}>
                  <div>
                    <h3>{row.context}</h3>
                    <p>{row.boundary.purpose}</p>
                  </div>
                  <span className={row.boundary.webSearchAllowed ? styles.flagOn : styles.flagOff}>
                    web_search {row.boundary.webSearchAllowed ? "allowed" : "blocked"}
                  </span>
                </div>
                <ul className={styles.boundaryNotes}>
                  {row.boundary.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
                <div className={styles.toolList}>
                  {row.tools.map((tool) => (
                    <div key={`${row.context}-${tool.name}`} className={styles.toolCard}>
                      <div className={styles.diagnosticHeader}>
                        <strong>{tool.name}</strong>
                        <span className={tool.runtimeEnabled ? styles.flagOn : styles.flagOff}>
                          {tool.runtimeEnabled ? "runtime on" : "runtime off"}
                        </span>
                      </div>
                      <p>
                        Lifecycle: {tool.lifecycle} | Rollout: {tool.rolloutPhase}
                      </p>
                      <p>
                        Roles: {tool.allowedRoles.join(", ")} | Logging: {tool.loggingSensitivity}
                      </p>
                      {tool.featureFlag ? (
                        <small>
                          Flag: {tool.featureFlag} ({tool.featureFlagEnabled ? "enabled" : "disabled"})
                        </small>
                      ) : (
                        <small>No feature flag gate</small>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>Tool rollout diagnostics are unavailable.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Logging Plan</h2>
        {toolUsageLoggingPlan ? (
          <div className={styles.info}>
            <p>
              <strong>Destination:</strong> {toolUsageLoggingPlan.destination}
            </p>
            <ul className={styles.boundaryNotes}>
              {toolUsageLoggingPlan.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>Logging plan not available.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>בדיקות Runtime</h2>
        <div className={styles.testButtons}>
          <button onClick={() => runTest("basic")} disabled={loading}>
            בדיקה בסיסית
          </button>
          <button onClick={() => runTest("hebrew")} disabled={loading}>
            בדיקת עברית
          </button>
          <button onClick={() => runTest("function_calling")} disabled={loading}>
            בדיקת Tools
          </button>
          <button onClick={() => runTest("complex_query")} disabled={loading}>
            בדיקת שאילתות מורכבות
          </button>
        </div>

        {testResults && (
          <div className={styles.testResults}>
            <h3>תוצאות בדיקה אחרונות</h3>
            <div className={`${styles.result} ${testResults.success ? styles.success : styles.failure}`}>
              <p>
                <strong>Test Type:</strong> {testResults.testType}
              </p>
              <p>
                <strong>Model:</strong> {testResults.model}
              </p>
              <p>
                <strong>Execution Time:</strong> {testResults.executionTimeMs}ms
              </p>
              <p>
                <strong>Response Quality:</strong> {testResults.results.responseQuality}
              </p>
              <p>
                <strong>Function Calling:</strong> {testResults.results.functionCalling}
              </p>
              <p>
                <strong>Response Length:</strong> {testResults.results.responseLength} chars
              </p>
              {testResults.preview ? (
                <p>
                  <strong>Preview:</strong> {testResults.preview}
                </p>
              ) : null}

              {testResults.results.issues.length > 0 && (
                <div className={styles.issues}>
                  <strong>Issues:</strong>
                  <ul>
                    {testResults.results.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>ניתוח שימוש (24 שעות אחרונות)</h2>
        {usageAnalytics ? (
          <div className={styles.analytics}>
            <div className={styles.stat}>
              <strong>Total Requests:</strong> {usageAnalytics.totalRequests}
            </div>
            <div className={styles.stat}>
              <strong>Total Tokens:</strong> {usageAnalytics.totalTokens.toLocaleString()}
            </div>
            <div className={styles.stat}>
              <strong>Total Cost:</strong> ${usageAnalytics.totalCost.toFixed(4)}
            </div>
            <div className={styles.stat}>
              <strong>Avg Tokens/Request:</strong> {usageAnalytics.averageTokensPerRequest}
            </div>
            <div className={styles.stat}>
              <strong>Avg Cost/Request:</strong> ${usageAnalytics.averageCostPerRequest.toFixed(4)}
            </div>

            {Object.keys(usageAnalytics.modelBreakdown).length > 0 && (
              <div className={styles.modelBreakdown}>
                <h4>Model Breakdown:</h4>
                {Object.entries(usageAnalytics.modelBreakdown).map(([model, stats]: [string, any]) => (
                  <div key={model} className={styles.modelStat}>
                    <strong>{model}:</strong> {stats.requests} requests, {stats.tokens} tokens, $
                    {stats.cost.toFixed(4)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p>Loading usage analytics...</p>
        )}
      </section>
      </div>
    </AdminShell>
  );
}
