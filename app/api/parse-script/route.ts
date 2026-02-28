import { NextResponse } from "next/server";
import { MetadataSchema, StructuredScriptSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function basicParse(raw: string) {
  const chunks = raw
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  const scenes = chunks.map((c, i) => {
    const sceneId = `SC${String(i + 1).padStart(3, "0")}`;
    const slugline = c.split("\n")[0]?.slice(0, 80) || `Scene ${i + 1}`;
    return {
      scene_id: sceneId,
      slugline,
      location: "",
      time: "",
      characters: [],
      beats: [
        {
          beat_id: `B${String(1).padStart(3, "0")}`,
          beat_summary: c.slice(0, 140),
          dialogue: "",
          action: c,
        },
      ],
    };
  });

  return { scenes };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.raw_script_text) {
    return NextResponse.json({ error: "raw_script_text is required" }, { status: 400 });
  }

  const metadata = MetadataSchema.parse(body.metadata ?? {});
  const structured = basicParse(String(body.raw_script_text));
  const structured_script = StructuredScriptSchema.parse(structured);

  return NextResponse.json({ structured_script, metadata_used: metadata });
}
