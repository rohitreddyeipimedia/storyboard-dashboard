// app/api/generate-storyboard/route.ts
import { NextResponse } from "next/server";
import { buildStoryboardPptxBuffer } from "@/lib/storyboard-pptx";
import { MetadataSchema, ShotlistSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function safeFilenameBase(input: string) {
  return String(input || "Storyboard")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Expect: { shotlist: { shots: [...] }, metadata: {...} }
    const shotlist = ShotlistSchema.parse(body.shotlist);
    const metadata = MetadataSchema.parse(body.metadata ?? {});

    const pptxBuffer = await buildStoryboardPptxBuffer({ shotlist, metadata });

    // FIX: schema field is project_title (not project_name)
    const title = metadata.project_title || "Storyboard";
    const filename = `${safeFilenameBase(title)}_Storyboard.pptx`;

    return new NextResponse(pptxBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("generate-storyboard failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
