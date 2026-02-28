import { NextResponse } from "next/server";
import { MetadataSchema, ShotlistSchema } from "@/lib/schemas";
import { buildStoryboardPptxBuffer } from "@/lib/storyboard-pptx";
import { callKimiAgent, kimiEnabled } from "@/lib/kimi";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.approved_shotlist) {
    return NextResponse.json({ error: "approved_shotlist is required" }, { status: 400 });
  }

  const metadata = MetadataSchema.parse(body.metadata ?? {});
  let shotlist = ShotlistSchema.parse(body.approved_shotlist);
  const sketch_style = String(body.sketch_style ?? "pencil");

  if (kimiEnabled()) {
    const agentId = process.env.KIMI_STORYBOARD_AGENT_ID || "storyboard_artist";
    const kimiPayload = { approved_shotlist: shotlist, metadata, sketch_style };

    const kimiResp = await callKimiAgent<any>({ agentId, payload: kimiPayload });

    if (kimiResp?.updated_shotlist) {
      shotlist = ShotlistSchema.parse(kimiResp.updated_shotlist);
    }
  }

  const pptxBuf = await buildStoryboardPptxBuffer({ shotlist, metadata });
  const filename = `${metadata.project_name.replace(/[^\w\-]+/g, "_")}_Storyboard.pptx`;
  
  // Convert Buffer to Uint8Array for NextResponse compatibility
  const uint8Array = new Uint8Array(pptxBuf);

  return new NextResponse(uint8Array, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
