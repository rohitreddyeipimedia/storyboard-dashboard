import { NextResponse } from "next/server";
import { MetadataSchema, StructuredScriptSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function smartParse(raw: string) {
  // Split by scene indicators: "Cut to", "INT.", "EXT.", location changes, or double newlines
  const scenePatterns = [
    /Cut to[\s\S]*?(?=\n\n|Cut to|INT\.|EXT\.|$)/gi,
    /INT\.[\s\S]*?(?=\n\n|Cut to|INT\.|EXT\.|$)/gi,
    /EXT\.[\s\S]*?(?=\n\n|Cut to|INT\.|EXT\.|$)/gi,
    /Back to[\s\S]*?(?=\n\n|Cut to|INT\.|EXT\.|$)/gi,
  ];

  let scenes: string[] = [];
  
  // First try to find explicit scene breaks
  const explicitScenes = raw.split(/\n\s*\n\s*\n/); // Triple newlines = new scene
  
  if (explicitScenes.length > 1) {
    scenes = explicitScenes;
  } else {
    // Split by "Cut to" or major location changes
    scenes = raw.split(/(?=Cut to|Back to|INT\.|EXT\.)/i).filter(s => s.trim().length > 20);
  }

  // If still too few, split by double newlines with length check
  if (scenes.length < 3) {
    scenes = raw.split(/\n\s*\n/).filter(s => s.trim().length > 30);
  }

  const structuredScenes = scenes.map((content, i) => {
    const sceneId = `SC${String(i + 1).padStart(3, "0")}`;
    
    // Try to extract slugline from first line
    const lines = content.trim().split('\n');
    let slugline = lines[0].slice(0, 80);
    let location = "";
    let time = "";
    
    // Check for location indicators
    if (content.toLowerCase().includes("studio")) {
      location = "Studio";
      time = "Present";
    } else if (content.toLowerCase().includes("ground") || content.toLowerCase().includes("nets")) {
      location = "Cricket Ground";
      time = "Day";
    } else if (content.toLowerCase().includes("gym") || content.toLowerCase().includes("workout")) {
      location = "Gym";
      time = "Day";
    }
    
    // Extract characters mentioned
    const characters: string[] = [];
    if (content.includes("Arshdeep")) characters.push("Arshdeep");
    if (content.includes("Manager")) characters.push("Manager");
    if (content.includes("Brand Manager")) characters.push("Brand Manager");
    if (content.includes("Director")) characters.push("Director");
    
    // Create beats (paragraphs of action)
    const beats = content
      .split(/\.\s+(?=[A-Z])|\n/)
      .filter(b => b.trim().length > 10)
      .map((beat, bi) => ({
        beat_id: `B${String(bi + 1).padStart(3, "0")}`,
        beat_summary: beat.trim().slice(0, 140),
        dialogue: beat.includes('"') ? beat.trim() : "",
        action: beat.trim()
      }));

    return {
      scene_id: sceneId,
      slugline: slugline || `Scene ${i + 1}`,
      location,
      time,
      characters: [...new Set(characters)], // unique
      beats: beats.length > 0 ? beats : [{
        beat_id: "B001",
        beat_summary: content.trim().slice(0, 140),
        dialogue: "",
        action: content.trim()
      }]
    };
  });

  return { scenes: structuredScenes };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.raw_script_text) {
    return NextResponse.json({ error: "raw_script_text is required" }, { status: 400 });
  }

  const metadata = MetadataSchema.parse(body.metadata ?? {});
  const structured = smartParse(String(body.raw_script_text));
  const structured_script = StructuredScriptSchema.parse(structured);

  return NextResponse.json({ structured_script, metadata_used: metadata });
}
