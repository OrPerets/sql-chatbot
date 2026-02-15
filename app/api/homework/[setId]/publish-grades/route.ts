import { NextResponse } from "next/server";
import { publishGradesForSet } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { setId } = await params;
  const result = publishGradesForSet(setId);
  return NextResponse.json(result);
}
