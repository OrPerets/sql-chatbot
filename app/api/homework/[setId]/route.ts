import { NextResponse } from "next/server";
import {
  getHomework,
  publishHomeworkSet,
  saveDraft,
  updateHomework,
  type SaveHomeworkDraftPayload,
} from "../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const record = getHomework(params.setId);
  if (!record) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const payload = (await request.json()) as Partial<SaveHomeworkDraftPayload> & { published?: boolean };
  if (typeof payload.published === "boolean") {
    const result = publishHomeworkSet(params.setId, payload.published);
    if (!result) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  const updated = updateHomework(params.setId, payload);
  if (!updated) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function POST(request: Request, { params }: RouteParams) {
  const payload = (await request.json()) as SaveHomeworkDraftPayload;
  const updated = saveDraft(params.setId, payload);
  if (!updated) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
