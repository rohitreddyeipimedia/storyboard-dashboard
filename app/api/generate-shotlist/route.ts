// app/api/generate-shotlist/route.ts
import { NextResponse } from "next/server";
import { callKimiAgent, kimiEnabled } from "@/lib/kimi";
import { HOLLYWOOD_GUIDE_TEXT } from "@/lib/hollywood-guide";
import { MetadataSchema, StructuredScriptSchema, ShotlistSchema } from "@/lib/schemas";

export const runtime = "nodejs";

/**
 * Regex helpers (Hinglish-friendly, dialogue-friendly)
 */
const RX = {
  closeUp: /\b(close-?up|cu|face|expression|eyes|reaction|stare(s|d)?|smile(s|d)?|frown(s|ed)?|annoyed|intense|confused)\b/i,
  product: /\b(product|pack|box|bottle|shoe(s)?|toothpaste|muesli|bowl)\b/i,
  insert: /\b(milk|pour|spoon|crunch|texture|detail|macro|hand|tap(s|ped)?)\b/i,
  action: /\b(bowl(ing)?|run-?up|running|walk(ing)?|rush(es|ed)?|move(s|d)?|workout|vlog(ging)?)\b/i,
  dialogueQuotes: /["“”]/,
  dialoguePrefix: /^\s*[A-Za-z][A-Za-z\s]*:\s+/,
};

function splitIntoSentences(text: string): string[] {
  const cleaned = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  // Split on . ! ? … while trying not to split inside quotes.
  const parts = cleaned
    .split(/(?<=[.!?…])\s+(?=(?:[^"“”]*["“”][^"“”]*["“”])*[^"“”]*$)/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.length ? parts : [cleaned];
}

/**
 * Ensure beats are sentence-level, even if upstream parser missed it.
 */
function normalizeStructuredScript(structured: any) {
  const scenes = (structured.scenes ?? []).map((scene: any) => {
    const expandedBeats: any[] = [];

    (scene.beats ?? []).forEach((beat: any, idx: number) => {
      const raw = String(beat.action ?? beat.text ?? "").trim();
      const sentences = splitIntoSentences(raw);

      // If no sentences, still keep a placeholder beat to maintain alignment.
      if (sentences.length === 0) {
        expandedBeats.push({
          ...beat,
          action: "",
          parent_beat_id: beat.beat_id,
          beat_id: `${beat.beat_id ?? `B${idx}`}_1`,
        });
        return;
      }

      sentences.forEach((s, j) => {
        expandedBeats.push({
          ...beat,
          action: s,
          parent_beat_id: beat.beat_id,
          beat_id: `${beat.beat_id ?? `B${idx}`}_${j + 1}`,
        });
      });
    });

    return { ...scene, beats: expandedBeats };
  });

  return { ...structured, scenes };
}

type ShotType = "WS" | "MS" | "MCU" | "CU" | "ECU" | "INSERT" | "OTS";

function getLensRationale(shotType: ShotType): string {
  const rationales: Record<ShotType, string> = {
    WS: "Spatial context, geography",
    MS: "Natural perspective, subject focus",
    MCU: "Intimacy while retaining context",
    CU: "Emotional emphasis, isolation",
    ECU: "Maximum intimacy, detail",
    INSERT: "Product detail, texture",
    OTS: "Spatial relationship, dialogue",
  };
  return rationales[shotType] ?? "Standard coverage";
}

function generateIntent(action: string): string {
  const a = action || "";
  if (RX.dialogueQuotes.test(a) || RX.dialoguePrefix.test(a)) return "Deliver dialogue / emotional beat";
  if (/\b(stares|looks|expression|reaction|confused|annoyed|smiles)\b/i.test(a)) return "Show character reaction";
  if (/\b(hold(s|ing)?|opens|present(s|ing)?|shows)\b/i.test(a) && RX.product.test(a)) return "Product showcase";
  if (RX.action.test(a)) return "Action coverage";
  return "Advance narrative";
}

function classifyShot(action: string, shotNum: number): { shotType: ShotType; lens: string; angle: string } {
  const a = action || "";
  const isCloseUp = RX.closeUp.test(a);
  const isProduct = RX.product.test(a);
  const isInsert = RX.insert.test(a);
  const isAction = RX.action.test(a);
  const isDialogue = RX.dialogueQuotes.test(a) || RX.dialoguePrefix.test(a);

  // If you ALWAYS want establishing first shot:
  if (shotNum === 1) return { shotType: "WS", lens: "24mm", angle: "eye-level" };

  // FIXED: combined condition must come BEFORE isCloseUp
  if (isProduct && (isCloseUp || isInsert)) return { shotType: "INSERT", lens: "100mm", angle: "flat" };
  if (isInsert) return { shotType: "INSERT", lens: "100mm", angle: "45°" };
  if (isCloseUp) return { shotType: "CU", lens: "85mm", angle: "eye-level" };
  if (isDialogue && !isAction) return { shotType: "MCU", lens: "50mm", angle: "eye-level" };
  if (isAction) return { shotType: "WS", lens: "24mm", angle: "low" };
  if (isProduct) return { shotType: "MCU", lens: "50mm", angle: "eye-level" };

  return { shotType: "MS", lens: "35mm", angle: "eye-level" };
}

function computeRiskFlags(action: string, shotType: ShotType): string[] {
  const a = action || "";
  const flags: string[] = [];

  const isProduct = RX.product.test(a);
  const isDialogue = RX.dialogueQuotes.test(a) || RX.dialoguePrefix.test(a);
  const isInsert = RX.insert.test(a);

  if (isProduct && shotType !== "INSERT" && shotType !== "MCU") flags.push("Product beat not framed as INSERT/MCU");
  if (isDialogue && shotType === "WS") flags.push("Dialogue in WS may reduce clarity");
  if (isInsert && shotType !== "INSERT") flags.push("Insert beat not framed as INSERT");

  return flags;
}

function generateSketchDescription(action: string, shotType: ShotType): string {
  const a = action || "";
  const subjectMatch = a.match(/\b(Arshdeep|Manager|Director|Brand Manager)\b/i);
  const subject = subjectMatch ? subjectMatch[0] : "Character";

  if (shotType === "INSERT") {
    const product = a.match(/\b(toothpaste|shoe|bottle|muesli|bowl|spoon|pack)\b/i)?.[0] || "product";
    return `Insert/macro of ${product} — clean background, soft studio lighting, crisp texture detail`;
  }
  if (shotType === "CU" || shotType === "ECU") {
    return `Close-up on ${subject}'s face — clear emotional reaction, shallow depth of field`;
  }
  if (shotType === "WS") {
    return `Wide shot of ${subject} in environment — show geography, studio/ground context`;
  }
  if (RX.dialogueQuotes.test(a) || RX.dialoguePrefix.test(a)) {
    return `Medium shot of ${subject} speaking — clean eyeline, readable expression`;
  }
  return `Medium shot of ${subject} — ${a.slice(0, 60)}${a.length > 60 ? "…" : ""}`;
}

function generateShotFromBeat(beat: any, shotNum: number, sceneId: string) {
  const action = String(beat.action ?? beat.text ?? "").trim();
  const { shotType, lens, angle } = classifyShot(action, shotNum);

  const isAction = RX.action.test(action);
  const isInsert = shotType === "INSERT";

  const movement = isAction ? "track" : isInsert ? "micro-slide" : "static";
  const support = isAction ? "dolly/gimbal" : isInsert ? "slider/tripod" : "tripod";

  return {
    shot_id: `S${String(shotNum).padStart(3, "0")}`,
    scene_id: sceneId,
    beat_id: beat.beat_id,

    shot_type: shotType,
    action, // keep full text
    intent: generateIntent(action),

    camera: {
      angle,
      height: isInsert ? "table" : "chest",
      movement,
      support,
    },

    lens: {
      mm_range: lens,
      rationale: getLensRationale(shotType),
    },

    continuity_notes: {
      line_of_action: isAction ? "Action axis maintained" : "Standard",
      eyelines: (RX.dialogueQuotes.test(action) || RX.dialoguePrefix.test(action)) ? "Match eyelines" : "N/A",
      match_action: isAction ? "Cut on action" : "N/A",
      props_wardrobe: RX.product.test(action) ? "Hero product visible" : "Check continuity",
    },

    risk_flags: computeRiskFlags(action, shotType),
    sketch_description: generateSketchDescription(action, shotType),
  };
}

function comprehensiveMockShotlist(structured: any) {
  const shots: any[] = [];
  let shotCounter = 1;

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
  const structured_script_raw = StructuredScriptSchema.parse(body.structured_script);

  // Enforce sentence-level beats here (critical).
  const structured_script = normalizeStructuredScript(structured_script_raw);

  const guideline_text = String(body.guideline_text ?? HOLLYWOOD_GUIDE_TEXT);

  const totalBeats =
    structured_script.scenes?.reduce((acc: number, s: any) => acc + (s.beats?.length || 0), 0) || 0;

  console.log(
    `Generating ${totalBeats} shots from ${structured_script.scenes?.length || 0} scenes (post-normalize)`
  );

  if (kimiEnabled()) {
    const agentId = process.env.KIMI_SHOT_DIRECTOR_AGENT_ID || "shot_director";
    const kimiPayload = {
      structured_script,
      metadata,
      guideline_text,
      instructions: `Generate EXACTLY ${totalBeats} shots — STRICT 1:1 mapping: one shot per beat/sentence. Do not merge beats. Return JSON { shots: [...] }. Include sketch_description for each shot.`,
    };

    try {
      const kimiResp = await callKimiAgent<any>({ agentId, payload: kimiPayload });
      const shotlist = ShotlistSchema.parse(kimiResp.shotlist ?? kimiResp);
      return NextResponse.json({ shotlist, mode: "kimi" });
    } catch (error) {
      console.error("Kimi failed, using deterministic fallback:", error);
      const fallback = comprehensiveMockShotlist(structured_script);
      return NextResponse.json({ shotlist: fallback, mode: "mock-enhanced" });
    }
  }

  const shotlist = ShotlistSchema.parse(comprehensiveMockShotlist(structured_script));
  return NextResponse.json({ shotlist, mode: "mock" });
}
