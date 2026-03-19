import { openai } from "@/app/openai";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

function isPdfFile(file: File) {
  const fileName = file.name.toLowerCase();
  return file.type === "application/pdf" || fileName.endsWith(".pdf");
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "file is required." }, { status: 400 });
    }

    if (!isPdfFile(file)) {
      return Response.json({ error: "Only PDF files are supported on this page." }, { status: 400 });
    }

    const uploaded = await openai.files.create({
      file,
      purpose: "assistants",
    });

    return Response.json({
      fileId: uploaded.id,
      filename: uploaded.filename,
      bytes: uploaded.bytes,
      purpose: uploaded.purpose,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return Response.json(
      {
        error: error?.message || "Failed to upload PDF.",
      },
      { status }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const fileId = typeof body?.fileId === "string" ? body.fileId.trim() : "";

    if (!fileId) {
      return Response.json({ error: "fileId is required." }, { status: 400 });
    }

    await openai.files.delete(fileId);
    return Response.json({ deleted: true, fileId });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return Response.json(
      {
        error: error?.message || "Failed to delete PDF.",
      },
      { status }
    );
  }
}
