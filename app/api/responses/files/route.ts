import { openai } from "@/app/openai";
import { getOpenAIApiMode } from "@/lib/openai/api-mode";
import { getOrCreateAppVectorStoreId } from "@/lib/openai/vector-store";

export const runtime = "nodejs";

type RouteRequest = Request & {
  formData?: () => Promise<FormData>;
};

export async function POST(request: RouteRequest) {
  const mode = getOpenAIApiMode();
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ mode, error: "file is required." }, { status: 400 });
    }

    const vectorStoreId = await getOrCreateVectorStore();
    const openaiFile = await openai.files.create({
      file: file as any,
      purpose: "assistants",
    });

    await openai.vectorStores.files.create(vectorStoreId, {
      file_id: openaiFile.id,
    });

    return Response.json({ mode, fileId: openaiFile.id, vectorStoreId });
  } catch (error: any) {
    return Response.json(
      {
        mode,
        error: error?.message || "Failed to upload file.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const mode = getOpenAIApiMode();
  try {
    const vectorStoreId = await getOrCreateVectorStore();
    const fileList = await openai.vectorStores.files.list(vectorStoreId);

    const filesArray = await Promise.all(
      fileList.data.map(async (file) => {
        const fileDetails = await openai.files.retrieve(file.id);
        const vectorFileDetails = await openai.vectorStores.files.retrieve(
          vectorStoreId,
          file.id
        );
        return {
          file_id: file.id,
          filename: fileDetails.filename,
          status: vectorFileDetails.status,
        };
      })
    );

    return Response.json({ mode, files: filesArray, vectorStoreId });
  } catch (error: any) {
    return Response.json(
      {
        mode,
        error: error?.message || "Failed to list files.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const mode = getOpenAIApiMode();
  try {
    const body = await request.json();
    const fileId = body?.fileId;

    if (!fileId) {
      return Response.json({ mode, error: "fileId is required." }, { status: 400 });
    }

    const vectorStoreId = await getOrCreateVectorStore();
    await openai.vectorStores.files.del(vectorStoreId, fileId);

    return Response.json({ mode, deleted: true, fileId, vectorStoreId });
  } catch (error: any) {
    return Response.json(
      {
        mode,
        error: error?.message || "Failed to delete file.",
      },
      { status: 500 }
    );
  }
}

async function getOrCreateVectorStore() {
  return getOrCreateAppVectorStoreId();
}
