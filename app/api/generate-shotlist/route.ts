import { NextResponse } from "next/server";
import { callKimiAgent, kimiEnabled } from "@/lib/kimi";
import { HOLLYWOOD_GUIDE_TEXT } from "@/lib/hollywood-guide";
import { MetadataSchema, StructuredScriptSchema, ShotlistSchema } from "@/lib/schemas";

export const runtime = "nodejs";

// Enhanced mock that generates comprehensive shots
function comprehensiveMockShotlist(structured: any) {
  const shots: any[] = [];
  let shotCounter = 1;
  
  structured.scenes?.forEach((scene: any, sceneIdx: number) => {
    const scene_id = scene.scene_id || `SC${String(sceneIdx + 1).padStart(3, "0")`;
    const beat_id = scene.beats?.[0]?.beat_id || "B001";
    const content = scene.beats?.map((b: any) => b.action).join(" ") || "";
    
    // Determine shot types based on content
    const isAction = content.toLowerCase().includes("bowling") || content.toLowerCase().includes("running");
    const isCloseUp = content.toLowerCase().includes("close-up") || content.toLowerCase().includes("face") || content.toLowerCase().includes("expression");
    const isProduct = content.toLowerCase().includes("product") || content.toLowerCase().includes("box") || content.toLowerCase().includes("bottle") || content.toLowerCase().includes("shoe");
    
    // Shot 1: Establishing/Master
    shots.push({
      shot_id: `S${String(shotCounter++).padStart(3, "0")}`,
      scene_id,
      beat_id,
      shot_type: sceneIdx === 0 ? "WS" : "MS",
      action: scene.beats?.[0]?.action?.slice(0, 100) || "Scene establishment",
      intent: "Establish geography and character positions",
      camera: { angle: "eye-level", height: "standing", movement: isAction ? "pan" : "static", support: "tripod" },
      lens: { mm_range: sceneIdx === 0 ? "24mm" : "35mm", rationale: "Context and spatial relationships" },
      continuity_notes: {
        line_of_action: "Establish 180° line",
        eyelines: "Match screen direction",
        match_action: "N/A",
        props_wardrobe: "Check continuity of hero props",
      },
      risk_flags: [],
    });
    
    // Shot 2: Character focus
    if (content.includes("Arshdeep")) {
      shots.push({
        shot_id: `S${String(shotCounter++).padStart(3, "0")}`,
        scene_id,
        beat_id,
        shot_type: "MCU",
        action: "Arshdeep reaction/performance",
        intent: "Connect audience to character emotion",
        camera: { angle: "eye-level", height: "chest", movement: "static", support: "tripod" },
        lens: { mm_range: "50mm", rationale: "Natural perspective, slight compression" },
        continuity_notes: {
          line_of_action: "Maintain screen direction",
          eyelines: "Match to OTS or previous shot",
          match_action: "N/A",
          props_wardrobe: "Consistent with master",
        },
        risk_flags: [],
      });
    }
    
    // Shot 3: Insert/CU for products or details
    if (isProduct || content.includes('"')) {
      shots.push({
        shot_id: `S${String(shotCounter++).padStart(3, "0")}`,
        scene_id,
        beat_id,
        shot_type: isProduct ? "INSERT" : "CU",
        action: isProduct ? "Product detail/reveal" : "Dialogue delivery emphasis",
        intent: isProduct ? "Highlight product features" : "Emphasize emotional beat",
        camera: { angle: "flat", height: "table", movement: "static", support: "tripod" },
        lens: { mm_range: "85mm", rationale: "Shallow depth, isolation" },
        continuity_notes: {
          line_of_action: "N/A",
          eyelines: "N/A",
          match_action: "Cut on action if applicable",
          props_wardrobe: "Hero product presentation",
        },
        risk_flags: [],
      });
    }
    
    // Shot 4: Counter shot or reverse angle
    if (content.includes("Manager") || content.includes("Brand Manager")) {
      shots.push({
        shot_id: `S${String(shotCounter++).padStart(3, "0")}`,
        scene_id,
        beat_id,
        shot_type: "OTS",
        action: "Over-the-shoulder on opposing character",
        intent: "Show spatial relationship and reaction",
        camera: { angle: "eye-level", height: "standing", movement: "static", support: "tripod" },
        lens: { mm_range: "50mm", rationale: "Match perspective" },
        continuity_notes: {
          line_of_action: "Respect established line",
          eyelines: "Match to MCU",
          match_action: "N/A",
          props_wardrobe: "Continuity check",
        },
        risk_flags: [],
      });
    }
    
    // Shot 5: Dynamic action if applicable
    if (isAction) {
      shots.push({
        shot_id: `S${String(shotCounter++).padStart(3, "0")}`,
        scene_id,
        beat_id,
        shot_type: "WS",
        action: "Action coverage - bowling/movement",
        intent: "Show physical action clearly",
        camera: { angle: "low", height: "waist", movement: "track", support: "dolly" },
        lens: { mm_range: "35mm", rationale: "Dynamic feel, context" },
        continuity_notes: {
          line_of_action: "Action axis",
          eyelines: "N/A",
          match_action: "Frame for continuity",
          props_wardrobe: "Action continuity",
        },
        risk_flags: ["safety"],
      });
    }
    
    // Shot 6: Reaction/ECU for emotional moments
    if (content.toLowerCase().includes("stares") || content.toLowerCase().includes("looks") || content.toLowerCase().includes("expression")) {
      shots.push({
        shot_id: `S${String(shotCounter++).padStart(3, "0")}`,
        scene_id,
        beat_id,
        shot_type: "ECU",
        action: "Extreme close-up on eyes/face",
        intent: "Maximum emotional impact",
        camera: { angle: "eye-level", height: "eye", movement: "static", support: "tripod" },
        lens: { mm_range: "100mm", rationale: "Intimacy, compression" },
        continuity_notes: {
          line_of_action: "N/A",
          eyelines: "Critical match",
          match_action: "N/A",
          props_wardrobe: "N/A",
        },
        risk_flags: [],
      });
    }
  });

  return { shots };
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

  // Count scenes to determine expected shot count
  const sceneCount = structured_script.scenes?.length || 0;
  const expectedShots = Math.max(20, sceneCount * 4); // At least 4 shots per scene

  if (kimiEnabled()) {
    const agentId = process.env.KIMI_SHOT_DIRECTOR_AGENT_ID || "shot_director";
    const kimiPayload = {
      structured_script,
      metadata,
      guideline_text,
      revision_notes,
      instructions: `Generate a comprehensive shotlist with APPROXIMATELY ${expectedShots} shots total. 
This script has ${sceneCount} scenes. Aim for 4-6 shots per scene for full coverage.
Include: WS/MS for masters, MCU/CU for characters, INSERTS for products, ECU for emotional beats, OTS for dialogue.
Be specific with lens choices and camera movements.`
    };

    try {
      const kimiResp = await callKimiAgent<any>({ agentId, payload: kimiPayload });
      
      // Validate we got enough shots
      const shotlist = ShotlistSchema.parse(kimiResp.shotlist ?? kimiResp);
      if (shotlist.shots.length < 10) {
        console.warn(`AI returned only ${shotlist.shots.length} shots, using comprehensive mock`);
        return NextResponse.json({ shotlist: comprehensiveMockShotlist(structured_script), mode: "mock-enhanced" });
      }
      
      return NextResponse.json({ shotlist, mode: "kimi" });
    } catch (error) {
      console.error("AI failed, falling back to comprehensive mock:", error);
      return NextResponse.json({ shotlist: comprehensiveMockShotlist(structured_script), mode: "mock-enhanced" });
    }
  }

  // Use comprehensive mock
  const shotlist = ShotlistSchema.parse(comprehensiveMockShotlist(structured_script));
  return NextResponse.json({ shotlist, mode: "mock" });
}
