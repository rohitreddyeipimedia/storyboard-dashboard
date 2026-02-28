// lib/storyboard-pptx.ts
import PptxGenJS from "pptxgenjs";
import type { Metadata, Shotlist } from "@/lib/schemas";

type BuildArgs = {
  shotlist: Shotlist;
  metadata: Metadata;
};

function safeText(input: unknown, fallback: string) {
  const s = String(input ?? "").trim();
  return s.length ? s : fallback;
}

function setLayoutFromAspect(pptx: PptxGenJS, aspect: Metadata["aspect_ratio"]) {
  if (aspect === "9:16") {
    pptx.layout = "LAYOUT_A4";
  } else {
    pptx.layout = "LAYOUT_WIDE";
  }
}

export async function buildStoryboardPptxBuffer({ shotlist, metadata }: BuildArgs): Promise<Buffer> {
  const pptx = new PptxGenJS();

  setLayoutFromAspect(pptx, metadata.aspect_ratio);

  pptx.author = "Storyboard Dashboard";

  const projectTitle = safeText(metadata.project_title, "Untitled");
  pptx.company = projectTitle;

  const W = 13.33;
  const H = 7.5;

  const colors = {
    bg: "0B0B0B",
    panel: "141414",
    text: "FFFFFF",
    muted: "B5B5B5",
    stroke: "2A2A2A",
  };

  // Title slide
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.bg };

    slide.addText(projectTitle, {
      x: 0.8,
      y: 1.2,
      w: W - 1.6,
      h: 0.8,
      fontFace: "Inter",
      fontSize: 34,
      bold: true,
      color: colors.text,
    });

    const subtitle = [
      safeText(metadata.brand, ""),
      safeText(metadata.director, "") ? `Director: ${metadata.director}` : "",
      safeText(metadata.dop, "") ? `DoP: ${metadata.dop}` : "",
      safeText(metadata.aspect_ratio, "") ? `AR: ${metadata.aspect_ratio}` : "",
    ]
      .filter(Boolean)
      .join("  •  ");

    slide.addText(subtitle || "Generated storyboard", {
      x: 0.8,
      y: 2.05,
      w: W - 1.6,
      h: 0.5,
      fontFace: "Inter",
      fontSize: 14,
      color: colors.muted,
    });

    const note = safeText(metadata.notes, "");
    if (note) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8,
        y: 2.8,
        w: W - 1.6,
        h: 1.1,
        fill: { color: colors.panel },
        line: { color: colors.stroke },
      });

      slide.addText(note, {
        x: 1.05,
        y: 2.95,
        w: W - 2.1,
        h: 0.8,
        fontFace: "Inter",
        fontSize: 12,
        color: colors.text,
      });
    }
  }

  // One slide per shot
  shotlist.shots.forEach((shot, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: colors.bg };

    slide.addText(`${shot.shot_id}  •  ${shot.shot_type}`, {
      x: 0.6,
      y: 0.3,
      w: W - 1.2,
      h: 0.4,
      fontFace: "Inter",
      fontSize: 14,
      bold: true,
      color: colors.text,
    });

    // Frame placeholder (left)
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: 0.9,
      w: 7.9,
      h: 6.1,
      fill: { color: colors.panel },
      line: { color: colors.stroke },
    });

    slide.addText(shot.sketch_description || "Storyboard frame placeholder", {
      x: 0.9,
      y: 1.1,
      w: 7.3,
      h: 5.7,
      fontFace: "Inter",
      fontSize: 14,
      color: colors.muted,
      valign: "top",
    });

    // Details panel (right)
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 8.7,
      y: 0.9,
      w: W - 9.3,
      h: 6.1,
      fill: { color: colors.panel },
      line: { color: colors.stroke },
    });

    const lines: string[] = [];
    lines.push(`Scene: ${shot.scene_id}`);
    lines.push(`Beat: ${shot.beat_id}`);
    lines.push("");
    lines.push(`Action: ${shot.action}`);
    lines.push("");
    lines.push(`Intent: ${shot.intent}`);
    lines.push("");
    lines.push(`Camera: ${shot.camera.angle}, ${shot.camera.height}`);
    lines.push(`Move: ${shot.camera.movement} (${shot.camera.support})`);
    lines.push(`Lens: ${shot.lens.mm_range} — ${shot.lens.rationale}`);

    if (shot.risk_flags?.length) {
      lines.push("");
      lines.push(`Flags: ${shot.risk_flags.join(", ")}`);
    }

    slide.addText(lines.join("\n"), {
      x: 9.0,
      y: 1.15,
      w: W - 9.9,
      h: 5.6,
      fontFace: "Inter",
      fontSize: 11,
      color: colors.text,
      valign: "top",
    });

    slide.addText(`${idx + 1} / ${shotlist.shots.length}`, {
      x: W - 1.6,
      y: H - 0.5,
      w: 1.0,
      h: 0.3,
      fontFace: "Inter",
      fontSize: 10,
      color: colors.muted,
      align: "right",
    });
  });

  // ✅ Correct for your pptxgenjs typings: pass WriteProps object
  const arrayBuffer = (await pptx.write({ outputType: "arraybuffer" } as any)) as ArrayBuffer;

  return Buffer.from(arrayBuffer);
}
