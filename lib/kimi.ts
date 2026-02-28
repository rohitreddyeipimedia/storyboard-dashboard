type KimiConfig = {
  baseUrl?: string;
  apiKey?: string;
};

const config: KimiConfig = {
  baseUrl: process.env.KIMI_BASE_URL,
  apiKey: process.env.KIMI_API_KEY,
};

export function kimiEnabled() {
  return Boolean(config.baseUrl && config.apiKey);
}

export async function callKimiAgent<T>({
  agentId,
  payload,
}: {
  agentId: string;
  payload: any;
}): Promise<T> {
  if (!kimiEnabled()) {
    throw new Error("KIMI not configured");
  }

  const res = await fetch(`${config.baseUrl}/agents/${agentId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`KIMI call failed: ${res.status} ${txt}`);
  }

  return (await res.json()) as T;
}
