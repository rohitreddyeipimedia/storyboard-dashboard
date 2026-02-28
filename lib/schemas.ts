// lib/schemas.ts
import { z } from "zod";

/**
 * Metadata
 */
export const MetadataSchema = z.object({
  project_title: z.string().optional().default("Storyboard"),
  brand: z.string().optional(),
  director: z.string().optional(),
  dop: z.string().optional(),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional().default("16:9"),
  language: z.string().optional(),
  notes: z.string().optional(),
});

export type Metadata = z.infer<typeof MetadataSchema>;

/**
 * Structured script (Scenes → Beats)
 * Your upstream parser should output this format.
 */
export const BeatSchema = z.object({
  beat_id: z.string(),
  action: z.string().optional(),
  text: z.string().optional(),
});

export type Beat = z.infer<typeof BeatSchema>;

export const SceneSchema = z.object({
  scene_id: z.string(),
  title: z.string().optional(),
  location: z.string().optional(),
  beats: z.array(BeatSchema).optional().default([]),
});

export type Scene = z.infer<typeof SceneSchema>;

export const StructuredScriptSchema = z.object({
  scenes: z.array(SceneSchema).optional().default([]),
});

export type StructuredScript = z.infer<typeof StructuredScriptSchema>;

/**
 * Shotlist
 */
export const ShotTypeSchema = z.enum(["WS", "MS", "MCU", "CU", "ECU", "INSERT", "OTS"]);

export const ShotSchema = z.object({
  shot_id: z.string(),
  scene_id: z.string(),
  beat_id: z.string(),

  shot_type: ShotTypeSchema,
  action: z.string(),
  intent: z.string(),

  camera: z.object({
    angle: z.string(),
    height: z.string(),
    movement: z.string(),
    support: z.string(),
  }),

  lens: z.object({
    mm_range: z.string(),
    rationale: z.string(),
  }),

  continuity_notes: z.record(z.string()).optional().default({}),
  risk_flags: z.array(z.string()).optional().default([]),

  // Used for PPTX placeholder storyboard frames
  sketch_description: z.string().optional().default(""),
});

export type Shot = z.infer<typeof ShotSchema>;

export const ShotlistSchema = z.object({
  shots: z.array(ShotSchema),
});

export type Shotlist = z.infer<typeof ShotlistSchema>;
