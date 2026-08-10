export type DiscordField = { name: string; value: string; inline?: boolean };
export type DiscordEmbedInput = {
  title: string;
  description?: string;
  fields?: DiscordField[];
  severity?: "info" | "success" | "warning" | "critical";
  url?: string;
  timestamp?: string;
};

const COLORS = { info: 0x8b5cf6, success: 0x46e6a6, warning: 0xffcc66, critical: 0xff526b };

export async function sendDiscordWebhook(environmentName: string, input: DiscordEmbedInput) {
  const webhookUrl = Netlify.env.get(environmentName);
  if (!webhookUrl) return { sent: false, reason: "not_configured" };
  const payload = {
    username: "Kruiger Labs Store",
    embeds: [{
      title: input.title.slice(0, 256),
      description: input.description?.slice(0, 4096),
      color: COLORS[input.severity || "info"],
      fields: (input.fields || []).slice(0, 25).map((field) => ({ name: field.name.slice(0, 256), value: field.value.slice(0, 1024), inline: field.inline || false })),
      url: input.url,
      timestamp: input.timestamp || new Date().toISOString(),
      footer: { text: "Kruiger Labs LLC · Server-side commerce event" },
    }],
  };
  let lastError = "unknown";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (response.ok) return { sent: true };
      lastError = `HTTP ${response.status}`;
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request_failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  console.error(`Discord webhook ${environmentName} failed: ${lastError}`);
  return { sent: false, reason: lastError };
}

