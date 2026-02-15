import { NextResponse } from "next/server";
import { listAnalyticsForSet } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { setId } = await params;
  const events = listAnalyticsForSet(setId);
  return NextResponse.json(events);
}
