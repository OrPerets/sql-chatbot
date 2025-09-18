import { NextResponse } from "next/server";
import { saveDraft, type SaveHomeworkDraftPayload } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const payload = (await request.json()) as SaveHomeworkDraftPayload;
  const updated = saveDraft(params.setId, payload);
  if (!updated) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
