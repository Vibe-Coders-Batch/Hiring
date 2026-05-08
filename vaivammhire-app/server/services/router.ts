/**
 * Per-task routing: Bedrock vs Comprehend vs custom (Track B) per PRD §5, §7.7.
 * Driven by ML_API_FEATURE_FLAGS — values: off | shadow | on.
 *
 * - `off`: Bedrock/Comprehend handles 100% of traffic. Custom not called.
 * - `shadow`: Custom called in background, predictions logged, incumbent's output used.
 * - `on`: Custom serves traffic; Bedrock/Comprehend kept as shadow for ongoing eval.
 */

import { getServerEnv, parseFeatureFlags } from '@/lib/env';
import { detectEntities, scrubPii } from './comprehend';
import { mlApi } from './ml-api';

type FlagState = 'off' | 'shadow' | 'on';

function flagFor(model: string): FlagState {
  const env = getServerEnv();
  const flags = parseFeatureFlags(env.ML_API_FEATURE_FLAGS);
  const v = flags[model];
  return v === 'on' || v === 'shadow' ? v : 'off';
}

export async function routeNer(text: string) {
  const state = flagFor('m1');
  if (state === 'on') {
    return mlApi.parseResume({ text });
  }
  // Incumbent path: Comprehend baseline NER (PRD §6.3).
  const entities = await detectEntities(text);
  if (state === 'shadow') {
    void mlApi.parseResume({ text }).catch(() => {
      /* shadow logging handled in service */
    });
  }
  return entities;
}

export async function routePiiScrub(text: string) {
  // Comprehend handles PII stripping deterministically; no custom replacement yet (PRD §12.2).
  return scrubPii(text);
}

export async function routeSpamCheck(text: string): Promise<number> {
  const state = flagFor('m5');
  if (state === 'off') return 0;
  try {
    const out = await mlApi.spamCheck({ text });
    return out.spamProbability;
  } catch {
    return 0;
  }
}
