import { Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { StatusBadge } from '../common/StatusBadge';
import { Tabs } from '../common/Tabs';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import {
  createProcessOffer,
  getProcessTimeline,
  moveToNextStage,
  rejectProcess,
  updateProcessOffer,
} from '../../services/processService';
import type {
  KanbanColumn,
  ProcessDetail,
  ProcessRecommendation,
  ProcessTimelineEvent,
} from '../../types/domain';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { translateStageName } from '../../utils/stageTranslation';

export interface ProcessDetailModalProps {
  processId: number | null;
  columns: KanbanColumn[];
  canUpdate: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

const RECOMMENDATIONS: ProcessRecommendation[] = ['Avançar', 'Rejeitar', 'Em Dúvida'];

export function ProcessDetailModal({
  processId,
  columns,
  canUpdate,
  onClose,
  onUpdated,
}: ProcessDetailModalProps) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [detail, setDetail] = useState<ProcessDetail | null>(null);
  const [timeline, setTimeline] = useState<ProcessTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Move / Evaluate form
  const [nextStageId, setNextStageId] = useState('');
  const [rating, setRating] = useState<number>(4);
  const [recommendation, setRecommendation] = useState<ProcessRecommendation>('Avançar');
  const [feedback, setFeedback] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');

  // Offer form
  const [offerPosition, setOfferPosition] = useState('');
  const [offerSalary, setOfferSalary] = useState('');
  const [offerStartDate, setOfferStartDate] = useState('');
  const [offerBenefits, setOfferBenefits] = useState('');
  const [offerConditions, setOfferConditions] = useState('');
  const [sendOfferEmail, setSendOfferEmail] = useState(false);

  // Reject form
  const [rejectReason, setRejectReason] = useState('');
  const [sendRejectEmail, setSendRejectEmail] = useState(false);

  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const loadDetail = useCallback(
    async (showSpinner = false) => {
      if (!processId) return;
      if (showSpinner) setLoading(true);
      try {
        const res = await getProcessTimeline(processId);
        setDetail(res.process);
        setTimeline(res.timeline);
        setOfferPosition(res.process.jobTitle || '');

        const currentCols = columnsRef.current;
        const currentIdx = currentCols.findIndex((c) => c.stageId === res.process.currentStageId);
        const suggested =
          currentIdx >= 0 && currentIdx + 1 < currentCols.length
            ? currentCols[currentIdx + 1].stageId
            : res.process.currentStageId;
        setNextStageId(String(suggested || res.process.currentStageId));
      } catch (err) {
        showToast({ variant: 'danger', message: parseApiError(err).message });
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [processId, showToast],
  );

  useEffect(() => {
    if (processId) {
      setFeedback('');
      setStrengths('');
      setWeaknesses('');
      setRejectReason('');
      void loadDetail(true);
    } else {
      setDetail(null);
      setTimeline([]);
    }
  }, [processId, loadDetail]);

  const handleAdvance = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSubmitting(true);
    try {
      await moveToNextStage(detail.id, {
        nextStageId: nextStageId ? Number(nextStageId) : undefined,
        rating,
        recommendation,
        feedback: feedback.trim() || null,
        strengths: strengths.trim() || null,
        weaknesses: weaknesses.trim() || null,
      });
      await Promise.all([loadDetail(false), onUpdated()]);
      showToast({ variant: 'success', message: t('processes.movedSuccess') });
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOffer = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSubmitting(true);
    try {
      await createProcessOffer(detail.id, {
        position: offerPosition.trim() || detail.jobTitle || null,
        salary: offerSalary ? Number(offerSalary) : null,
        startDate: offerStartDate || null,
        benefits: offerBenefits.trim() || null,
        conditions: offerConditions.trim() || null,
        sendEmail: sendOfferEmail,
      });
      await Promise.all([loadDetail(false), onUpdated()]);
      showToast({ variant: 'success', message: t('processes.offerCreatedSuccess') });
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferDecision = async (offerId: number, accept: boolean) => {
    if (!detail) return;
    setSubmitting(true);
    try {
      await updateProcessOffer(detail.id, offerId, {
        status: accept ? 'Aceita' : 'Recusada',
        advanceToHired: accept,
      });
      await Promise.all([loadDetail(false), onUpdated()]);
      showToast({ variant: 'success', message: t('processes.offerUpdatedSuccess') });
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail || rejectReason.trim().length < 3) return;
    setSubmitting(true);
    try {
      await rejectProcess(detail.id, {
        reason: rejectReason.trim(),
        rating,
        sendEmail: sendRejectEmail,
      });
      await Promise.all([loadDetail(false), onUpdated()]);
      showToast({ variant: 'success', message: t('processes.rejectSuccess') });
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSubmitting(false);
    }
  };

  const stageOptions = columns.map((col) => ({
    value: String(col.stageId),
    label: translateStageName(col.stageName, i18n.language),
  }));

  return (
    <Modal
      open={Boolean(processId)}
      onClose={onClose}
      title={
        detail
          ? t('processes.detailTitle', {
              candidate: detail.candidateName || `#${detail.candidateId}`,
              job: detail.jobTitle || `#${detail.jobOpeningId}`,
            })
          : t('common.loading')
      }
      size="lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : detail ? (
        <div className="hr-detail-stack">
          <div className="hr-detail-banner">
            <span>
              <strong>{t('processes.stage')}:</strong>{' '}
              {translateStageName(detail.currentStageName || '', i18n.language)}
            </span>
            <StatusBadge
              status={
                detail.status === 'Concluído'
                  ? 'success'
                  : detail.status === 'Parado'
                    ? 'warning'
                    : 'info'
              }
              label={`${detail.status}${detail.finalResult ? ` (${detail.finalResult})` : ''}`}
            />
          </div>

          <Tabs
            label={t('processes.moveStage')}
            testIdPrefix="process-detail-tab"
            items={[
              {
                id: 'evaluate',
                label: t('processes.tabEvaluate'),
                content: (
                  <form className="hr-detail-stack" onSubmit={(e) => void handleAdvance(e)}>
                    <div className="hr-form-grid">
                      <Select
                        label={t('processes.nextStageLabel')}
                        value={nextStageId}
                        disabled={!canUpdate}
                        onChange={(e) => setNextStageId(e.target.value)}
                        options={stageOptions}
                      />
                      <Select
                        label={t('processes.recommendationLabel')}
                        value={recommendation}
                        disabled={!canUpdate}
                        onChange={(e) => setRecommendation(e.target.value as ProcessRecommendation)}
                        options={RECOMMENDATIONS.map((r) => ({ value: r, label: r }))}
                      />
                    </div>

                    <div>
                      <span className="hr-field__label" id="rating-group-label">
                        {t('processes.ratingLabel')}
                      </span>
                      <div className="hr-star-rating" role="radiogroup" aria-labelledby="rating-group-label">
                        {[1, 2, 3, 4, 5].map((starValue) => (
                          <button
                            key={starValue}
                            type="button"
                            role="radio"
                            aria-checked={rating === starValue}
                            aria-label={`${starValue} / 5`}
                            disabled={!canUpdate}
                            className={`hr-star-btn ${starValue <= rating ? 'hr-star-btn--active' : ''}`}
                            onClick={() => setRating(starValue)}
                            data-testid={`star-rating-${starValue}`}
                          >
                            <Star
                              size={20}
                              fill={starValue <= rating ? 'currentColor' : 'none'}
                              aria-hidden="true"
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <Input
                      label={t('processes.strengthsLabel')}
                      disabled={!canUpdate}
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                    />
                    <Input
                      label={t('processes.weaknessesLabel')}
                      disabled={!canUpdate}
                      value={weaknesses}
                      onChange={(e) => setWeaknesses(e.target.value)}
                    />
                    <div>
                      <label className="hr-field__label" htmlFor="proc-feedback">
                        {t('processes.feedbackLabel')}
                      </label>
                      <textarea
                        id="proc-feedback"
                        className="hr-textarea"
                        rows={3}
                        disabled={!canUpdate}
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                      />
                    </div>
                    {canUpdate ? (
                      <div>
                        <Button type="submit" disabled={submitting} data-testid="advance-stage-submit">
                          {submitting ? t('common.saving') : t('processes.advanceSubmit')}
                        </Button>
                      </div>
                    ) : null}
                  </form>
                ),
              },
              {
                id: 'offer',
                label: t('processes.tabOffer'),
                badge: detail.offers.length,
                content: (
                  <div className="hr-detail-stack">
                    {detail.offers.length > 0 ? (
                      <div>
                        <h3>{t('processes.existingOffers')}</h3>
                        <ul className="hr-simple-list">
                          {detail.offers.map((offer) => (
                            <li key={offer.id} className="hr-simple-list__row">
                              <div>
                                <strong>{offer.position}</strong> —{' '}
                                {formatCurrency(offer.salary, i18n.language)} ({offer.status})
                              </div>
                              {canUpdate && (offer.status === 'Enviada' || offer.status === 'Visualizada') ? (
                                <div className="hr-row-actions">
                                  <Button
                                    size="sm"
                                    disabled={submitting}
                                    onClick={() => void handleOfferDecision(offer.id, true)}
                                    data-testid={`accept-offer-${offer.id}`}
                                  >
                                    {t('processes.markAcceptedHire')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    disabled={submitting}
                                    onClick={() => void handleOfferDecision(offer.id, false)}
                                  >
                                    {t('processes.markRejected')}
                                  </Button>
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {canUpdate ? (
                      <form className="hr-form-grid" onSubmit={(e) => void handleCreateOffer(e)}>
                        <Input
                          label={t('processes.offerPosition')}
                          value={offerPosition}
                          onChange={(e) => setOfferPosition(e.target.value)}
                        />
                        <Input
                          label={t('processes.offerSalary')}
                          type="number"
                          min={0}
                          value={offerSalary}
                          onChange={(e) => setOfferSalary(e.target.value)}
                        />
                        <Input
                          label={t('processes.offerStartDate')}
                          type="date"
                          value={offerStartDate}
                          onChange={(e) => setOfferStartDate(e.target.value)}
                        />
                        <Input
                          label={t('processes.offerBenefits')}
                          value={offerBenefits}
                          onChange={(e) => setOfferBenefits(e.target.value)}
                        />
                        <div className="hr-form-full">
                          <Input
                            label={t('processes.offerConditions')}
                            value={offerConditions}
                            onChange={(e) => setOfferConditions(e.target.value)}
                          />
                        </div>
                        <label className="hr-checkbox-row hr-form-full">
                          <input
                            type="checkbox"
                            checked={sendOfferEmail}
                            onChange={(e) => setSendOfferEmail(e.target.checked)}
                          />
                          <span>{t('processes.sendOfferEmail')}</span>
                        </label>
                        <div className="hr-form-full">
                          <Button type="submit" disabled={submitting} data-testid="send-offer-submit">
                            {submitting ? t('common.saving') : t('processes.sendOfferSubmit')}
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ),
              },
              {
                id: 'reject',
                label: t('processes.tabReject'),
                content: (
                  <form className="hr-detail-stack" onSubmit={(e) => void handleReject(e)}>
                    <div>
                      <label className="hr-field__label" htmlFor="reject-reason">
                        {t('processes.rejectReason')}
                      </label>
                      <textarea
                        id="reject-reason"
                        className="hr-textarea"
                        rows={3}
                        required
                        minLength={3}
                        disabled={!canUpdate}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                    </div>
                    <label className="hr-checkbox-row">
                      <input
                        type="checkbox"
                        disabled={!canUpdate}
                        checked={sendRejectEmail}
                        onChange={(e) => setSendRejectEmail(e.target.checked)}
                      />
                      <span>{t('processes.sendRejectEmail')}</span>
                    </label>
                    {canUpdate ? (
                      <div>
                        <Button
                          type="submit"
                          variant="danger"
                          disabled={submitting || rejectReason.trim().length < 3}
                          data-testid="reject-process-submit"
                        >
                          {submitting ? t('common.saving') : t('processes.rejectSubmit')}
                        </Button>
                      </div>
                    ) : null}
                  </form>
                ),
              },
              {
                id: 'timeline',
                label: t('processes.tabTimeline'),
                badge: timeline.length,
                content: (
                  <ol className="hr-timeline" data-testid="process-timeline-list">
                    {timeline.map((evt, idx) => (
                      <li key={idx} className="hr-timeline__item">
                        <div className="hr-timeline__head">
                          <strong>{evt.title}</strong>
                          <span className="hr-text-muted">
                            {formatDateTime(evt.timestamp, i18n.language)}
                          </span>
                        </div>
                        {evt.description ? <p className="hr-timeline__desc">{evt.description}</p> : null}
                        {evt.actorName ? (
                          <span className="hr-text-muted">{evt.actorName}</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ),
              },
            ]}
          />
        </div>
      ) : null}
    </Modal>
  );
}
