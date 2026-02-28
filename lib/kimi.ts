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

  const systemPrompt = agentId.includes("storyboard")
    ? `You are an expert Storyboard Artist AI. Given a shotlist and metadata, enhance each shot with detailed visual descriptions and composition notes. Return ONLY valid JSON format with "updated_shotlist" containing the enhanced shots array.`
    : `You are an expert Hollywood Shot Director AI with 20 years of experience in feature films. Given a structured script and metadata, generate a comprehensive shotlist following industry standards. 

For each shot, include:
- shot_id (format: S001, S002, etc.)
- scene_id (from input)
- shot_type (WS, MS, CU, OTS, POV, INSERT, ELS, etc.)
- action (detailed blocking description)
- intent (emotional/story purpose)
- camera: {angle, height, movement, support}
- lens: {mm_range, rationale}
- continuity_notes: {line_of_action, eyelines, match_action, props_wardrobe}
- risk_flags (array of strings)

Return ONLY valid JSON format with a "shots" array containing 2-5 shots per scene. Be specific with lens choices (e.g., "24mm", "85mm") and camera movements.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Extract JSON from response (in case GPT adds markdown or text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    return JSON.parse(jsonMatch[0]) as T;
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
}
