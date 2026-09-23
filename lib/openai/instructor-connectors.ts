import { COLLECTIONS, executeWithRetry } from "@/lib/database";
import { getOpenAIFeatureFlag } from "@/lib/openai/feature-flags";

export type InstructorConnectorCapabilityId =
  | "google_drive"
  | "gmail"
  | "google_calendar"
  | "google_sheets_tabular"
  | "gradebook"
  | "lms_exports"
  | "content_registry";

export type InstructorConnectorDelivery =
  | "openai_connector"
  | "official_remote_mcp"
  | "internal_wrapper";

export type InstructorConnectorStatus =
  | "ready"
  | "missing_authorization"
  | "disabled"
  | "feature_flag_disabled";

type InstructorConnectorManifestEntry = {
  id: InstructorConnectorCapabilityId;
  label: string;
  serverLabel: string;
  delivery: InstructorConnectorDelivery;
  connectorId?: string;
  authEnvVar?: string;
  authEnvVarAliasFor?: InstructorConnectorCapabilityId;
  readOnly: true;
  defaultEnabled: boolean;
  allowedTools: string[];
  useCases: string[];
  notes: string[];
  oauthScopes: string[];
  implementationDecision: string;
};

type InstructorConnectorConfigDoc = {
  key: string;
  value?: {
    connectors?: Partial<
      Record<
        InstructorConnectorCapabilityId,
        {
          enabled?: boolean;
        }
      >
    >;
  };
  updatedAt?: Date;
  updatedBy?: string;
};

export type InstructorConnectorCapability = {
  id: InstructorConnectorCapabilityId;
  label: string;
  serverLabel: string;
  delivery: InstructorConnectorDelivery;
  connectorId?: string;
  readOnly: true;
  allowedTools: string[];
  useCases: string[];
  notes: string[];
  oauthScopes: string[];
  implementationDecision: string;
  enabled: boolean;
  featureFlagEnabled: boolean;
  authConfigured: boolean;
  status: InstructorConnectorStatus;
  statusDetail: string;
  authEnvVar?: string;
};

type McpConnectorTool = {
  type: "mcp";
  server_label: string;
  connector_id: string;
  authorization: string;
  require_approval: "never";
  allowed_tools: string[];
  server_description: string;
};

const CONNECTOR_CONFIG_KEY = "responses_instructor_connector_config";

const FIRST_WAVE_CONNECTORS: InstructorConnectorManifestEntry[] = [
  {
    id: "gradebook",
    label: "Internal Gradebook Adapter",
    serverLabel: "Internal Gradebook",
    delivery: "official_remote_mcp",
    authEnvVar: "INTERNAL_MCP_GRADEBOOK_TOKEN",
    readOnly: true,
    defaultEnabled: true,
    allowedTools: ["lookup_student_grades", "lookup_assignment_grades", "lookup_rubric_snapshots"],
    useCases: ["grading lookup", "assignment score checks", "rubric audit support"],
    notes: [
      "Remote MCP adapter for internal gradebook services.",
      "Read-only in Sprint 2 with per-role allowlist enforcement.",
    ],
    oauthScopes: ["gradebook.read"],
    implementationDecision:
      "Official remote MCP adapter for gradebook system in dynamic tool-search rollout.",
  },
  {
    id: "lms_exports",
    label: "LMS Export Adapter",
    serverLabel: "LMS Exports",
    delivery: "official_remote_mcp",
    authEnvVar: "INTERNAL_MCP_LMS_EXPORTS_TOKEN",
    readOnly: true,
    defaultEnabled: true,
    allowedTools: ["fetch_course_export", "fetch_assignment_export", "search_lms_announcements"],
    useCases: ["LMS exports", "submission snapshots", "course operations"],
    notes: [
      "Remote MCP adapter for LMS export bundles.",
      "Restricted to instructor/admin contexts.",
    ],
    oauthScopes: ["lms.read"],
    implementationDecision:
      "Official remote MCP adapter for LMS exports to avoid hardcoded API coupling in routes.",
  },
  {
    id: "content_registry",
    label: "Content Registry Adapter",
    serverLabel: "Content Registry",
    delivery: "official_remote_mcp",
    authEnvVar: "INTERNAL_MCP_CONTENT_REGISTRY_TOKEN",
    readOnly: true,
    defaultEnabled: true,
    allowedTools: ["search_content", "fetch_content_version", "list_registry_modules"],
    useCases: ["content registry", "module metadata", "version audit"],
    notes: [
      "Remote MCP adapter for canonical content metadata.",
      "Use to ground admin investigations and rubric context checks.",
    ],
    oauthScopes: ["content_registry.read"],
    implementationDecision:
      "Official remote MCP adapter for content registry discovery and provenance checks.",
  },
  {
    id: "google_drive",
    label: "Google Drive",
    serverLabel: "Google Drive",
    delivery: "openai_connector",
    connectorId: "connector_googledrive",
    authEnvVar: "OPENAI_CONNECTOR_GOOGLE_DRIVE_TOKEN",
    readOnly: true,
    defaultEnabled: true,
    allowedTools: ["search", "fetch", "recent_documents"],
    useCases: ["lecture PDFs", "course notes", "shared instructor folders", "reference docs"],
    notes: [
      "Preferred source for canonical instructor-managed documents outside the app vector store.",
      "Use only for search and targeted fetches, not bulk document dumping.",
    ],
    oauthScopes: ["drive.readonly"],
    implementationDecision:
      "OpenAI connector via Responses API mcp tool because Google Drive is listed as a built-in connector.",
  },
  {
    id: "gmail",
    label: "Gmail",
    serverLabel: "Gmail",
    delivery: "openai_connector",
    connectorId: "connector_gmail",
    authEnvVar: "OPENAI_CONNECTOR_GMAIL_TOKEN",
    readOnly: true,
    defaultEnabled: true,
    allowedTools: ["search_emails", "get_recent_emails", "read_email", "batch_read_email"],
    useCases: ["student clarifications", "staff announcements", "course operations email lookup"],
    notes: [
      "Use for retrieval only. Do not draft or send emails from Michael in Sprint 2.",
      "Summaries should minimize quoted email content and avoid forwarding personal data.",
    ],
    oauthScopes: ["gmail.modify"],
    implementationDecision:
      "OpenAI connector via Responses API mcp tool because Gmail is listed as a built-in connector.",
  },
  {
    id: "google_calendar",
    label: "Google Calendar",
    serverLabel: "Google Calendar",
    delivery: "openai_connector",
    connectorId: "connector_googlecalendar",
    authEnvVar: "OPENAI_CONNECTOR_GOOGLE_CALENDAR_TOKEN",
    readOnly: true,
    defaultEnabled: true,
    allowedTools: ["search_events", "read_event"],
    useCases: ["deadline lookup", "office hours", "teaching schedule checks"],
    notes: [
      "Keep usage read-only and scoped to the requested date window.",
      "Preferred source for instructor schedule and deadline verification.",
    ],
    oauthScopes: ["calendar.events"],
    implementationDecision:
      "OpenAI connector via Responses API mcp tool because Google Calendar is listed as a built-in connector.",
  },
  {
    id: "google_sheets_tabular",
    label: "Google Sheets / Drive Tabular Inputs",
    serverLabel: "Google Drive",
    delivery: "internal_wrapper",
    authEnvVar: "OPENAI_CONNECTOR_GOOGLE_DRIVE_TOKEN",
    authEnvVarAliasFor: "google_drive",
    readOnly: true,
    defaultEnabled: true,
    allowedTools: ["search", "fetch", "recent_documents"],
    useCases: ["rubrics", "gradebook snapshots", "CSV/Sheets reference tables"],
    notes: [
      "Implemented through the Google Drive connector plus prompt rules for spreadsheet and CSV retrieval.",
      "Use targeted fetches of specific Sheets/CSV files instead of broad Drive browsing.",
    ],
    oauthScopes: ["drive.readonly"],
    implementationDecision:
      "Internal wrapper policy on top of the Google Drive connector because there is no separate Google Sheets connector in the current OpenAI connector list.",
  },
];

function readConnectorToken(entry: InstructorConnectorManifestEntry): string {
  const envVar =
    entry.authEnvVarAliasFor
      ? FIRST_WAVE_CONNECTORS.find((candidate) => candidate.id === entry.authEnvVarAliasFor)?.authEnvVar
      : entry.authEnvVar;

  if (!envVar) {
    return "";
  }

  return String(process.env[envVar] || "").trim();
}

function buildDefaultConfig() {
  return Object.fromEntries(
    FIRST_WAVE_CONNECTORS.map((entry) => [entry.id, { enabled: entry.defaultEnabled }])
  ) as Record<InstructorConnectorCapabilityId, { enabled: boolean }>;
}

async function readConnectorConfig(): Promise<InstructorConnectorConfigDoc | null> {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  return executeWithRetry(async (db) => {
    const doc = await db.collection(COLLECTIONS.SEMESTER_CONFIG).findOne({
      key: CONNECTOR_CONFIG_KEY,
    });
    return (doc as unknown as InstructorConnectorConfigDoc | null) || null;
  });
}

function mergeConnectorConfig(
  configDoc: InstructorConnectorConfigDoc | null
): Record<InstructorConnectorCapabilityId, { enabled: boolean }> {
  const defaults = buildDefaultConfig();
  const stored = configDoc?.value?.connectors || {};

  return Object.fromEntries(
    FIRST_WAVE_CONNECTORS.map((entry) => [
      entry.id,
      {
        enabled:
          typeof stored[entry.id]?.enabled === "boolean"
            ? Boolean(stored[entry.id]?.enabled)
            : defaults[entry.id].enabled,
      },
    ])
  ) as Record<InstructorConnectorCapabilityId, { enabled: boolean }>;
}

export async function updateInstructorConnectorCapability(params: {
  connectorId: InstructorConnectorCapabilityId;
  enabled: boolean;
  updatedBy?: string;
}) {
  const mergedConfig = await executeWithRetry(async (db) => {
    const collection = db.collection(COLLECTIONS.SEMESTER_CONFIG);
    const currentDoc = (await collection.findOne({
      key: CONNECTOR_CONFIG_KEY,
    })) as unknown as InstructorConnectorConfigDoc | null;
    const currentConfig = mergeConnectorConfig(currentDoc);

    currentConfig[params.connectorId] = {
      enabled: Boolean(params.enabled),
    };

    await collection.updateOne(
      { key: CONNECTOR_CONFIG_KEY },
      {
        $set: {
          key: CONNECTOR_CONFIG_KEY,
          value: {
            connectors: currentConfig,
          },
          updatedAt: new Date(),
          updatedBy: params.updatedBy || "admin-model-management",
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    const updatedDoc = (await collection.findOne({
      key: CONNECTOR_CONFIG_KEY,
    })) as unknown as InstructorConnectorConfigDoc | null;

    return mergeConnectorConfig(updatedDoc);
  });

  return {
    connectorId: params.connectorId,
    enabled: mergedConfig[params.connectorId].enabled,
  };
}

function resolveStatus(params: {
  featureFlagEnabled: boolean;
  enabled: boolean;
  authConfigured: boolean;
}): Pick<InstructorConnectorCapability, "status" | "statusDetail"> {
  if (!params.featureFlagEnabled) {
    return {
      status: "feature_flag_disabled",
      statusDetail: "Connector rollout is disabled by FEATURE_OPENAI_CONNECTORS.",
    };
  }

  if (!params.enabled) {
    return {
      status: "disabled",
      statusDetail: "Connector is disabled in the instructor integration manifest.",
    };
  }

  if (!params.authConfigured) {
    return {
      status: "missing_authorization",
      statusDetail: "OAuth access token is not configured for this connector.",
    };
  }

  return {
    status: "ready",
    statusDetail: "Ready for read-only instructor/admin use.",
  };
}

export async function getInstructorConnectorCapabilities(): Promise<InstructorConnectorCapability[]> {
  const featureFlagEnabled = getOpenAIFeatureFlag("FEATURE_OPENAI_CONNECTORS");
  const config = mergeConnectorConfig(await readConnectorConfig());

  return FIRST_WAVE_CONNECTORS.map((entry) => {
    const authConfigured = readConnectorToken(entry).length > 0;
    const enabled = Boolean(config[entry.id]?.enabled);
    const status = resolveStatus({
      featureFlagEnabled,
      enabled,
      authConfigured,
    });

    return {
      id: entry.id,
      label: entry.label,
      serverLabel: entry.serverLabel,
      delivery: entry.delivery,
      connectorId: entry.connectorId,
      readOnly: entry.readOnly,
      allowedTools: entry.allowedTools,
      useCases: entry.useCases,
      notes: entry.notes,
      oauthScopes: entry.oauthScopes,
      implementationDecision: entry.implementationDecision,
      enabled,
      featureFlagEnabled,
      authConfigured,
      authEnvVar: entry.authEnvVar,
      ...status,
    };
  });
}

export async function buildInstructorConnectorTools(): Promise<McpConnectorTool[]> {
  const capabilities = await getInstructorConnectorCapabilities();
  const readyConnectorEntries = capabilities.filter(
    (entry) =>
      entry.status === "ready" &&
      entry.delivery === "openai_connector" &&
      entry.connectorId
  );

  return readyConnectorEntries.map((entry) => ({
    type: "mcp",
    server_label: entry.serverLabel,
    connector_id: entry.connectorId as string,
    authorization: readConnectorToken(
      FIRST_WAVE_CONNECTORS.find((candidate) => candidate.id === entry.id)!
    ),
    require_approval: "never",
    allowed_tools: entry.allowedTools,
    server_description: `${entry.label} read-only instructor connector`,
  }));
}

export async function buildInstructorConnectorPromptRules(): Promise<string> {
  const readyCapabilities = (await getInstructorConnectorCapabilities()).filter(
    (entry) => entry.status === "ready"
  );

  if (!readyCapabilities.length) {
    return "";
  }

  const lines = readyCapabilities.map(
    (entry) => `- ${entry.label}: ${entry.useCases.join(", ")}`
  );

  return `[INSTRUCTOR CONNECTOR POLICY]
Read-only remote sources are available for instructor/admin workflows:
${lines.join("\n")}

Data minimization rules:
- Prefer internal file search and existing course data when they already answer the question.
- Use the narrowest connector possible and only the minimum tool needed.
- Do not send student-sensitive data, raw submissions, grades, student IDs, or personal notes to a connector unless the request explicitly requires that context.
- Summarize retrieved material instead of copying full emails or documents when a short answer is sufficient.
- Never use connector data to make grading decisions or override canonical course policy stored inside Michael.
- When connector data is used, mention the source label exactly as exposed by the tool, such as Google Drive, Gmail, or Google Calendar.`;
}

export async function listInstructorConnectorCapabilities() {
  const capabilities = await getInstructorConnectorCapabilities();

  return {
    success: true,
    capabilities,
    recommendation:
      "Sprint 2 uses OpenAI-maintained connectors for Google Drive, Gmail, and Google Calendar, plus a Drive-backed wrapper strategy for tabular files.",
    dataMinimizationRules: [
      "Prefer read-only lookups and targeted fetches.",
      "Do not send student-sensitive data unless the request truly requires it.",
      "Prefer internal course files over remote connectors when they already answer the question.",
    ],
  };
}
