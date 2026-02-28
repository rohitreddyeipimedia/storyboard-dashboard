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
    const BATCH_SIZE = 5;

    console.log(`Processing ${shotlist.shots.length} shots in batches of ${BATCH_SIZE}`);

    if (generateImages && process.env.OPENAI_API_KEY) {
      console.log("Starting batched DALL-E generation...");
      
      const shotsWithImages = [...shotlist.shots];
      const totalBatches = Math.ceil(shotsWithImages.length / BATCH_SIZE);
      
      // Process in batches of 5
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const startIdx = batchNum * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, shotsWithImages.length);
        const currentBatch = shotsWithImages.slice(startIdx, endIdx);
        
        console.log(`Batch ${batchNum + 1}/${totalBatches}: Processing shots ${startIdx + 1}-${endIdx}`);
        
        // Generate this batch IN PARALLEL
        const batchPromises = currentBatch.map(async (shot, idx) => {
          const globalIndex = startIdx + idx;
          const shotAny = shot as any;
          const description = shotAny.sketch_description || `${shotAny.shot_type} shot: ${shotAny.action}`;
          
          try {
            const { generateStoryboardSketch } = await import("@/lib/image-generator");
            const imageUrl = await generateStoryboardSketch(
              description,
              shotAny.shot_type,
              "pencil sketch"
            );
            
            console.log(`✓ Generated: ${shotAny.shot_id} (${globalIndex + 1}/${shotsWithImages.length})`);
            
            return {
              index: globalIndex,
              shot: { ...shotAny, sketch_image_url: imageUrl }
            };
          } catch (error: any) {
            console.error(`✗ Failed: ${shotAny.shot_id} - ${error.message}`);
            return {
              index: globalIndex,
              shot: { ...shotAny, sketch_image_url: null }
            };
          }
        });
        
        // Wait for all 5 to complete
        const results = await Promise.all(batchPromises);
        
        // Update the array with results
        results.forEach(({ index, shot }) => {
          shotsWithImages[index] = shot;
        });
        
        // Small delay between batches (1 second) to avoid rate limits
        if (batchNum < totalBatches - 1) {
          console.log(`Waiting 1 second before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      shotlist = { shots: shotsWithImages };
      const successCount = shotsWithImages.filter((s: any) => s.sketch_image_url).length;
      console.log(`Complete! ${successCount}/${shotsWithImages.length} sketches generated`);
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
