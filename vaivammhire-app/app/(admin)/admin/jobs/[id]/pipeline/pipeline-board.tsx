'use client';

import { DndContext, type DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { trpc } from '@/server/trpc/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

const STAGES = [
  'applied',
  'ai_screened',
  'hr_review',
  'shortlisted',
  'interview_1',
  'assignment',
  'interview_2',
  'interview_3',
  'reference_check',
  'offer',
  'hired',
  'rejected',
] as const;

type Stage = (typeof STAGES)[number];

export interface BoardRow {
  applicationId: string;
  stage: string;
  scoreCard: unknown;
  lastActionAt: Date;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
}

function getScore(scoreCard: unknown): number | null {
  if (scoreCard && typeof scoreCard === 'object' && 'overall_fit_score' in scoreCard) {
    const v = (scoreCard as { overall_fit_score: unknown }).overall_fit_score;
    return typeof v === 'number' ? v : null;
  }
  return null;
}

export function PipelineBoard({ jobId: _jobId, rows: initialRows }: { jobId: string; rows: BoardRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const move = trpc.applications.moveStage.useMutation();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const byStage = useMemo(() => {
    const map: Record<Stage, BoardRow[]> = Object.fromEntries(STAGES.map((s) => [s, [] as BoardRow[]])) as Record<
      Stage,
      BoardRow[]
    >;
    for (const r of rows) {
      const s = STAGES.includes(r.stage as Stage) ? (r.stage as Stage) : 'applied';
      map[s].push(r);
    }
    return map;
  }, [rows]);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const applicationId = String(e.active.id);
    const newStage = String(e.over.id) as Stage;
    if (!STAGES.includes(newStage)) return;

    setRows((prev) => prev.map((r) => (r.applicationId === applicationId ? { ...r, stage: newStage } : r)));
    move.mutate({ applicationId, stage: newStage });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage) => (
            <Column key={stage} stage={stage} rows={byStage[stage]} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function Column({ stage, rows }: { stage: Stage; rows: BoardRow[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded-[var(--radius-card)] border bg-neutral-50 p-3',
        isOver ? 'border-primary-500' : 'border-neutral-200',
      )}
    >
      <header className="flex items-center justify-between text-xs font-medium uppercase text-neutral-500">
        <span>{stage.replace('_', ' ')}</span>
        <span>{rows.length}</span>
      </header>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <DraggableCard key={r.applicationId} row={r} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ row }: { row: BoardRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.applicationId });
  const score = getScore(row.scoreCard);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      className={cn(
        'cursor-grab rounded-[var(--radius-card)] border border-neutral-200 bg-white p-3 shadow-[var(--shadow-sm)]',
        isDragging && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-neutral-900">{row.candidateName}</p>
          <p className="text-xs text-neutral-500">{row.candidateEmail}</p>
        </div>
        {score !== null && (
          <Badge tone={score >= 75 ? 'success' : score >= 50 ? 'primary' : 'neutral'}>{score}</Badge>
        )}
      </div>
    </div>
  );
}
