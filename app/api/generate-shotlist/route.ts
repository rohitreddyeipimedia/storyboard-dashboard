import { NextResponse } from "next/server";
import { callKimiAgent, kimiEnabled } from "@/lib/kimi";
import { HOLLYWOOD_GUIDE_TEXT } from "@/lib/hollywood-guide";
import { MetadataSchema, StructuredScriptSchema, ShotlistSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function generateShotFromBeat(beat: any, shotNum: number, sceneId: string): any {
  const action = beat.action || "";
  const isCloseUp = action.toLowerCase().match(/close-up|face|expression|eyes|reaction/);
  const isProduct = action.toLowerCase().match(/product|box|bottle|shoe|bowl|pack/);
  const isDialogue = action.includes('"');
  const isAction = action.toLowerCase().match(/bowling|running|walking|moving/);
  const isInsert = action.toLowerCase().match(/milk|spoon|crunch|detail|hand/);
  
  let shotType = "MS";
  let lens = "35mm";
  let angle = "eye-level";
  
  if (isCloseUp) { shotType = "CU"; lens = "85mm"; }
  else if (isProduct && isCloseUp) { shotType = "INSERT"; lens = "100mm"; angle = "flat"; }
  else if (isProduct) { shotType = "MCU"; lens = "50mm"; }
  else if (isInsert) { shotType = "INSERT"; lens = "100mm"; }
  else if (isDialogue && !isAction) { shotType = "MCU"; lens = "50mm"; }
  else if (isAction) { shotType = "WS"; lens = "24mm"; angle = "low"; }
  else if (shotNum === 1) { shotType = "WS"; lens = "24mm"; }
  
  // Generate sketch description for the storyboard frame
  const sketchDescription = generateSketchDescription(action, shotType);
  
  return {
    shot_id: `S${String(shotNum).padStart(3, "0")}`,
    scene_id: sceneId,
    beat_id: beat.beat_id,
    shot_type: shotType,
    action: action.slice(0, 150),
    intent: generateIntent(action),
    camera: { 
      angle: angle, 
      height: shotType === "INSERT" ? "table" : "chest", 
      movement: isAction ? "track" : "static", 
      support: isAction ? "dolly" : "tripod" 
    },
    lens: { 
      mm_range: lens, 
      rationale: getLensRationale(shotType) 
    },
    continuity_notes: {
      line_of_action: isAction ? "Action axis" : "Standard",
      eyelines: isDialogue ? "Match" : "N/A",
      match_action: isAction ? "Cut on action" : "N/A",
      props_wardrobe: isProduct ? "Hero product visible" : "Check continuity",
    },
    risk_flags: [],
    sketch_description: sketchDescription // For the PPT visual
  };
}

function generateSketchDescription(action: string, shotType: string): string {
  // Create a visual description for placeholder
  const subject = action.match(/(Arshdeep|Manager|Brand Manager|Director)/)?.[0] || "Character";
  
  if (shotType === "INSERT") {
    const product = action.match(/(toothpaste|shoe|bottle|muesli|bowl|spoon)/i)?.[0] || "product";
    return `Detail shot of ${product} - clean background, soft lighting, 45° angle`;
  }
  if (shotType === "CU" || shotType === "ECU") {
    return `Close-up on ${subject}'s face - emotional reaction, shallow depth of field`;
  }
  if (shotType === "WS") {
    return `Wide shot: Full body ${subject} in environment - establishing context`;
  }
  if (action.includes('"')) {
    return `Medium shot: ${subject} speaking - dialogue delivery, engaged expression`;
  }
  return `Medium close-up: ${subject} in action - ${action.slice(0, 40)}...`;
}

function generateIntent(action: string): string {
  if (action.includes('"')) return "Deliver dialogue / emotional beat";
  if (action.match(/stares|looks|expression/)) return "Show character reaction";
  if (action.match(/product|present|hold/)) return "Product showcase";
  if (action.match(/bowling|running|action/)) return "Action coverage";
  return "Advance narrative";
}

function getLensRationale(shotType: string): string {
  const rationales: Record<string, string> = {
    "WS": "Spatial context, geography",
    "MS": "Natural perspective, subject focus",
    "MCU": "Intimacy while retaining context",
    "CU": "Emotional emphasis, isolation",
    "ECU": "Maximum intimacy, detail",
    "INSERT": "Product detail, texture",
    "OTS": "Spatial relationship, dialogue"
  };
  return rationales[shotType] || "Standard coverage";
}

function comprehensiveMockShotlist(structured: any) {
  const shots: any[] = [];
  let shotCounter = 1;
  
  // Generate ONE shot per beat (sentence), not per scene
  structured.scenes?.forEach((scene: any) => {
    scene.beats?.forEach((beat: any) => {
      shots.push(generateShotFromBeat(beat, shotCounter++, scene.scene_id));
    });
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

  const totalBeats = structured_script.scenes?.reduce((acc: number, s: any) => acc + (s.beats?.length || 0), 0) || 0;
  console.log(`Generating ${totalBeats} shots from ${structured_script.scenes?.length} scenes`);

  if (kimiEnabled()) {
    const agentId = process.env.KIMI_SHOT_DIRECTOR_AGENT_ID || "shot_director";
    const kimiPayload = {
      structured_script,
      metadata,
      guideline_text,
      instructions: `Generate EXACTLY ${totalBeats} shots - one shot per beat/sentence provided. Do not combine multiple actions into one shot. Each sentence becomes one shot with specific framing. Include sketch_description for each shot describing what the storyboard frame should show.`
    };

    try {
      const kimiResp = await callKimiAgent<any>({ agentId, payload: kimiPayload });
      const shotlist = ShotlistSchema.parse(kimiResp.shotlist ?? kimiResp);
      return NextResponse.json({ shotlist, mode: "kimi" });
    } catch (error) {
      console.error("AI failed, using sentence-based mock:", error);
      return NextResponse.json({ shotlist: comprehensiveMockShotlist(structured_script), mode: "mock-enhanced" });
    }
  }

  const shotlist = ShotlistSchema.parse(comprehensiveMockShotlist(structured_script));
  return NextResponse.json({ shotlist, mode: "mock" });
}
