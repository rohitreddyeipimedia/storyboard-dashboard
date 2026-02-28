import { NextResponse } from "next/server";
import { callKimiAgent, kimiEnabled } from "@/lib/kimi";
import { HOLLYWOOD_GUIDE_TEXT } from "@/lib/hollywood-guide";
import { MetadataSchema, StructuredScriptSchema, ShotlistSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function mockShotlist(structured: any) {
  const scene = structured.scenes?.[0];
  const scene_id = scene?.scene_id || "SC001";
  const beat_id = scene?.beats?.[0]?.beat_id || "B001";

  return {
    shots: [
      {
        shot_id: "S001",
        scene_id,
        beat_id,
        shot_type: "WS",
        action: "Establish the scene and character positions clearly.",
        intent: "Orient viewer + set tone.",
        camera: { angle: "eye-level", height: "standing", movement: "locked-off", support: "tripod" },
        lens: { mm_range: "24–28mm", rationale: "Spatial context and clarity." },
        continuity_notes: {
          line_of_action: "Define line; keep screen direction consistent.",
          eyelines: "Consistent eyelines to counterpart/object.",
          match_action: "N/A",
          props_wardrobe: "Track hero prop consistency.",
        },
        risk_flags: ["none"],
      },
      {
        shot_id: "S002",
        scene_id,
        beat_id,
        shot_type: "CU",
        action: "Close-up on key detail/gesture that drives the beat.",
        intent: "Increase emotional proximity and focus attention.",
        camera: { angle: "slight high", height: "chest", movement: "slow push-in", support: "dolly" },
        lens: { mm_range: "50–85mm", rationale: "Intimacy + separation." },
        continuity_notes: {
          line_of_action: "Stay same side of line.",
          eyelines: "N/A (insert).",
          match_action: "Cut on motion.",
          props_wardrobe: "Same hand/side for continuity.",
        },
        risk_flags: ["none"],
      },
    ],
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.structured_script) {
    return NextResponse.json({ error: "structured_script is required" }, { status: 400 });
  }

  const metadata = MetadataSchema.parse(body.metadata ?? {});
  const structured_script = StructuredScriptSchema.parse(body.structured_script);
  const guideline_text = String(body.guideline_text ?? HOLLYWOOD_GUIDE_TEXT);
  const revision_notes = body.revision_notes ?? undefined;

  if (kimiEnabled()) {
    const agentId = process.env.KIMI_SHOT_DIRECTOR_AGENT_ID || "shot_director";
    const kimiPayload = {
      structured_script,
      metadata,
      guideline_text,
      revision_notes,
    };

    const kimiResp = await callKimiAgent<any>({ agentId, payload: kimiPayload });
    const shotlist = ShotlistSchema.parse(kimiResp.shotlist ?? kimiResp);
    return NextResponse.json({ shotlist, mode: "kimi" });
  }

  const shotlist = ShotlistSchema.parse(mockShotlist(structured_script));
  return NextResponse.json({ shotlist, mode: "mock" });
}
