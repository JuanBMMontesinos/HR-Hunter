import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { ConfirmModal } from '../common/ConfirmModal';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import {
  createFunnel,
  createStageTemplate,
  deleteFunnel,
  deleteStageTemplate,
  listFunnels,
  listStageTemplates,
  updateFunnel,
  updateStageTemplate,
} from '../../services/settingsService';
import type { StageFunnel, StageTemplate } from '../../types/domain';
import { translateStageName } from '../../utils/stageTranslation';

export function StagesAndFunnelsTab() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [stages, setStages] = useState<StageTemplate[]>([]);
  const [funnels, setFunnels] = useState<StageFunnel[]>([]);
  const [loading, setLoading] = useState(true);

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<StageTemplate | null>(null);
  const [stageName, setStageName] = useState('');
  const [stageOrder, setStageOrder] = useState('1');
  const [requiresFeedback, setRequiresFeedback] = useState(false);
  const [isTerminal, setIsTerminal] = useState(false);
  const [savingStage, setSavingStage] = useState(false);

  const [funnelModalOpen, setFunnelModalOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<StageFunnel | null>(null);
  const [funnelName, setFunnelName] = useState('');
  const [funnelDesc, setFunnelDesc] = useState('');
  const [funnelDefault, setFunnelDefault] = useState(false);
  const [selectedStageIds, setSelectedStageIds] = useState<number[]>([]);
  const [savingFunnel, setSavingFunnel] = useState(false);

  const [deleteStageTarget, setDeleteStageTarget] = useState<StageTemplate | null>(null);
  const [deleteFunnelTarget, setDeleteFunnelTarget] = useState<StageFunnel | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [stageList, funnelList] = await Promise.all([listStageTemplates(), listFunnels()]);
      setStages(stageList);
      setFunnels(funnelList);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openCreateStage = () => {
    setEditingStage(null);
    setStageName('');
    setStageOrder(String(stages.length + 1));
    setRequiresFeedback(false);
    setIsTerminal(false);
    setStageModalOpen(true);
  };

  const openEditStage = (st: StageTemplate) => {
    setEditingStage(st);
    setStageName(st.stageName);
    setStageOrder(String(st.stageOrder));
    setRequiresFeedback(st.requiresFeedback);
    setIsTerminal(st.isTerminal);
    setStageModalOpen(true);
  };

  const handleSaveStage = async (e: FormEvent) => {
    e.preventDefault();
    setSavingStage(true);
    try {
      const payload = {
        stageName: stageName.trim(),
        stageOrder: Number(stageOrder) || 1,
        isActive: true,
        requiresFeedback,
        isTerminal,
        description: null,
      };
      if (editingStage) {
        await updateStageTemplate(editingStage.id, payload);
      } else {
        await createStageTemplate(payload);
      }
      showToast({ variant: 'success', message: t('settings.stagesFunnels.savedStage') });
      setStageModalOpen(false);
      await loadAll();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSavingStage(false);
    }
  };

  const openCreateFunnel = () => {
    setEditingFunnel(null);
    setFunnelName('');
    setFunnelDesc('');
    setFunnelDefault(false);
    setSelectedStageIds(stages.slice(0, 4).map((s) => s.id));
    setFunnelModalOpen(true);
  };

  const openEditFunnel = (fn: StageFunnel) => {
    setEditingFunnel(fn);
    setFunnelName(fn.name);
    setFunnelDesc(fn.description || '');
    setFunnelDefault(fn.isDefault);
    setSelectedStageIds(
      [...fn.items]
        .sort((a, b) => a.stageOrder - b.stageOrder)
        .map((item) => item.stageId),
    );
    setFunnelModalOpen(true);
  };

  const toggleFunnelStage = (stageId: number) => {
    setSelectedStageIds((prev) =>
      prev.includes(stageId) ? prev.filter((id) => id !== stageId) : [...prev, stageId],
    );
  };

  const moveFunnelStage = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= selectedStageIds.length) return;
    const next = [...selectedStageIds];
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedStageIds(next);
  };

  const handleSaveFunnel = async (e: FormEvent) => {
    e.preventDefault();
    setSavingFunnel(true);
    try {
      const payload = {
        name: funnelName.trim(),
        description: funnelDesc.trim() || null,
        isActive: true,
        isDefault: funnelDefault,
        items: selectedStageIds.map((stageId, idx) => ({ stageId, stageOrder: idx + 1 })),
      };
      if (editingFunnel) {
        await updateFunnel(editingFunnel.id, payload);
      } else {
        await createFunnel(payload);
      }
      showToast({ variant: 'success', message: t('settings.stagesFunnels.savedFunnel') });
      setFunnelModalOpen(false);
      await loadAll();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSavingFunnel(false);
    }
  };

  if (loading) return <p>{t('common.loading')}</p>;

  return (
    <div className="hr-detail-stack">
      <section className="hr-card hr-section-card hr-detail-stack">
        <header className="hr-chart-card__head">
          <h2 className="hr-chart-card__title">{t('settings.stagesFunnels.stagesTitle')}</h2>
          <Button size="sm" icon={<Plus size={14} />} onClick={openCreateStage} data-testid="new-stage-btn">
            {t('settings.stagesFunnels.newStage')}
          </Button>
        </header>

        <div className="hr-table-scroll">
          <table className="hr-mini-table">
            <thead>
              <tr>
                <th>{t('settings.stagesFunnels.stageOrder')}</th>
                <th>{t('settings.stagesFunnels.stageName')}</th>
                <th>{t('settings.stagesFunnels.requiresFeedback')}</th>
                <th>{t('settings.stagesFunnels.isTerminal')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((st) => (
                <tr key={st.id}>
                  <td>{st.stageOrder}</td>
                  <td>{translateStageName(st.stageName, i18n.language)}</td>
                  <td>{st.requiresFeedback ? t('common.yes') : t('common.no')}</td>
                  <td>{st.isTerminal ? t('common.yes') : t('common.no')}</td>
                  <td>
                    <div className="hr-row-actions">
                      <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => openEditStage(st)}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 size={13} />}
                        onClick={() => setDeleteStageTarget(st)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="hr-card hr-section-card hr-detail-stack">
        <header className="hr-chart-card__head">
          <h2 className="hr-chart-card__title">{t('settings.stagesFunnels.funnelsTitle')}</h2>
          <Button size="sm" icon={<Plus size={14} />} onClick={openCreateFunnel} data-testid="new-funnel-btn">
            {t('settings.stagesFunnels.newFunnel')}
          </Button>
        </header>

        <ul className="hr-simple-list">
          {funnels.map((fn) => (
            <li key={fn.id} className="hr-simple-list__row">
              <div>
                <strong>{fn.name}</strong>{' '}
                {fn.isDefault ? <StatusBadge status="success" label={t('settings.stagesFunnels.isDefault')} /> : null}
                <div className="hr-text-muted">
                  {fn.items.map((item) => translateStageName(item.stageName, i18n.language)).join(' → ')}
                </div>
              </div>
              <div className="hr-row-actions">
                <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => openEditFunnel(fn)}>
                  {t('common.edit')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={13} />}
                  onClick={() => setDeleteFunnelTarget(fn)}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Modal
        open={stageModalOpen}
        onClose={() => setStageModalOpen(false)}
        title={t('settings.stagesFunnels.newStage')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStageModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="stage-form" disabled={savingStage} data-testid="stage-save-btn">
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="stage-form" className="hr-detail-stack" onSubmit={(e) => void handleSaveStage(e)}>
          <Input
            label={t('settings.stagesFunnels.stageName')}
            required
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
          />
          <Input
            label={t('settings.stagesFunnels.stageOrder')}
            type="number"
            min={1}
            required
            value={stageOrder}
            onChange={(e) => setStageOrder(e.target.value)}
          />
          <label className="hr-checkbox-row">
            <input
              type="checkbox"
              checked={requiresFeedback}
              onChange={(e) => setRequiresFeedback(e.target.checked)}
            />
            <span>{t('settings.stagesFunnels.requiresFeedback')}</span>
          </label>
          <label className="hr-checkbox-row">
            <input
              type="checkbox"
              checked={isTerminal}
              onChange={(e) => setIsTerminal(e.target.checked)}
            />
            <span>{t('settings.stagesFunnels.isTerminal')}</span>
          </label>
        </form>
      </Modal>

      <Modal
        open={funnelModalOpen}
        onClose={() => setFunnelModalOpen(false)}
        title={t('settings.stagesFunnels.newFunnel')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFunnelModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="funnel-form" disabled={savingFunnel}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="funnel-form" className="hr-detail-stack" onSubmit={(e) => void handleSaveFunnel(e)}>
          <Input
            label={t('settings.stagesFunnels.funnelName')}
            required
            value={funnelName}
            onChange={(e) => setFunnelName(e.target.value)}
          />
          <Input label={t('jobOpenings.description')} value={funnelDesc} onChange={(e) => setFunnelDesc(e.target.value)} />
          <label className="hr-checkbox-row">
            <input
              type="checkbox"
              checked={funnelDefault}
              onChange={(e) => setFunnelDefault(e.target.checked)}
            />
            <span>{t('settings.stagesFunnels.isDefault')}</span>
          </label>
          <div>
            <strong>{t('settings.stagesFunnels.stagesInFunnel')}</strong>
            <div className="hr-chip-wrap">
              {stages.map((st) => (
                <label key={st.id} className="hr-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedStageIds.includes(st.id)}
                    onChange={() => toggleFunnelStage(st.id)}
                  />
                  <span>{translateStageName(st.stageName, i18n.language)}</span>
                </label>
              ))}
            </div>
            <ul className="hr-simple-list">
              {selectedStageIds.map((id, idx) => {
                const st = stages.find((s) => s.id === id);
                if (!st) return null;
                return (
                  <li key={id} className="hr-simple-list__row">
                    <span>
                      {idx + 1}. {translateStageName(st.stageName, i18n.language)}
                    </span>
                    <div className="hr-row-actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={idx === 0}
                        aria-label={`${t('settings.stagesFunnels.moveUp')} ${st.stageName}`}
                        onClick={() => moveFunnelStage(idx, -1)}
                      >
                        <ArrowUp size={13} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={idx === selectedStageIds.length - 1}
                        aria-label={`${t('settings.stagesFunnels.moveDown')} ${st.stageName}`}
                        onClick={() => moveFunnelStage(idx, 1)}
                      >
                        <ArrowDown size={13} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteStageTarget)}
        title={t('common.delete')}
        message={`${t('common.delete')} "${deleteStageTarget?.stageName || ''}"?`}
        onConfirm={async () => {
          if (!deleteStageTarget) return;
          try {
            await deleteStageTemplate(deleteStageTarget.id);
            showToast({ variant: 'success', message: t('settings.stagesFunnels.deletedStage') });
            setDeleteStageTarget(null);
            await loadAll();
          } catch (err) {
            showToast({ variant: 'danger', message: parseApiError(err).message });
          }
        }}
        onClose={() => setDeleteStageTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteFunnelTarget)}
        title={t('common.delete')}
        message={`${t('common.delete')} "${deleteFunnelTarget?.name || ''}"?`}
        onConfirm={async () => {
          if (!deleteFunnelTarget) return;
          try {
            await deleteFunnel(deleteFunnelTarget.id);
            showToast({ variant: 'success', message: t('settings.stagesFunnels.deletedFunnel') });
            setDeleteFunnelTarget(null);
            await loadAll();
          } catch (err) {
            showToast({ variant: 'danger', message: parseApiError(err).message });
          }
        }}
        onClose={() => setDeleteFunnelTarget(null)}
      />
    </div>
  );
}
