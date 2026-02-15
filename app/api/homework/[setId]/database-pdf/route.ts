import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { setId } = await params;
    // Read the static PDF file from the public folder
    const pdfPath = join(process.cwd(), "public", "db.pdf");
    const pdfBuffer = readFileSync(pdfPath);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="database-${setId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Failed to serve database PDF", error);
    return NextResponse.json(
      { error: error?.message || "Failed to serve database PDF" },
      { status: 500 },
    );
  }
}
