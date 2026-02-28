import { NextResponse } from "next/server";
import { MetadataSchema, StructuredScriptSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function sentenceBasedParse(raw: string) {
  // Clean up the text
  const cleaned = raw.replace(/\n+/g, ' ').trim();
  
  // Split by periods followed by space and capital letter (sentence boundaries)
  // Also split by "Cut to" and scene changes
  const sentences = cleaned
    .split(/(?<=\.)\s+(?=[A-Z])|(?=Cut to|Back to|INT\.|EXT\.)/gi)
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.match(/^(Cut to|Back to|INT|EXT)/i));

  // Group sentences into scenes based on location/character changes
  const scenes: any[] = [];
  let currentScene: any = null;
  let sentenceCounter = 0;
  
  sentences.forEach((sentence, idx) => {
    sentenceCounter++;
    
    // Start new scene every 3-5 sentences or on location change
    const isNewScene = !currentScene || 
                      sentenceCounter > 4 || 
                      sentence.match(/^(Arshdeep|Manager|Director)\s+(sits|stands|walks|enters)/i) ||
                      sentence.includes("Cut to");
    
    if (isNewScene) {
      if (currentScene) scenes.push(currentScene);
      currentScene = {
        scene_id: `SC${String(scenes.length + 1).padStart(3, "0")}`,
        slugline: sentence.slice(0, 60),
        location: extractLocation(sentence),
        time: "Day",
        characters: extractCharacters(sentence),
        beats: []
      };
      sentenceCounter = 0;
    }
    
    // Each sentence becomes a beat (potential shot)
    currentScene?.beats.push({
      beat_id: `B${String(idx + 1).padStart(3, "0")}`,
      beat_summary: sentence.slice(0, 140),
      dialogue: sentence.includes('"') ? sentence : "",
      action: sentence
    });
  });
  
  if (currentScene) scenes.push(currentScene);
  
  return { scenes };
}

function extractLocation(text: string): string {
  if (text.toLowerCase().includes("studio")) return "Studio";
  if (text.toLowerCase().includes("ground") || text.toLowerCase().includes("nets")) return "Cricket Ground";
  if (text.toLowerCase().includes("gym")) return "Gym";
  return "Location";
}

function extractCharacters(text: string): string[] {
  const chars: string[] = [];
  if (text.includes("Arshdeep")) chars.push("Arshdeep");
  if (text.includes("Manager")) chars.push("Manager");
  if (text.match(/Brand manager/i)) chars.push("Brand Manager");
  return Array.from(new Set(chars));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.raw_script_text) {
    return NextResponse.json({ error: "raw_script_text is required" }, { status: 400 });
  }

  const metadata = MetadataSchema.parse(body.metadata ?? {});
  const structured = sentenceBasedParse(String(body.raw_script_text));
  const structured_script = StructuredScriptSchema.parse(structured);

  return NextResponse.json({ 
    structured_script, 
    metadata_used: metadata,
    stats: { sentences: structured.scenes.reduce((acc, s) => acc + s.beats.length, 0) }
  });
}
