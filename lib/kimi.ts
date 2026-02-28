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
  
  const systemPrompt = isStoryboard
    ? `You are a Storyboard Artist AI. Enhance the provided shotlist with visual descriptions. Return JSON: {"updated_shotlist":{"shots":[...]}}`
    : `You are a Hollywood Shot Director. Generate a shotlist from the script provided. 
    
IMPORTANT: Return JSON in this exact format:
{
  "shots": [
    {
      "shot_id": "S001",
      "scene_id": "SC001",
      "beat_id": "B001",
      "shot_type": "WS",
      "action": "description here",
      "intent": "purpose here",
      "camera": {"angle":"eye-level","height":"standing","movement":"static","support":"tripod"},
      "lens": {"mm_range":"24mm","rationale":"wide establishing"},
      "continuity_notes": {"line_of_action":"left to right","eyelines":"match","match_action":"N/A","props_wardrobe":"check coffee cup"},
      "risk_flags": []
    }
  ]
}

Generate 3-5 shots per scene.`;

  try {
    console.log("Calling OpenAI with payload:", JSON.stringify(payload).slice(0, 200));
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use gpt-3.5-turbo for reliability (or gpt-4 if you have access)
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0].message.content;
    console.log("OpenAI response:", content?.slice(0, 500));
    
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Try to extract JSON
    let jsonStr = content;
    
    // If wrapped in markdown code blocks, extract it
    if (content.includes("```json")) {
      jsonStr = content.split("```json")[1].split("```")[0];
    } else if (content.includes("```")) {
      jsonStr = content.split("```")[1].split("```")[0];
    }
    
    jsonStr = jsonStr.trim();
    
    const parsed = JSON.parse(jsonStr);
    console.log("Parsed successfully:", Object.keys(parsed));
    
    // If it's the shot director and doesn't have shots array, wrap it
    if (!isStoryboard && !parsed.shots && Array.isArray(parsed)) {
      return { shots: parsed } as T;
    }
    
    return parsed as T;
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
}
