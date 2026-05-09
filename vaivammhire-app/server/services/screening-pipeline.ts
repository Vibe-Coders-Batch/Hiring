/**
 * The end-to-end resume screening pipeline (PRD §6.3).
 *
 * Triggered by an S3 ObjectCreated event in `vaivammhire-resumes-*` via
 * EventBridge → Lambda → this function. The Step Functions definition lives
 * in vaivammhire-infra/lib/compute-stack.ts.
 *
 *   Resume in S3
 *     → Textract (extract text)
 *     → Comprehend baseline NER (or M1 once promoted)
 *     → Bedrock scorecard (or M2 once promoted)
 *     → Save to RDS + emit training_label event
 */

import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { audit } from '@/server/db/audit';
import { applications, candidates, jobs } from '@/server/db/schema';
import { scoreResumeAgainstJob, type Scorecard } from './bedrock';
import { detectEntities } from './comprehend';
import { routeSpamCheck } from './router';
import { extractText } from './textract';

export interface ScreeningInput {
  applicationId: string;
  resumeBucket: string;
  resumeKey: string;
  /** Human-readable questionnaire answers for Bedrock scoring */
  questionnaireSummary?: string;
}

export interface ScreeningResult {
  scorecard: Scorecard;
  shortlisted: boolean;
  spamProbability: number;
}

export async function runScreening(input: ScreeningInput): Promise<ScreeningResult> {
  const [row] = await db
    .select({ application: applications, job: jobs, candidate: candidates })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .where(eq(applications.id, input.applicationId))
    .limit(1);

  if (!row) throw new Error(`application not found: ${input.applicationId}`);

  const text = await extractText({ bucket: input.resumeBucket, key: input.resumeKey });

  // Cheap pre-filter at the edge before we spend Bedrock $ (PRD §7.1, M5).
  const spamProbability = await routeSpamCheck(text);
  if (spamProbability > 0.85) {
    await db
      .update(applications)
      .set({ stage: 'rejected', lastActionAt: new Date() })
      .where(eq(applications.id, input.applicationId));

    await audit({
      actorType: 'model',
      actorId: 'M5',
      action: 'application.spam_reject',
      targetType: 'application',
      targetId: input.applicationId,
      payload: { spamProbability },
    });
    throw new Error('Application flagged as spam');
  }

  const entities = await detectEntities(text);

  const scorecard = await scoreResumeAgainstJob({
    resumeText: text,
    comprehendEntities: entities,
    jobTitle: row.job.title,
    jdMarkdown: row.job.jdMarkdown,
    hardFilters: row.job.hardFilters,
    questionnaireSummary: input.questionnaireSummary,
  });

  const threshold = row.job.autoShortlistThreshold;
  const shortlisted = scorecard.overall_fit_score >= threshold;
  const newStage = shortlisted ? 'shortlisted' : 'ai_screened';

  await db
    .update(applications)
    .set({
      stage: newStage,
      scoreCard: scorecard as never,
      agentRecommendation: scorecard.agent_recommendation,
      lastActionAt: new Date(),
    })
    .where(eq(applications.id, input.applicationId));

  await audit({
    actorType: 'agent',
    actorId: 'bedrock',
    action: 'application.scored',
    targetType: 'application',
    targetId: input.applicationId,
    payload: { score: scorecard.overall_fit_score, recommendation: scorecard.agent_recommendation },
  });

  return { scorecard, shortlisted, spamProbability };
}
