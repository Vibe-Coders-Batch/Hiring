/**
 * Model promotion gate per PRD §7.7.
 *
 * A custom model only goes to prod if it beats the incumbent on at least 2 of 3
 * of (accuracy, cost-per-1000, p95 latency), without losing the third by more than 10%,
 * and HR-agreement is within 5 points, and fairness eval passes (PRD §12.2).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { modelRuns } from '@/server/db/schema';

export interface PromotionEvaluation {
  passes: boolean;
  reasons: string[];
  metrics: {
    accuracyDelta: number;
    costRatio: number;
    latencyDelta: number;
    hrAgreementDelta: number;
    fairnessPass: boolean;
  };
}

export async function evaluatePromotionGate(modelRunId: string): Promise<PromotionEvaluation> {
  const [run] = await db.select().from(modelRuns).where(eq(modelRuns.id, modelRunId)).limit(1);
  if (!run) {
    return {
      passes: false,
      reasons: ['model run not found'],
      metrics: { accuracyDelta: 0, costRatio: 1, latencyDelta: 0, hrAgreementDelta: 0, fairnessPass: false },
    };
  }

  const m = (run.evalMetrics ?? {}) as Record<string, number | boolean>;
  const accuracyDelta = Number(m.accuracy_delta ?? 0);
  const costRatio = Number(m.cost_ratio ?? 1);
  const latencyDelta = Number(m.p95_latency_delta ?? 0);
  const hrAgreementDelta = Number(m.hr_agreement_delta ?? 0);
  const fairnessPass = Boolean(m.fairness_pass ?? false);

  const wins = {
    accuracy: accuracyDelta > 0,
    cost: costRatio < 1,
    latency: latencyDelta < 0,
  };
  const winCount = Object.values(wins).filter(Boolean).length;

  const reasons: string[] = [];
  if (winCount < 2) reasons.push(`only ${winCount}/3 metric wins (need 2)`);

  // No metric loses by >10%
  if (!wins.accuracy && accuracyDelta < -0.1) reasons.push('accuracy loss >10%');
  if (!wins.cost && costRatio > 1.1) reasons.push('cost worse by >10%');
  if (!wins.latency && latencyDelta > 0.1) reasons.push('latency worse by >10%');

  if (Math.abs(hrAgreementDelta) > 5) reasons.push(`HR-agreement off by ${hrAgreementDelta} pts (>5)`);
  if (!fairnessPass) reasons.push('fairness eval failed');

  return {
    passes: reasons.length === 0,
    reasons,
    metrics: { accuracyDelta, costRatio, latencyDelta, hrAgreementDelta, fairnessPass },
  };
}
