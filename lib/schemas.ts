import { z } from "zod";

export const MetadataSchema = z.object({
  project_name: z.string().default("Untitled Project"),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  genre: z.string().optional().default(""),
  duration_target_sec: z.number().optional().default(0),
  visual_tone_keywords: z.string().optional().default(""),
  director_notes: z.string().optional().default(""),
});

export type Metadata = z.infer<typeof MetadataSchema>;

export const StructuredScriptSchema = z.object({
  scenes: z.array(
    z.object({
      scene_id: z.string(),
      slugline: z.string(),
      location: z.string().optional().default(""),
      time: z.string().optional().default(""),
      characters: z.array(z.string()).optional().default([]),
      beats: z.array(
        z.object({
          beat_id: z.string(),
          beat_summary: z.string(),
          dialogue: z.string().optional().default(""),
          action: z.string().optional().default(""),
        })
      ),
    })
  ),
});

export type StructuredScript = z.infer<typeof StructuredScriptSchema>;

export const ShotSchema = z.object({
  shot_id: z.string(),
  scene_id: z.string(),
  beat_id: z.string().optional().default(""),
  shot_type: z.string(),
  action: z.string(),
  intent: z.string(),
  composition: z
    .object({
      framing: z.string().optional().default(""),
      screen_direction_notes: z.string().optional().default(""),
      ail_pattern: z.string().optional().default(""),
    })
    .optional(),
  camera: z.object({
    angle: z.string().optional().default(""),
    height: z.string().optional().default(""),
    movement: z.string().optional().default(""),
    support: z.string().optional().default(""),
  }),
  lens: z.object({
    mm_range: z.string().optional().default(""),
    rationale: z.string().optional().default(""),
  }),
  continuity_notes: z.object({
    line_of_action: z.string().optional().default(""),
    eyelines: z.string().optional().default(""),
    match_action: z.string().optional().default(""),
    props_wardrobe: z.string().optional().default(""),
  }),
  edit_notes: z
    .object({
      cut_point: z.string().optional().default(""),
      transition_hint: z.string().optional().default(""),
    })
    .optional(),
  risk_flags: z.array(z.string()).optional().default([]),
  sketch_image_url: z.string().optional(),
  sketch_description: z.string().optional(), // ADDED THIS
});

export type Shot = z.infer<typeof ShotSchema>;

export const ShotlistSchema = z.object({
  shots: z.array(ShotSchema),
});

export type Shotlist = z.infer<typeof ShotlistSchema>;
