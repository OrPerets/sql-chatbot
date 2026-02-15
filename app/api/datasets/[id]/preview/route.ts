import { NextResponse } from "next/server";
import { getDatasetById } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const dataset = getDatasetById(id);
  if (!dataset) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(dataset);
}
