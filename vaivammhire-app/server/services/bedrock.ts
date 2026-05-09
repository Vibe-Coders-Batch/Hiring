import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';
import {
  EMAIL_DRAFTING_SYSTEM,
  JD_GENERATION_SYSTEM,
  OFFER_DRAFTING_SYSTEM,
  RESUME_SCORING_SYSTEM,
  resumeScoringUserPrompt,
} from './prompts';
import type { CompBand } from '@/server/db/schema';

const env = getServerEnv();

let primaryClient: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (!primaryClient) {
    primaryClient = new BedrockRuntimeClient({ region: env.AWS_REGION });
  }
  return primaryClient;
}

/**
 * Scorecard schema per PRD §6.3.
 */
export const scorecardSchema = z.object({
  overall_fit_score: z.number().min(0).max(100),
  breakdown: z.object({
    skills_match: z.object({ score: z.number().min(0).max(100), reasoning: z.string() }),
    experience_match: z.object({ score: z.number().min(0).max(100), reasoning: z.string() }),
    education_match: z.object({ score: z.number().min(0).max(100), reasoning: z.string() }),
    domain_alignment: z.object({ score: z.number().min(0).max(100), reasoning: z.string() }),
  }),
  extracted: z.object({
    years_experience: z.number().nonnegative(),
    skills: z.array(z.string()),
    education: z.array(
      z.object({
        degree: z.string(),
        institution: z.string(),
        year: z.number().int(),
      }),
    ),
    current_role: z.string(),
    current_company: z.string(),
    location: z.string(),
    salary_expectation: z.string().nullable(),
  }),
  red_flags: z.array(z.string()),
  agent_recommendation: z.enum(['shortlist', 'review', 'reject']),
  rationale: z.string(),
});

export type Scorecard = z.infer<typeof scorecardSchema>;

async function converse(args: {
  system: string;
  userText: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const client = getClient();
  const cmd = new ConverseCommand({
    modelId: env.BEDROCK_MODEL_ID,
    system: [{ text: args.system }],
    messages: [{ role: 'user', content: [{ text: args.userText }] }],
    inferenceConfig: {
      maxTokens: args.maxTokens ?? 2048,
      temperature: args.temperature ?? 0.2,
    },
  });
  const result = await client.send(cmd);
  const text = result.output?.message?.content?.[0]?.text;
  if (!text) throw new Error('Bedrock returned empty content');
  return text;
}

export async function scoreResumeAgainstJob(args: {
  resumeText: string;
  comprehendEntities: unknown;
  jobTitle: string;
  jdMarkdown: string;
  hardFilters: unknown;
  questionnaireSummary?: string;
}): Promise<Scorecard> {
  const raw = await converse({
    system: RESUME_SCORING_SYSTEM,
    userText: resumeScoringUserPrompt(args),
    temperature: 0.1,
    maxTokens: 4096,
  });
  const json = extractJson(raw);
  return scorecardSchema.parse(json);
}

export async function generateJobDescription(args: {
  title: string;
  responsibilities: string;
  level: string;
}): Promise<{ jdMarkdown: string }> {
  const text = await converse({
    system: JD_GENERATION_SYSTEM,
    userText: `Draft a JD for: ${args.title} (${args.level}).
Key responsibilities: ${args.responsibilities}`,
    temperature: 0.4,
    maxTokens: 2048,
  });
  return { jdMarkdown: text };
}

export async function draftCandidateEmail(args: {
  applicationId: string;
  intent: 'acknowledgement' | 'screening_result' | 'scheduling' | 'rejection' | 'offer';
  toneNotes?: string;
}): Promise<{ subject: string; body: string }> {
  const text = await converse({
    system: EMAIL_DRAFTING_SYSTEM,
    userText: `Draft a ${args.intent.replace('_', ' ')} email for application ${args.applicationId}.
Tone notes: ${args.toneNotes ?? 'standard'}.

Output format:
Subject: <subject line>

<body>`,
    temperature: 0.3,
  });
  const subjectMatch = text.match(/Subject:\s*(.+)/i);
  const subject = subjectMatch?.[1]?.trim() ?? '';
  const body = text.replace(/Subject:.*\n+/i, '').trim();
  return { subject, body };
}

export async function draftOfferLetter(args: {
  candidateName: string;
  roleTitle: string;
  level: string;
  location: string;
  compBand: CompBand;
}): Promise<{ markdown: string; s3Key: string }> {
  const markdown = await converse({
    system: OFFER_DRAFTING_SYSTEM,
    userText: `Draft an offer letter.

Candidate: ${args.candidateName}
Role: ${args.roleTitle} (${args.level})
Location: ${args.location}
Fixed CTC range: ${args.compBand.fixedMin}–${args.compBand.fixedMax} INR
Variable: ${args.compBand.variablePct}%
ESOPs: ${args.compBand.esopsInr} INR

Use Vaivamm's standard structure. Leave the joining date as {{joining_date}}.`,
    temperature: 0.2,
    maxTokens: 3000,
  });

  // Real impl: render markdown → PDF via headless Chromium Lambda → upload to S3 (PRD §6.8).
  // For now, return a placeholder S3 key.
  const s3Key = `offers/draft/${args.compBand.id}/${Date.now()}.md`;
  return { markdown, s3Key };
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in Bedrock response');
  }
  return JSON.parse(raw.slice(start, end + 1));
}
