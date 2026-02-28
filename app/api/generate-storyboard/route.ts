import { NextResponse } from "next/server";
import { MetadataSchema, ShotlistSchema } from "@/lib/schemas";
import { buildStoryboardPptxBuffer } from "@/lib/storyboard-pptx";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.approved_shotlist) {
      return NextResponse.json({ error: "approved_shotlist is required" }, { status: 400 });
    }

    const metadata = MetadataSchema.parse(body.metadata ?? {});
    let shotlist = ShotlistSchema.parse(body.approved_shotlist);
    const generateImages = body.generate_images !== false;
    const sketchStyle = body.sketch_style || "pencil sketch";

    console.log(`Processing ${shotlist.shots.length} shots, images: ${generateImages}`);

    if (generateImages && process.env.OPENAI_API_KEY) {
      console.log("Starting DALL-E image generation...");
      
      const shotsWithImages = [];
      for (let i = 0; i < shotlist.shots.length; i++) {
        const shot = shotlist.shots[i] as any;
        const description = shot.sketch_description || `${shot.shot_type} shot: ${shot.action}`;
        
        try {
          const { generateStoryboardSketch } = await import("@/lib/image-generator");
          const imageUrl = await generateStoryboardSketch(
            description,
            shot.shot_type,
            sketchStyle
          );
          
          shotsWithImages.push({
            ...shot,
            sketch_image_url: imageUrl
          });
          
          console.log(`Generated ${i + 1}/${shotlist.shots.length}: ${shot.shot_id}`);
          
          if (i < shotlist.shots.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (imgError: any) {
          console.error(`Failed for ${shot.shot_id}:`, imgError.message);
          shotsWithImages.push({
            ...shot,
            sketch_image_url: null
          });
        }
      }
      
      shotlist = { shots: shotsWithImages };
    }

    const pptxBuffer = await buildStoryboardPptxBuffer({ shotlist, metadata });
    const filename = `${(metadata.project_name || "Storyboard").replace(/[^\w\-]+/g, "_")}_Storyboard.pptx`;

    return new NextResponse(pptxBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Storyboard generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
