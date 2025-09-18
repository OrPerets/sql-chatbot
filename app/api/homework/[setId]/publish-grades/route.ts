import { NextResponse } from "next/server";
import { publishGradesForSet } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  const result = publishGradesForSet(params.setId);
  return NextResponse.json(result);
}
