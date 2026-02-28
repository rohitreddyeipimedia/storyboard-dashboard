import PptxGenJS from "pptxgenjs";
import type { Metadata, Shotlist } from "./schemas";

function pptLayout(aspect: Metadata["aspect_ratio"]) {
  return "LAYOUT_WIDE";
}

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/png";
    const base64 = buf.toString("base64");
    return `data:${ct};base64,${base64}`;
  } catch {
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
  const pptx = new PptxGenJS();
  pptx.layout = pptLayout(metadata.aspect_ratio);

  pptx.author = "Storyboard Dashboard";
  pptx.company = metadata.project_name;

  const W = 13.33;
  const H = 7.5;

  for (const shot of shotlist.shots) {
    const slide = pptx.addSlide();

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: W,
      h: 0.55,
      fill: { color: "111827" },
      line: { color: "111827" },
    });

    slide.addText(`${metadata.project_name}`, {
      x: 0.4,
      y: 0.15,
      w: 8.5,
      h: 0.25,
      fontFace: "Calibri",
      fontSize: 16,
      color: "FFFFFF",
      bold: true,
    });

    slide.addText(`${shot.shot_id} • ${shot.shot_type}`, {
      x: 9.2,
      y: 0.15,
      w: 3.8,
      h: 0.25,
      fontFace: "Calibri",
      fontSize: 14,
      color: "93C5FD",
      bold: true,
      align: "right",
    });

    const frameX = 0.6;
    const frameY = 0.85;
    const frameW = 8.8;
    const frameH = 5.4;

    slide.addShape(pptx.ShapeType.roundRect, {
      x: frameX,
      y: frameY,
      w: frameW,
      h: frameH,
      fill: { color: "0B1220" },
      line: { color: "334155" },
    });

    if (shot.sketch_image_url) {
      const dataUri = await fetchImageAsDataUri(shot.sketch_image_url);
      if (dataUri) {
        slide.addImage({
          data: dataUri,
          x: frameX + 0.1,
          y: frameY + 0.1,
          w: frameW - 0.2,
          h: frameH - 0.2,
        });
      } else {
        slide.addText("Sketch image unavailable (fetch failed).", {
          x: frameX + 0.3,
          y: frameY + 2.6,
          w: frameW - 0.6,
          h: 0.3,
          color: "CBD5E1",
          fontFace: "Calibri",
          fontSize: 14,
          align: "center",
        });
      }
    } else {
      slide.addText("STORYBOARD FRAME", {
        x: frameX,
        y: frameY + 2.5,
        w: frameW,
        h: 0.5,
        color: "475569",
        fontFace: "Calibri",
        fontSize: 20,
        bold: true,
        align: "center",
      });
    }

    const notesX = 9.6;
    const notesY = 0.85;
    const notesW = 3.13;
    const notesH = 6.2;

    slide.addShape(pptx.ShapeType.roundRect, {
      x: notesX,
      y: notesY,
      w: notesW,
      h: notesH,
      fill: { color: "0F172A" },
      line: { color: "334155" },
    });

    const notes = [
      `Scene: ${shot.scene_id}`,
      shot.beat_id ? `Beat: ${shot.beat_id}` : "",
      "",
      `Action: ${shot.action}`,
      "",
      `Intent: ${shot.intent}`,
      "",
      `Cam: ${shot.camera.movement || ""}`,
      `Angle: ${shot.camera.angle || ""}`,
      `Lens: ${shot.lens.mm_range || ""}`,
      "",
      `Continuity: ${shot.continuity_notes.line_of_action || ""}`,
      `Eyelines: ${shot.continuity_notes.eyelines || ""}`,
    ]
      .filter(Boolean)
      .join("\n");

    slide.addText(notes, {
      x: notesX + 0.2,
      y: notesY + 0.2,
      w: notesW - 0.4,
      h: notesH - 0.4,
      color: "E5E7EB",
      fontFace: "Calibri",
      fontSize: 12,
      valign: "top",
    });
  }

  const output = await pptx.write({ outputType: "arraybuffer" });
  return output as ArrayBuffer;
}
