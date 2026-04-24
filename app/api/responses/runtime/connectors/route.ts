import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import {
  getInstructorConnectorCapabilities,
  type InstructorConnectorCapabilityId,
  updateInstructorConnectorCapability,
} from "@/lib/openai/instructor-connectors";

export const runtime = "nodejs";

type UpdateConnectorPayload = {
  connectorId?: string;
  enabled?: boolean;
};

function isConnectorId(value: string): value is InstructorConnectorCapabilityId {
  return [
    "google_drive",
    "gmail",
    "google_calendar",
    "google_sheets_tabular",
    "gradebook",
    "lms_exports",
    "content_registry",
  ].includes(value);
}

export async function PATCH(request: Request) {
  try {
    const { email } = await requireAdmin(request);
    const body = ((await request.json().catch(() => ({}))) || {}) as UpdateConnectorPayload;

    if (!body.connectorId || !isConnectorId(body.connectorId)) {
      return NextResponse.json(
        { success: false, error: "Valid connectorId is required." },
        { status: 400 }
      );
    }

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Boolean enabled value is required." },
        { status: 400 }
      );
    }

    await updateInstructorConnectorCapability({
      connectorId: body.connectorId,
      enabled: body.enabled,
      updatedBy: email,
    });

    return NextResponse.json({
      success: true,
      connectorId: body.connectorId,
      enabled: body.enabled,
      capabilities: await getInstructorConnectorCapabilities(),
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update connector config.",
      },
      { status: 500 }
    );
  }
}
