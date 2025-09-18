import { NextResponse } from "next/server";
import { listAnalyticsForSet } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const events = listAnalyticsForSet(params.setId);
  return NextResponse.json(events);
}
