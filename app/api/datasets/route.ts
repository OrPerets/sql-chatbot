import { NextResponse } from "next/server";
import { addDataset, listDatasets } from "../_mock/homeworkStore";
import { generateTempId } from "@/app/homework/utils/id";
import type { Dataset } from "@/app/homework/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.toLowerCase();
  const items = listDatasets().filter((dataset) =>
    search ? dataset.name.toLowerCase().includes(search) : true,
  );

  return NextResponse.json({
    items,
    page: 1,
    totalPages: 1,
    totalItems: items.length,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const dataset: Dataset = {
    id: generateTempId("dataset"),
    name: body.name ?? "Untitled dataset",
    description: body.description,
    connectionUri: "sandbox://datasets/" + (body.name ?? "untitled"),
    previewTables: [],
    tags: body.tags ?? [],
    updatedAt: new Date().toISOString(),
  };
  addDataset(dataset);
  return NextResponse.json(dataset, { status: 201 });
}
