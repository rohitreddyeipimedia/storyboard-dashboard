// lib/kimi.ts
type CallKimiArgs = {
  agentId: string;
  payload: unknown;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonValue }
  | JsonValue[];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Enable/disable Kimi usage (you already call this).
 * You can toggle with:
 * - KIMI_ENABLED=true
 * and required:
 * - KIMI_API_BASE
 * - KIMI_API_KEY
 */
export function kimiEnabled(): boolean {
  const enabled = String(process.env.KIMI_ENABLED ?? "").toLowerCase();
  if (enabled !== "true" && enabled !== "1" && enabled !== "yes") return false;
  return Boolean(process.env.KIMI_API_BASE && process.env.KIMI_API_KEY);
}

/**
 * Calls a Kimi "agent" endpoint via fetch.
 *
 * Expected env:
 * - KIMI_API_BASE  e.g. https://your-kimi-gateway.com
 * - KIMI_API_KEY
 *
 * This function is GENERIC and returns typed JSON.
 */
export async function callKimiAgent<T = any>({ agentId, payload }: CallKimiArgs): Promise<T> {
  const base = process.env.KIMI_API_BASE;
  const key = process.env.KIMI_API_KEY;

  if (!base || !key) {
    throw new Error("Kimi env not configured. Set KIMI_API_BASE and KIMI_API_KEY.");
  }

  const url = `${base.replace(/\/$/, "")}/agents/${encodeURIComponent(agentId)}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Kimi agent call failed (${resp.status}): ${text.slice(0, 500)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as JsonValue;
  } catch {
    // If server returns non-JSON, fail loudly
    throw new Error(`Kimi returned non-JSON: ${text.slice(0, 500)}`);
  }

  // Some gateways wrap the result (common patterns)
  if (isRecord(parsed)) {
    // e.g. { data: {...} } or { result: {...} }
    if (parsed.data) return parsed.data as T;
    if (parsed.result) return parsed.result as T;
  }

  return parsed as T;
}
