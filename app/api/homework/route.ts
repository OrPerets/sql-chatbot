import { NextResponse } from "next/server";
import {
  createHomework,
  listHomeworkSets,
  type SaveHomeworkDraftPayload,
} from "../_mock/homeworkStore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.getAll("status");
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");

  const result = listHomeworkSets({
    status: status.length ? (status as any) : undefined,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as SaveHomeworkDraftPayload;
  const created = createHomework(payload);
  return NextResponse.json(created, { status: 201 });
}
