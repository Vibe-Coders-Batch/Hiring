import { db } from './index';
import { auditLog, trainingLabels } from './schema';

export type ActorType = 'human' | 'agent' | 'model' | 'system';

export interface AuditEvent {
  actorType: ActorType;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  payload?: unknown;
}

/**
 * Append an audit log entry. Append-only — never UPDATE/DELETE (PRD §9, §12.4).
 */
export async function audit(event: AuditEvent): Promise<void> {
  await db.insert(auditLog).values({
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    payload: event.payload as never,
  });
}

export type ModelTarget = 'M1' | 'M2' | 'M3' | 'M4' | 'M5';
export type LabelSource = 'hr_override' | 'hr_explicit' | 'hire_outcome' | 'synthetic' | 'public';

export interface TrainingLabelEvent {
  modelTarget: ModelTarget;
  inputRef: Record<string, unknown>;
  label: Record<string, unknown>;
  source: LabelSource;
  labelerId?: string;
  aiPrediction?: Record<string, unknown>;
}

/**
 * Capture an HR action (or other source) as a labeled training example (PRD §7.3).
 * Every HR override path must call this synchronously in the same transaction.
 */
export async function captureTrainingLabel(event: TrainingLabelEvent): Promise<void> {
  await db.insert(trainingLabels).values({
    modelTarget: event.modelTarget,
    inputRef: event.inputRef as never,
    label: event.label as never,
    source: event.source,
    labelerId: event.labelerId,
    aiPrediction: event.aiPrediction as never,
  });
}
