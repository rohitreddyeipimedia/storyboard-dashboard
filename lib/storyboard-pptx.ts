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

  for (let i = 0; i < shotlist.shots.length; i++) {
    const shot = shotlist.shots[i];
    console.log(`Processing slide ${i + 1}: ${shot.shot_id}`);
    
    try {
      const slide = pptx.addSlide();

      // Header
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: W, h: 0.55,
        fill: { color: "111827" },
        line: { color: "111827" },
      });

      slide.addText(metadata.project_name || "Storyboard", {
        x: 0.4, y: 0.15, w: 8.5, h: 0.25,
        fontFace: "Calibri", fontSize: 16, color: "FFFFFF", bold: true,
      });

      slide.addText(`${shot.shot_id} • ${shot.shot_type || "SHOT"}`, {
        x: 9.2, y: 0.15, w: 3.8, h: 0.25,
        fontFace: "Calibri", fontSize: 14, color: "93C5FD", bold: true, align: "right",
      });

      // Frame
      const frameX = 0.6, frameY = 0.85, frameW = 8.8, frameH = 5.4;
      
      slide.addShape(pptx.ShapeType.roundRect, {
        x: frameX, y: frameY, w: frameW, h: frameH,
        fill: { color: "0B1220" }, line: { color: "334155" },
      });

      // Placeholder text in frame
      slide.addText("STORYBOARD FRAME\n" + (shot.action || "").slice(0, 100), {
        x: frameX, y: frameY + 2, w: frameW, h: 1.5,
        color: "475569", fontFace: "Calibri", fontSize: 16, bold: true, align: "center",
      });

      // Notes panel
      const notesX = 9.6, notesY = 0.85, notesW = 3.13, notesH = 6.2;
      
      slide.addShape(pptx.ShapeType.roundRect, {
        x: notesX, y: notesY, w: notesW, h: notesH,
        fill: { color: "0F172A" }, line: { color: "334155" },
      });

      // Safely build notes text
      const camera = shot.camera || {};
      const lens = shot.lens || {};
      const continuity = shot.continuity_notes || {};
      
      const notesText = [
        `Scene: ${shot.scene_id || "N/A"}`,
        shot.beat_id ? `Beat: ${shot.beat_id}` : "",
        "",
        `Action: ${shot.action || "N/A"}`,
        "",
        `Intent: ${shot.intent || "N/A"}`,
        "",
        `Camera: ${camera.movement || "Static"} | ${camera.angle || "Eye-level"}`,
        `Lens: ${lens.mm_range || "Standard"}`,
        "",
        `Continuity: ${continuity.line_of_action || "Standard"}`,
        `Eyelines: ${continuity.eyelines || "Match"}`,
      ].filter(Boolean).join("\n");

      slide.addText(notesText, {
        x: notesX + 0.2, y: notesY + 0.2, w: notesW - 0.4, h: notesH - 0.4,
        color: "E5E7EB", fontFace: "Calibri", fontSize: 12, valign: "top",
      });
      
    } catch (slideError) {
      console.error(`Error creating slide ${i}:`, slideError);
    }
  }

  console.log("Writing PPTX...");
  const output = await pptx.write({ outputType: "arraybuffer" });
  console.log("PPTX generated, size:", output.byteLength);
  
  if (output.byteLength < 1000) {
    throw new Error("Generated PPTX is too small/empty");
  }
  
  return output as ArrayBuffer;
}
