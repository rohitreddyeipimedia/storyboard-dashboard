import { NextResponse } from "next/server";
import { MetadataSchema, ShotlistSchema } from "@/lib/schemas";
import { buildStoryboardPptxBuffer } from "@/lib/storyboard-pptx";
import { callKimiAgent, kimiEnabled } from "@/lib/kimi";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.approved_shotlist) {
      return NextResponse.json({ error: "approved_shotlist is required" }, { status: 400 });
    }

    const metadata = MetadataSchema.parse(body.metadata ?? {});
    let shotlist = ShotlistSchema.parse(body.approved_shotlist);
    
    console.log("Generating storyboard for", shotlist.shots.length, "shots");

    // Optional AI enhancement
    if (kimiEnabled()) {
      try {
        const agentId = process.env.KIMI_STORYBOARD_AGENT_ID || "storyboard_artist";
        const kimiResp = await callKimiAgent<any>({ 
          agentId, 
          payload: { approved_shotlist: shotlist, metadata, sketch_style: body.sketch_style || "pencil" } 
        });
        
        if (kimiResp?.updated_shotlist?.shots) {
          shotlist = ShotlistSchema.parse(kimiResp.updated_shotlist);
        }
      } catch (aiError) {
        console.error("AI enhancement failed, using original shotlist:", aiError);
        // Continue with original shotlist if AI fails
      }
    }

    const pptxBuffer = await buildStoryboardPptxBuffer({ shotlist, metadata });
    const filename = `${(metadata.project_name || "Storyboard").replace(/[^\w\-]+/g, "_")}_Storyboard.pptx`;
    
    const uint8Array = new Uint8Array(pptxBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Storyboard generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
