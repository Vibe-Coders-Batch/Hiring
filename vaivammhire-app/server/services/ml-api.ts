/**
 * Client for the Track B private API Gateway (PRD §7.8).
 * Each endpoint corresponds to a model: M1 NER, M2 fit, M3 embed, M4 dedup, M5 spam.
 */

import { getServerEnv } from '@/lib/env';

const env = getServerEnv();

export interface ResumeNerOutput {
  skills: string[];
  companies: string[];
  titles: string[];
  educations: Array<{ degree: string; institution: string; year?: number }>;
}

export interface FitScoreOutput {
  score: number;
  decision: 'shortlist' | 'review' | 'reject';
  features: Record<string, number>;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  if (!env.ML_API_BASE_URL) {
    throw new Error('ML_API_BASE_URL is not configured');
  }
  // In prod, requests are SigV4-signed via aws4fetch (private API Gateway, IAM auth).
  // Local/dev: raw fetch is acceptable when endpoint is mocked.
  const res = await fetch(`${env.ML_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`ML API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const mlApi = {
  parseResume: (body: { text: string }) => call<ResumeNerOutput>('/parse-resume', body),
  scoreFit: (body: { resumeText: string; jdMarkdown: string }) => call<FitScoreOutput>('/score-fit', body),
  embedSkill: (body: { skill: string }) => call<{ vector: number[] }>('/embed-skill', body),
  dedupCheck: (body: { resumeText: string; email: string; phone?: string }) =>
    call<{ duplicates: Array<{ candidateId: string; score: number }> }>('/dedup-check', body),
  spamCheck: (body: { text: string }) => call<{ spamProbability: number }>('/spam-check', body),
  health: async () => {
    if (!env.ML_API_BASE_URL) return { ok: false, reason: 'not_configured' as const };
    const res = await fetch(`${env.ML_API_BASE_URL}/health`);
    return { ok: res.ok, body: await res.json() };
  },
};
