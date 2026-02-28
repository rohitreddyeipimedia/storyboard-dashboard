import PptxGenJS from "pptxgenjs";
import type { Metadata, Shotlist } from "./schemas";

function pptLayout(aspect: Metadata["aspect_ratio"]) {
  return "LAYOUT_WIDE";
}

export async function buildStoryboardPptxBuffer({
  shotlist,
  metadata,
}: {
  shotlist: Shotlist;
  metadata: Metadata;
}): Promise<ArrayBuffer> {
  console.log("Building PPTX for", shotlist.shots?.length || 0, "shots");
  
  if (!shotlist.shots || shotlist.shots.length === 0) {
    throw new Error("No shots provided to generate storyboard");
  }

  const pptx = new PptxGenJS();
  pptx.layout = pptLayout(metadata.aspect_ratio);
  pptx.author = "Storyboard Dashboard";
  pptx.company = metadata.project_name || "Untitled";
  pptx.title = `${metadata.project_name} Storyboard`;

  const W = 13.33;
  const colors = {
    frame: "1e293b",
    text: "f1f5f9",
    accent: "3b82f6",
    subtext: "94a3b8"
  };

  for (let i = 0; i < shotlist.shots.length; i++) {
    const shot = shotlist.shots[i];
    const slide = pptx.addSlide();

    // Header
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: W, h: 0.55,
      fill: { color: "0f172a" },
      line: { color: "334155" },
    });

    slide.addText(`${metadata.project_name || "Storyboard"}`, {
      x: 0.4, y: 0.15, w: 8.5, h: 0.25,
      fontFace: "Calibri", fontSize: 16, color: colors.text, bold: true,
    });

    slide.addText(`${shot.shot_id} • ${shot.shot_type}`, {
      x: 9.2, y: 0.15, w: 3.8, h: 0.25,
      fontFace: "Calibri", fontSize: 14, color: colors.accent, bold: true, align: "right",
    });

    // Main Frame Box (storyboard area)
    const frameX = 0.6, frameY = 0.85, frameW = 8.8, frameH = 5.4;
    
    slide.addShape(pptx.ShapeType.rect, {
      x: frameX, y: frameY, w: frameW, h: frameH,
      fill: { color: colors.frame }, 
      line: { color: "475569", width: 2 },
    });

    // SKETCH DESCRIPTION (instead of blank "STORYBOARD FRAME")
    const sketchDesc = shot.sketch_description || shot.action || "Visual description pending";
    
    // Camera angle indicator at top of frame
    slide.addText(`${shot.camera?.angle || "Eye-level"} | ${shot.lens?.mm_range || "Standard"}`, {
      x: frameX, y: frameY + 0.1, w: frameW, h: 0.3,
      align: "center", fontSize: 10, color: colors.subtext, fontFace: "Calibri"
    });

    // Main visual description
    slide.addText(sketchDesc, {
      x: frameX + 0.3, y: frameY + 1.5, w: frameW - 0.6, h: 2.5,
      align: "center", fontSize: 14, color: colors.text, fontFace: "Calibri",
      bold: true, valign: "middle"
    });

    // Action summary below
    slide.addText(shot.action || "", {
      x: frameX + 0.3, y: frameY + 4, w: frameW - 0.6, h: 1,
      align: "center", fontSize: 11, color: colors.subtext, fontFace: "Calibri", italic: true
    });

    // Shot type badge
    slide.addShape(pptx.ShapeType.rect, {
      x: frameX + frameW - 1.2, y: frameY + 0.2, w: 1, h: 0.4,
      fill: { color: colors.accent }, line: { color: colors.accent }
    });
    slide.addText(shot.shot_type, {
      x: frameX + frameW - 1.2, y: frameY + 0.25, w: 1, h: 0.3,
      align: "center", fontSize: 12, color: "ffffff", bold: true
    });

    // Notes Panel
    const notesX = 9.6, notesY = 0.85, notesW = 3.13, notesH = 6.2;
    
    slide.addShape(pptx.ShapeType.rect, {
      x: notesX, y: notesY, w: notesW, h: notesH,
      fill: { color: "0f172a" }, line: { color: "334155" },
    });

    const camera = shot.camera || {};
    const lens = shot.lens || {};
    const continuity = shot.continuity_notes || {};
    
    const notesText = [
      `SCENE: ${shot.scene_id}`,
      shot.beat_id ? `BEAT: ${shot.beat_id}` : "",
      "",
      `ACTION:`,
      `${shot.action?.slice(0, 80) || "N/A"}${shot.action?.length > 80 ? "..." : ""}`,
      "",
      `INTENT: ${shot.intent || "N/A"}`,
      "",
      `CAMERA:`,
      `• Movement: ${camera.movement || "Static"}`,
      `• Angle: ${camera.angle || "Eye-level"}`,
      `• Support: ${camera.support || "Tripod"}`,
      "",
      `LENS: ${lens.mm_range || "Standard"}`,
      `${lens.rationale || ""}`,
      "",
      `CONTINUITY:`,
      `• ${continuity.line_of_action || "Standard"}`,
      `• Eyelines: ${continuity.eyelines || "N/A"}`,
    ].filter(Boolean).join("\n");

    slide.addText(notesText, {
      x: notesX + 0.15, y: notesY + 0.15, w: notesW - 0.3, h: notesH - 0.3,
      color: colors.text, fontFace: "Calibri", fontSize: 10, valign: "top",
    });
  }

  const output = await pptx.write({ outputType: "arraybuffer" });
  const arrayBuffer = output as ArrayBuffer;
  
  if (arrayBuffer.byteLength < 1000) {
    throw new Error("Generated PPTX is too small/empty");
  }
  
  return arrayBuffer;
}
