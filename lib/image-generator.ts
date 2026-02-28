import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateStoryboardSketch(
  shotDescription: string, 
  shotType: string,
  style: string = "pencil sketch"
): Promise<string> {
  const prompt = `Professional film storyboard frame, ${style}, ${shotType} shot composition: ${shotDescription}. 

Style details: Hand-drawn pencil sketch on white storyboard paper, cinematic lighting, grayscale, film production quality, clear lines, professional storyboard artist style, single frame composition, no text, no letters, no watermarks, clean illustration, detailed shading, movie scene visualization.`;

  try {
    console.log(`Generating sketch for: ${shotDescription.slice(0, 50)}...`);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("No image URL returned from DALL-E");
    }
    
    console.log(`Sketch generated: ${imageUrl.slice(0, 60)}...`);
    return imageUrl;
  } catch (error: any) {
    console.error("DALL-E generation failed:", error);
    throw new Error(`Sketch generation failed: ${error.message}`);
  }
}

export async function generateAllSketches(
  shots: any[], 
  onProgress?: (current: number, total: number) => void
): Promise<any[]> {
  const updatedShots = [...shots];
  
  for (let i = 0; i < updatedShots.length; i++) {
    const shot = updatedShots[i];
    const description = shot.sketch_description || `${shot.shot_type} shot: ${shot.action}`;
    
    try {
      const imageUrl = await generateStoryboardSketch(
        description, 
        shot.shot_type,
        "pencil sketch"
      );
      
      updatedShots[i] = {
        ...shot,
        sketch_image_url: imageUrl
      };
      
      if (onProgress) {
        onProgress(i + 1, shots.length);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Failed to generate sketch for ${shot.shot_id}:`, error);
      updatedShots[i] = {
        ...shot,
        sketch_image_url: null,
        sketch_error: "Generation failed"
      };
    }
  }
  
  return updatedShots;
}
