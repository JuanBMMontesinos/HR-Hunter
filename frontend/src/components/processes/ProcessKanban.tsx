import { ArrowLeft, ArrowRight, GripVertical, MessageSquareText, Star } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import type { KanbanColumn, ProcessItem } from '../../types/domain';
import { translateStageName } from '../../utils/stageTranslation';

export interface ProcessKanbanProps {
  columns: KanbanColumn[];
  canUpdate: boolean;
  announcement: string;
  onMoveStage: (process: ProcessItem, targetStageId: number, targetStageName: string) => Promise<void>;
  onOpenDetail: (process: ProcessItem) => void;
}

function processStatusVariant(status: ProcessItem['status']) {
  if (status === 'Concluído') return 'success' as const;
  if (status === 'Parado') return 'warning' as const;
  return 'info' as const;
}

export function ProcessKanban({
  columns,
  canUpdate,
  announcement,
  onMoveStage,
  onOpenDetail,
}: ProcessKanbanProps) {
  const { t, i18n } = useTranslation();
  const [draggingProcess, setDraggingProcess] = useState<ProcessItem | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);

  const handleDragStart = (e: DragEvent<HTMLElement>, proc: ProcessItem) => {
    if (!canUpdate) {
      e.preventDefault();
      return;
    }
    setDraggingProcess(proc);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(proc.id));
  };

  const handleDrop = async (e: DragEvent<HTMLElement>, column: KanbanColumn) => {
    e.preventDefault();
    setDragOverStageId(null);
    const dropped = draggingProcess;
    setDraggingProcess(null);
    if (!dropped || !canUpdate || dropped.currentStageId === column.stageId) return;

    setMovingId(dropped.id);
    try {
      await onMoveStage(dropped, column.stageId, column.stageName);
    } finally {
      setMovingId(null);
    }
  };

  const handleStepMove = async (proc: ProcessItem, colIndex: number, delta: -1 | 1) => {
    const targetCol = columns[colIndex + delta];
    if (!targetCol || !canUpdate) return;
    setMovingId(proc.id);
    try {
      await onMoveStage(proc, targetCol.stageId, targetCol.stageName);
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="hr-kanban-wrapper">
      <div className="visually-hidden" role="status" aria-live="polite" data-testid="kanban-live-region">
        {announcement}
      </div>

      <p className="hr-text-muted hr-kanban__hint">{t('processes.dragHint')}</p>

      <div className="hr-kanban" data-testid="processes-kanban">
        {columns.map((column, colIndex) => {
          const stageLabel = translateStageName(column.stageName, i18n.language);
          const isDropTarget = dragOverStageId === column.stageId;

          return (
            <section
              key={column.stageId}
              className={`hr-kanban__column ${isDropTarget ? 'hr-kanban__column--drop-active' : ''}`}
              aria-label={stageLabel}
              data-testid={`kanban-col-${column.stageId}`}
              onDragOver={(e) => {
                if (!canUpdate) return;
                e.preventDefault();
                if (dragOverStageId !== column.stageId) {
                  setDragOverStageId(column.stageId);
                }
              }}
              onDragLeave={() => {
                if (dragOverStageId === column.stageId) {
                  setDragOverStageId(null);
                }
              }}
              onDrop={(e) => void handleDrop(e, column)}
            >
              <header className="hr-kanban__col-header">
                <h2 className="hr-kanban__col-title">{stageLabel}</h2>
                <span className="hr-kanban__col-count">{column.count}</span>
              </header>

              <div className="hr-kanban__cards">
                {column.processes.length === 0 ? (
                  <p className="hr-kanban__empty">{t('processes.emptyColumn')}</p>
                ) : (
                  column.processes.map((proc) => {
                    const hasPrev = colIndex > 0;
                    const hasNext = colIndex < columns.length - 1;
                    const isBusy = movingId === proc.id;

                    return (
                      <article
                        key={proc.id}
                        className={`hr-kanban__card ${isBusy ? 'hr-kanban__card--busy' : ''}`}
                        draggable={canUpdate && !isBusy}
                        onDragStart={(e) => handleDragStart(e, proc)}
                        onDragEnd={() => {
                          setDraggingProcess(null);
                          setDragOverStageId(null);
                        }}
                        data-testid={`kanban-card-${proc.id}`}
                      >
                        <div className="hr-kanban__card-top">
                          <div className="hr-kanban__card-title-row">
                            {canUpdate ? (
                              <span className="hr-kanban__drag-handle" aria-hidden="true">
                                <GripVertical size={15} />
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className="hr-kanban__card-link"
                              onClick={() => onOpenDetail(proc)}
                            >
                              {proc.candidateName}
                            </button>
                          </div>
                          <StatusBadge status={processStatusVariant(proc.status)} label={proc.status} />
                        </div>

                        <div className="hr-kanban__card-meta">
                          <div className="hr-text-muted">{proc.jobTitle}</div>
                          {proc.companyName ? <div className="hr-text-muted">{proc.companyName}</div> : null}
                        </div>

                        <div className="hr-kanban__card-stats">
                          <span>
                            {proc.daysInStage ?? 0} {t('common.days')}
                          </span>
                          {proc.latestRating ? (
                            <span className="hr-kanban__rating">
                              <Star size={13} fill="currentColor" aria-hidden="true" />
                              {proc.latestRating}/5
                            </span>
                          ) : null}
                        </div>

                        <div className="hr-kanban__card-actions">
                          {canUpdate ? (
                            <div className="hr-kanban__step-controls">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!hasPrev || isBusy}
                                aria-label={`${t('processes.movePrev')}: ${proc.candidateName || proc.id}`}
                                onClick={() => void handleStepMove(proc, colIndex, -1)}
                                data-testid={`kanban-prev-${proc.id}`}
                              >
                                <ArrowLeft size={14} aria-hidden="true" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!hasNext || isBusy}
                                aria-label={`${t('processes.moveNext')}: ${proc.candidateName || proc.id}`}
                                onClick={() => void handleStepMove(proc, colIndex, 1)}
                                data-testid={`kanban-next-${proc.id}`}
                              >
                                <ArrowRight size={14} aria-hidden="true" />
                              </Button>
                            </div>
                          ) : null}

                          <Button
                            size="sm"
                            variant="neutral"
                            icon={<MessageSquareText size={14} />}
                            onClick={() => onOpenDetail(proc)}
                            data-testid={`kanban-detail-btn-${proc.id}`}
                          >
                            {t('processes.moveStage')}
                          </Button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
