import {
  ComprehendClient,
  DetectEntitiesCommand,
  DetectPiiEntitiesCommand,
  type Entity,
} from '@aws-sdk/client-comprehend';
import { getServerEnv } from '@/lib/env';

const env = getServerEnv();
let client: ComprehendClient | null = null;

function getClient(): ComprehendClient {
  if (!client) {
    client = new ComprehendClient({ region: env.AWS_REGION });
  }
  return client;
}

export async function detectEntities(text: string): Promise<Entity[]> {
  const out = await getClient().send(
    new DetectEntitiesCommand({ Text: text.slice(0, 5000), LanguageCode: 'en' }),
  );
  return out.Entities ?? [];
}

/**
 * Strip PII from text before it enters training datasets (PRD §12.2).
 * Replaces detected names/emails/phones/addresses with generic tokens.
 */
export async function scrubPii(text: string): Promise<string> {
  const out = await getClient().send(
    new DetectPiiEntitiesCommand({ Text: text.slice(0, 5000), LanguageCode: 'en' }),
  );
  const entities = out.Entities ?? [];
  // Replace from end to start so offsets stay valid.
  let scrubbed = text;
  for (const e of [...entities].sort((a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0))) {
    if (e.BeginOffset == null || e.EndOffset == null || !e.Type) continue;
    scrubbed = scrubbed.slice(0, e.BeginOffset) + `[${e.Type}]` + scrubbed.slice(e.EndOffset);
  }
  return scrubbed;
}
