import PptxGenJS from "pptxgenjs";
import type { Metadata, Shotlist } from "./schemas";

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/png";
    const base64 = buf.toString("base64");
    return `data:${ct};base64,${base64}`;
  } catch (e) {
    console.error("Failed to fetch image:", e);
    return null;
  }
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
    throw new Error("No shots provided");
  }

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Storyboard Dashboard";
  pptx.company = metadata.project_name || "Untitled";

  const W = 13.33;
  const colors = {
    frame: "1e293b",
    text: "f1f5f9",
    accent: "3b82f6"
  };

  // Process each shot
  for (let i = 0; i < shotlist.shots.length; i++) {
    const shot = shotlist.shots[i];
    const slide = pptx.addSlide();

    // Header
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: W, h: 0.55,
      fill: { color: "0f172a" },
    });

    slide.addText(metadata.project_name || "Storyboard", {
      x: 0.4, y: 0.15, w: 8.5, h: 0.25,
      fontFace: "Calibri", fontSize: 16, color: colors.text, bold: true,
    });

    slide.addText(`${shot.shot_id} • ${shot.shot_type}`, {
      x: 9.2, y: 0.15, w: 3.8, h: 0.25,
      fontFace: "Calibri", fontSize: 14, color: colors.accent, bold: true, align: "right",
    });

    // Storyboard Frame
    const frameX = 0.6, frameY = 0.85, frameW = 8.8, frameH = 5.4;
    
    slide.addShape(pptx.ShapeType.rect, {
      x: frameX, y: frameY, w: frameW, h: frameH,
      fill: { color: "ffffff" }, // White background for sketch
      line: { color: "334155", width: 2 },
    });

    // EMBED ACTUAL IMAGE if available
    if (shot.sketch_image_url) {
      try {
        const dataUri = await fetchImageAsDataUri(shot.sketch_image_url);
        if (dataUri) {
          slide.addImage({
            data: dataUri,
            x: frameX + 0.1,
            y: frameY + 0.1,
            w: frameW - 0.2,
            h: frameH - 0.2,
            sizing: { type: "contain", w: frameW - 0.2, h: frameH - 0.2 }
          });
        } else {
          throw new Error("Failed to load image data");
        }
      } catch (e) {
        // Fallback to text description
        slide.addText("🎨 AI SKETCH\n\n" + (shot.sketch_description || shot.action), {
          x: frameX, y: frameY + 2, w: frameW, h: 2,
          align: "center", fontSize: 14, color: colors.text, bold: true
        });
      }
    } else {
      // No image - show text placeholder
      slide.addText("STORYBOARD FRAME\n\n" + (shot.sketch_description || "Visual description pending"), {
        x: frameX, y: frameY + 2, w: frameW, h: 2,
        align: "center", fontSize: 16, color: "64748b", bold: true
      });
    }

    // Notes Panel
    const notesX = 9.6, notesY = 0.85, notesW = 3.13, notesH = 6.2;
    
    slide.addShape(pptx.ShapeType.rect, {
      x: notesX, y: notesY, w: notesW, h: notesH,
      fill: { color: "0f172a" }, line: { color: "334155" },
    });

    const camera = shot.camera || {};
    const lens = shot.lens || {};
    
    const notesText = [
      `SCENE: ${shot.scene_id}`,
      `ACTION: ${shot.action?.slice(0, 60)}${shot.action?.length > 60 ? '...' : ''}`,
      "",
      `CAMERA: ${camera.movement || "Static"} | ${camera.angle || "Eye-level"}`,
      `LENS: ${lens.mm_range || "Standard"}`,
      "",
      `INTENT: ${shot.intent || "N/A"}`
    ].join("\n");

    slide.addText(notesText, {
      x: notesX + 0.15, y: notesY + 0.15, w: notesW - 0.3, h: notesH - 0.3,
      color: colors.text, fontFace: "Calibri", fontSize: 10, valign: "top",
    });
  }

  const output = await pptx.write({ outputType: "arraybuffer" });
  return output as ArrayBuffer;
}
