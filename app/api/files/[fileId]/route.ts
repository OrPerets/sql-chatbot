import { openai } from "@/app/openai";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

// download file by file ID
export async function GET(_request: Request, context: RouteContext) {
  const { fileId } = await context.params;
  const [file, fileContent] = await Promise.all([
    openai.files.retrieve(fileId),
    openai.files.content(fileId),
  ]);
  return new Response(fileContent.body, {
    headers: {
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
