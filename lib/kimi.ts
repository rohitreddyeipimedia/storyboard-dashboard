import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function kimiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function callKimiAgent<T>({
  agentId,
  payload,
}: {
  agentId: string;
  payload: any;
}): Promise<T> {
  if (!kimiEnabled()) {
    throw new Error("OpenAI API key not configured");
  }

  const isStoryboard = agentId.includes("storyboard");
  const sceneCount = payload.structured_script?.scenes?.length || 5;
  const expectedShots = sceneCount * 5; // 5 shots per scene
  
  const systemPrompt = isStoryboard
    ? `You are a Storyboard Artist AI. Enhance the provided shotlist with visual descriptions. Return JSON: {"updated_shotlist":{"shots":[...]}}`
    : `You are a Hollywood Shot Director AI. Generate a COMPREHENSIVE shotlist.

CRITICAL: Generate ${expectedShots} shots for this ${sceneCount}-scene script (4-6 shots per scene).

Shot type guidelines:
- WS (Wide Shot): Establishing, action coverage
- MS (Medium Shot): Dialogue, two-shots
- MCU (Med Close Up): Character reactions
- CU (Close Up): Emphasis, dialogue
- ECU (Extreme Close Up): Eyes, products, details
- INSERT: Hands, objects, products
- OTS (Over Shoulder): Dialogue scenes
- POV: Character point of view

For EACH shot include:
- shot_id: S001, S002, etc. (sequential across all scenes)
- scene_id: from input
- shot_type: choose from list above
- action: detailed blocking
- intent: story/emotional purpose
- camera: {angle, height, movement, support}
- lens: {mm_range, rationale}
- continuity_notes: {line_of_action, eyelines, match_action, props_wardrobe}
- risk_flags: []

Return JSON: {"shots":[...array of ${expectedShots} shots...]}`;

  try {
    console.log(`Requesting ~${expectedShots} shots for ${sceneCount} scenes`);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) }
      ],
      temperature: 0.7,
      max_tokens: 4000, // Increased for more shots
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Extract JSON
    let jsonStr = content;
    if (content.includes("```json")) {
      jsonStr = content.split("```json")[1].split("```")[0];
    } else if (content.includes("```")) {
      jsonStr = content.split("```")[1].split("```")[0];
    }
    
    jsonStr = jsonStr.trim();
    const parsed = JSON.parse(jsonStr);
    console.log(`Received ${parsed.shots?.length || 0} shots from AI`);
    
    return parsed as T;
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
}
