import {
  ConnectorUsage,
  ResponseCitation,
  ResponseTokenUsage,
  ResponseTurnMetadata,
  TaskClass,
  ToolCallUsage,
} from "@/lib/openai/contracts";
import { hasVisibleCitationSection } from "@/lib/openai/retrieval";

type UnknownRecord = Record<string, any>;

const MODEL_TOKEN_COST_USD_PER_1K: Record<string, number> = {
  "gpt-4.1": 0.01,
  "gpt-4.1-mini": 0.002,
  "gpt-5.4-mini": 0.0025,
  "gpt-5.3-mini": 0.0025,
};

function getMessageOutputItems(response: UnknownRecord): UnknownRecord[] {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output.filter((item) => item?.type === "message" && Array.isArray(item?.content));
}

function extractOutputAnnotations(response: UnknownRecord): UnknownRecord[] {
  return getMessageOutputItems(response).flatMap((item) =>
    (item.content || []).flatMap((contentItem: UnknownRecord) =>
      Array.isArray(contentItem?.annotations) ? contentItem.annotations : []
    )
  );
}

function extractFileSearchCalls(response: UnknownRecord): UnknownRecord[] {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output.filter((item) => item?.type === "file_search_call");
}

function extractWebSearchCalls(response: UnknownRecord): UnknownRecord[] {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output.filter((item) => item?.type === "web_search_call");
}

function extractMcpCalls(response: UnknownRecord): UnknownRecord[] {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output.filter((item) => item?.type === "mcp_call");
}

export function extractResponseCitations(response: UnknownRecord): ResponseCitation[] {
  const fileSearchCalls = extractFileSearchCalls(response);
  const queries = fileSearchCalls.flatMap((call) =>
    Array.isArray(call?.queries) ? call.queries.map((query: unknown) => String(query)) : []
  );

  const citations = extractOutputAnnotations(response).flatMap<ResponseCitation>((annotation) => {
    if (annotation?.type === "file_citation") {
      const linkedResult = fileSearchCalls
        .flatMap((call) => (Array.isArray(call?.results) ? call.results : []))
        .find((result: UnknownRecord) => result?.file_id === annotation.file_id);

      return {
        type: "file_citation",
        fileId: annotation.file_id ? String(annotation.file_id) : undefined,
        filename: annotation.filename ? String(annotation.filename) : undefined,
        index: typeof annotation.index === "number" ? annotation.index : undefined,
        query: queries[0] || undefined,
        snippet:
          typeof linkedResult?.text === "string"
            ? linkedResult.text
            : typeof linkedResult?.content === "string"
              ? linkedResult.content
              : null,
        score: typeof linkedResult?.score === "number" ? linkedResult.score : null,
      };
    }

    if (annotation?.type === "url_citation") {
      return {
        type: "url_citation",
        url: annotation.url ? String(annotation.url) : undefined,
        title: annotation.title ? String(annotation.title) : undefined,
        startIndex:
          typeof annotation.start_index === "number" ? annotation.start_index : undefined,
        endIndex:
          typeof annotation.end_index === "number" ? annotation.end_index : undefined,
      };
    }

    return [];
  });

  const deduped = new Map<string, ResponseCitation>();
  for (const citation of citations) {
    const key = JSON.stringify([
      citation.type,
      citation.fileId || "",
      citation.filename || "",
      citation.url || "",
      citation.title || "",
      citation.index || citation.startIndex || 0,
    ]);
    if (!deduped.has(key)) {
      deduped.set(key, citation);
    }
  }
  return Array.from(deduped.values());
}

export function extractFileSearchQueries(response: UnknownRecord): string[] {
  return extractFileSearchCalls(response).flatMap((call) =>
    Array.isArray(call?.queries) ? call.queries.map((query: unknown) => String(query)) : []
  );
}

export function extractWebSearchQueries(response: UnknownRecord): string[] {
  return extractWebSearchCalls(response).flatMap((call) =>
    Array.isArray(call?.queries) ? call.queries.map((query: unknown) => String(query)) : []
  );
}

export function extractWebSearchMetrics(response: UnknownRecord) {
  const webSearchCalls = extractWebSearchCalls(response);
  const citations = extractResponseCitations(response).filter(
    (citation) => citation.type === "url_citation"
  );

  return {
    callCount: webSearchCalls.length,
    queries: extractWebSearchQueries(response),
    sourceCount: citations.length,
  };
}

export function extractConnectorUsage(response: UnknownRecord): ConnectorUsage[] {
  const usageByLabel = new Map<string, ConnectorUsage>();

  for (const call of extractMcpCalls(response)) {
    const label = String(call?.server_label || "Connector");
    const toolName = String(call?.name || "unknown");
    const existing = usageByLabel.get(label);

    if (!existing) {
      usageByLabel.set(label, {
        label,
        toolNames: [toolName],
        callCount: 1,
      });
      continue;
    }

    if (!existing.toolNames.includes(toolName)) {
      existing.toolNames.push(toolName);
    }
    existing.callCount += 1;
  }

  return Array.from(usageByLabel.values());
}

export function extractConnectorCalls(response: UnknownRecord) {
  return extractMcpCalls(response).map((call) => ({
    label: String(call?.server_label || "Connector"),
    toolName: String(call?.name || "unknown"),
  }));
}

export function extractTokenUsage(response: UnknownRecord): ResponseTokenUsage | null {
  const usage = response?.usage;
  if (!usage || typeof usage !== "object") {
    return null;
  }

  return {
    inputTokens: Number(usage.input_tokens || 0),
    outputTokens: Number(usage.output_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0),
    cachedInputTokens: Number(usage.input_tokens_details?.cached_tokens || 0),
    reasoningTokens: Number(usage.output_tokens_details?.reasoning_tokens || 0),
  };
}

export function buildVisibleCitationSuffix(citations: ResponseCitation[]): string {
  if (!citations.length) {
    return "";
  }

  const lines = citations.map((citation, index) => {
    if (citation.type === "file_citation") {
      return `- [${index + 1}] ${citation.filename || citation.fileId || "retrieved course file"}`;
    }
    return `- [${index + 1}] ${citation.title || citation.url || "web source"}`;
  });

  return `\n\nSources:\n${lines.join("\n")}`;
}

export function appendVisibleCitations(
  text: string,
  citations: ResponseCitation[]
): string {
  if (!citations.length || hasVisibleCitationSection(text)) {
    return text;
  }
  return `${text}${buildVisibleCitationSuffix(citations)}`;
}

export function buildResponseTurnMetadata(params: {
  response: UnknownRecord;
  requestId?: string | null;
  actorId?: string | null;
  route?: string | null;
  taskClass?: TaskClass | null;
  skillId?: string | null;
  sessionId?: string | null;
  previousResponseId?: string | null;
  latencyMs: number;
  toolCalls: ToolCallUsage[];
  fallbackTriggered?: boolean;
  failureReason?: string | null;
  promptCacheKey?: string | null;
  safetyIdentifier?: string | null;
  store?: boolean;
  truncation?: string | null;
}): ResponseTurnMetadata {
  const fileSearchQueries = extractFileSearchQueries(params.response);
  const webSearchMetrics = extractWebSearchMetrics(params.response);
  const connectorUsage = extractConnectorUsage(params.response);
  const tokenUsage = extractTokenUsage(params.response);
  const model = params.response?.model ? String(params.response.model) : null;
  const normalizedModel = model?.toLowerCase() || "";
  const per1k = MODEL_TOKEN_COST_USD_PER_1K[normalizedModel];
  const costEstimateUsd =
    tokenUsage && typeof per1k === "number"
      ? Number((((tokenUsage.totalTokens || 0) / 1000) * per1k).toFixed(6))
      : null;

  return {
    requestId: params.requestId ?? null,
    actorId: params.actorId ?? null,
    route: params.route ?? null,
    taskClass: params.taskClass ?? null,
    skillId: params.skillId ?? null,
    canonicalStateStrategy: "previous_response_id",
    sessionId: params.sessionId ?? null,
    responseId: params.response?.id ? String(params.response.id) : null,
    previousResponseId: params.previousResponseId ?? null,
    model,
    latencyMs: params.latencyMs,
    tokenUsage,
    toolCalls: params.toolCalls,
    failureReason: params.failureReason ?? null,
    store: params.store,
    truncation: params.truncation ?? null,
    promptCacheKey: params.promptCacheKey ?? null,
    safetyIdentifier: params.safetyIdentifier ?? null,
    retrievalUsed: fileSearchQueries.length > 0 || extractResponseCitations(params.response).length > 0,
    fileSearchQueries,
    webSearchQueries: webSearchMetrics.queries,
    webSearchCallCount: webSearchMetrics.callCount,
    webSearchSourceCount: webSearchMetrics.sourceCount,
    connectorUsage,
    connectorCallCount: connectorUsage.reduce((total, entry) => total + entry.callCount, 0),
    toolUsed: params.toolCalls.map((call) => call.name),
    fallbackTriggered: Boolean(params.fallbackTriggered),
    costEstimateUsd,
  };
}
