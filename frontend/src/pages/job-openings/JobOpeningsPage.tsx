import { Briefcase, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete } from '../../components/common/Autocomplete';
import { Button } from '../../components/common/Button';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { DataTable, type DataTableColumn } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Tabs } from '../../components/common/Tabs';
import { useToast } from '../../contexts/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { parseApiError } from '../../services/api';
import { listCompanies } from '../../services/companyService';
import {
  createJobOpening,
  deleteJobOpening,
  getJobOpeningAnalytics,
  getJobOpeningById,
  getJobOpeningCandidates,
  listJobOpenings,
  updateJobOpening,
} from '../../services/jobOpeningService';
import { listFunnels } from '../../services/settingsService';
import type { PaginationState, SelectOption } from '../../types/common';
import {
  toPaginationState,
  type JobContractType,
  type JobLevel,
  type JobOpening,
  type JobOpeningAnalytics,
  type JobOpeningPayload,
  type JobOpeningStatus,
  type JobPriority,
  type JobRegime,
  type ProcessItem,
  type StageFunnel,
} from '../../types/domain';
import { formatCurrency, formatDate, toDateInputValue } from '../../utils/formatters';
import { translateStageName } from '../../utils/stageTranslation';

const LEVELS: JobLevel[] = ['Estagiário', 'Júnior', 'Pleno', 'Sênior', 'Especialista'];
const CONTRACT_TYPES: JobContractType[] = ['CLT', 'PJ', 'Temporário', 'Estágio'];
const REGIMES: JobRegime[] = ['Presencial', 'Híbrido', 'Remoto'];
const STATUSES: JobOpeningStatus[] = ['Aberta', 'Em Progresso', 'Preenchida', 'Cancelada'];
const PRIORITIES: JobPriority[] = ['Alta', 'Média', 'Baixa'];

interface JobFormState {
  companyId: string;
  funnelId: string;
  title: string;
  description: string;
  department: string;
  level: string;
  contractType: string;
  regime: string;
  minSalary: string;
  maxSalary: string;
  quantityNeeded: string;
  requiredSkills: string;
  desiredSkills: string;
  benefits: string;
  openedAt: string;
  plannedClosedAt: string;
  closedReason: string;
  status: JobOpeningStatus;
  priority: JobPriority;
}

const INITIAL_JOB_FORM: JobFormState = {
  companyId: '',
  funnelId: '',
  title: '',
  description: '',
  department: '',
  level: 'Pleno',
  contractType: 'CLT',
  regime: 'Híbrido',
  minSalary: '',
  maxSalary: '',
  quantityNeeded: '1',
  requiredSkills: '',
  desiredSkills: '',
  benefits: '',
  openedAt: new Date().toISOString().slice(0, 10),
  plannedClosedAt: '',
  closedReason: '',
  status: 'Aberta',
  priority: 'Média',
};

function jobStatusVariant(status: JobOpeningStatus) {
  if (status === 'Preenchida') return 'success' as const;
  if (status === 'Cancelada') return 'danger' as const;
  if (status === 'Em Progresso') return 'warning' as const;
  return 'info' as const;
}

export function JobOpeningsPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { can } = usePermissions();

  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([]);
  const [funnels, setFunnels] = useState<StageFunnel[]>([]);

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null);
  const [form, setForm] = useState<JobFormState>(INITIAL_JOB_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [detailJob, setDetailJob] = useState<JobOpening | null>(null);
  const [detailCandidates, setDetailCandidates] = useState<ProcessItem[]>([]);
  const [detailAnalytics, setDetailAnalytics] = useState<JobOpeningAnalytics | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<JobOpening | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadReferenceData = useCallback(async () => {
    try {
      const [compRes, funnelList] = await Promise.all([
        listCompanies({ limit: 20 }),
        listFunnels().catch(() => []),
      ]);
      setCompanyOptions(
        compRes.items.map((c) => ({
          value: String(c.id),
          label: c.legalName,
          hint: c.tradeName || c.sector || undefined,
        })),
      );
      setFunnels(funnelList);
    } catch {
      // Reference errors surface on save if critical
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listJobOpenings({
        page,
        limit: 20,
        search: search.trim() || undefined,
        companyId: companyFilter ? Number(companyFilter) : undefined,
        status: statusFilter || undefined,
        level: levelFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setJobs(res.items);
      setPagination(toPaginationState(res));
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [page, search, companyFilter, statusFilter, levelFilter, priorityFilter, showToast]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const funnelOptions: SelectOption[] = useMemo(
    () =>
      funnels.map((f) => ({
        value: String(f.id),
        label: f.isDefault ? `${f.name} (${t('settings.stagesFunnels.isDefault')})` : f.name,
      })),
    [funnels, t],
  );

  const openCreate = () => {
    const defaultFunnel = funnels.find((f) => f.isDefault) || funnels[0];
    setEditingJob(null);
    setForm({
      ...INITIAL_JOB_FORM,
      funnelId: defaultFunnel ? String(defaultFunnel.id) : '',
    });
    setFormOpen(true);
  };

  const openEdit = (job: JobOpening) => {
    setEditingJob(job);
    setForm({
      companyId: String(job.companyId),
      funnelId: job.funnelId ? String(job.funnelId) : '',
      title: job.title,
      description: job.description || '',
      department: job.department || '',
      level: job.level || '',
      contractType: job.contractType || '',
      regime: job.regime || '',
      minSalary: job.minSalary !== null && job.minSalary !== undefined ? String(job.minSalary) : '',
      maxSalary: job.maxSalary !== null && job.maxSalary !== undefined ? String(job.maxSalary) : '',
      quantityNeeded: String(job.quantityNeeded || 1),
      requiredSkills: job.requiredSkills || '',
      desiredSkills: job.desiredSkills || '',
      benefits: job.benefits || '',
      openedAt: toDateInputValue(job.openedAt),
      plannedClosedAt: toDateInputValue(job.plannedClosedAt),
      closedReason: job.closedReason || '',
      status: job.status,
      priority: job.priority,
    });
    setFormOpen(true);
  };

  const openDetails = async (job: JobOpening) => {
    setDetailLoading(true);
    setDetailJob(job);
    try {
      const [full, cands, analytics] = await Promise.all([
        getJobOpeningById(job.id),
        getJobOpeningCandidates(job.id),
        getJobOpeningAnalytics(job.id),
      ]);
      setDetailJob(full);
      setDetailCandidates(cands);
      setDetailAnalytics(analytics);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (editingJob?.status === 'Preenchida') return;

    if (!form.companyId || !form.title.trim()) {
      showToast({ variant: 'warning', message: t('jobOpenings.validationRequired') });
      return;
    }

    setSubmitting(true);
    try {
      const payload: JobOpeningPayload = {
        companyId: Number(form.companyId),
        funnelId: form.funnelId ? Number(form.funnelId) : null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        department: form.department.trim() || null,
        level: (form.level as JobLevel) || null,
        contractType: (form.contractType as JobContractType) || null,
        regime: (form.regime as JobRegime) || null,
        minSalary: form.minSalary ? Number(form.minSalary) : null,
        maxSalary: form.maxSalary ? Number(form.maxSalary) : null,
        quantityNeeded: form.quantityNeeded ? Number(form.quantityNeeded) : 1,
        requiredSkills: form.requiredSkills.trim() || null,
        desiredSkills: form.desiredSkills.trim() || null,
        benefits: form.benefits.trim() || null,
        openedAt: form.openedAt || null,
        plannedClosedAt: form.plannedClosedAt || null,
        closedReason: form.closedReason.trim() || null,
        status: form.status,
        priority: form.priority,
      };

      if (editingJob) {
        await updateJobOpening(editingJob.id, payload);
        showToast({ variant: 'success', message: t('jobOpenings.updatedSuccess') });
      } else {
        await createJobOpening(payload);
        showToast({ variant: 'success', message: t('jobOpenings.createdSuccess') });
      }
      setFormOpen(false);
      await loadJobs();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteJobOpening(deleteTarget.id);
      showToast({ variant: 'success', message: t('jobOpenings.deletedSuccess') });
      setDeleteTarget(null);
      await loadJobs();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setDeleting(false);
    }
  };

  const isFilledLocked = editingJob?.status === 'Preenchida';

  const columns: Array<DataTableColumn<JobOpening>> = [
    {
      key: 'title',
      label: t('jobOpenings.jobTitle'),
      sortable: true,
      render: (row) => (
        <div>
          <strong>{row.title}</strong>
          <div className="hr-text-muted">{row.companyName || `#${row.companyId}`}</div>
        </div>
      ),
    },
    {
      key: 'department',
      label: t('jobOpenings.department'),
      sortable: true,
      render: (row) => row.department || '—',
    },
    {
      key: 'level',
      label: t('jobOpenings.level'),
      render: (row) => row.level || '—',
    },
    {
      key: 'daysOpen',
      label: t('jobOpenings.daysOpen'),
      align: 'center',
      sortable: true,
      render: (row) => `${row.daysOpen ?? 0}d`,
    },
    {
      key: 'totalCandidates',
      label: t('jobOpenings.candidates'),
      align: 'center',
      render: (row) => `${row.activeCandidates ?? 0} / ${row.totalCandidates ?? 0}`,
    },
    {
      key: 'priority',
      label: t('jobOpenings.priority'),
      render: (row) => (
        <StatusBadge
          status={row.priority === 'Alta' ? 'danger' : row.priority === 'Baixa' ? 'neutral' : 'warning'}
          label={row.priority}
        />
      ),
    },
    {
      key: 'status',
      label: t('jobOpenings.status'),
      render: (row) => <StatusBadge status={jobStatusVariant(row.status)} label={row.status} />,
    },
    {
      key: 'actions',
      label: t('common.actions'),
      align: 'right',
      render: (row) => (
        <div className="hr-row-actions">
          <Button
            size="sm"
            variant="ghost"
            icon={<Eye size={14} />}
            onClick={() => void openDetails(row)}
          >
            {t('common.view')}
          </Button>
          {can('job_openings', 'update') ? (
            <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => openEdit(row)}>
              {t('common.edit')}
            </Button>
          ) : null}
          {can('job_openings', 'delete') ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={14} />}
              onClick={() => setDeleteTarget(row)}
            >
              {t('common.delete')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="hr-page" data-testid="job-openings-page">
      <div className="hr-page-heading hr-page-heading--row">
        <div>
          <h1 className="hr-page-heading__title">
            <Briefcase size={24} className="hr-inline-icon" aria-hidden="true" />
            {t('jobOpenings.title')}
          </h1>
          <p className="hr-page-heading__subtitle">{t('pages.jobOpeningsSubtitle')}</p>
        </div>
        {can('job_openings', 'create') ? (
          <Button icon={<Plus size={16} />} onClick={openCreate} data-testid="new-job-btn">
            {t('jobOpenings.newJob')}
          </Button>
        ) : null}
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder={t('jobOpenings.searchPlaceholder')}
        hasActiveFilters={Boolean(companyFilter || statusFilter || levelFilter || priorityFilter)}
        onClearFilters={() => {
          setSearch('');
          setCompanyFilter('');
          setStatusFilter('');
          setLevelFilter('');
          setPriorityFilter('');
          setPage(1);
        }}
      >
        <Select
          label={t('jobOpenings.company')}
          value={companyFilter}
          onChange={(e) => {
            setCompanyFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={companyOptions}
        />
        <Select
          label={t('jobOpenings.status')}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Select
          label={t('jobOpenings.level')}
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={LEVELS.map((l) => ({ value: l, label: l }))}
        />
        <Select
          label={t('jobOpenings.priority')}
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
      </FilterBar>

      <DataTable
        caption={t('jobOpenings.title')}
        columns={columns}
        data={jobs}
        rowKey={(row) => row.id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingJob ? t('jobOpenings.editJob') : t('jobOpenings.newJob')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            {!isFilledLocked ? (
              <Button
                type="submit"
                form="job-opening-form"
                disabled={submitting}
                data-testid="job-save-btn"
              >
                {submitting ? t('common.saving') : t('common.save')}
              </Button>
            ) : null}
          </>
        }
      >
        {isFilledLocked ? (
          <div className="hr-banner hr-banner--warning" role="alert">
            {t('jobOpenings.filledReadOnlyNotice')}
          </div>
        ) : null}
        <form id="job-opening-form" className="hr-form-grid" onSubmit={(e) => void handleSave(e)}>
          <Autocomplete
            label={t('jobOpenings.company')}
            required
            disabled={isFilledLocked || Boolean(editingJob)}
            options={companyOptions}
            value={form.companyId}
            onChange={(val) => setForm((f) => ({ ...f, companyId: val }))}
          />
          <Select
            label={t('jobOpenings.funnel')}
            disabled={isFilledLocked}
            value={form.funnelId}
            onChange={(e) => setForm((f) => ({ ...f, funnelId: e.target.value }))}
            options={funnelOptions}
          />
          <Input
            label={t('jobOpenings.jobTitle')}
            required
            disabled={isFilledLocked}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            label={t('jobOpenings.department')}
            disabled={isFilledLocked}
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
          />
          <Select
            label={t('jobOpenings.level')}
            disabled={isFilledLocked}
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
            options={LEVELS.map((v) => ({ value: v, label: v }))}
          />
          <Select
            label={t('jobOpenings.contractType')}
            disabled={isFilledLocked}
            value={form.contractType}
            onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value }))}
            options={CONTRACT_TYPES.map((v) => ({ value: v, label: v }))}
          />
          <Select
            label={t('jobOpenings.regime')}
            disabled={isFilledLocked}
            value={form.regime}
            onChange={(e) => setForm((f) => ({ ...f, regime: e.target.value }))}
            options={REGIMES.map((v) => ({ value: v, label: v }))}
          />
          <Select
            label={t('jobOpenings.priority')}
            disabled={isFilledLocked}
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as JobPriority }))}
            options={PRIORITIES.map((v) => ({ value: v, label: v }))}
          />
          <Select
            label={t('jobOpenings.status')}
            disabled={isFilledLocked}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as JobOpeningStatus }))}
            options={STATUSES.map((v) => ({ value: v, label: v }))}
          />
          <Input
            label={t('jobOpenings.quantityNeeded')}
            type="number"
            min={1}
            disabled={isFilledLocked}
            value={form.quantityNeeded}
            onChange={(e) => setForm((f) => ({ ...f, quantityNeeded: e.target.value }))}
          />
          <Input
            label={t('jobOpenings.minSalary')}
            type="number"
            min={0}
            disabled={isFilledLocked}
            value={form.minSalary}
            onChange={(e) => setForm((f) => ({ ...f, minSalary: e.target.value }))}
          />
          <Input
            label={t('jobOpenings.maxSalary')}
            type="number"
            min={0}
            disabled={isFilledLocked}
            value={form.maxSalary}
            onChange={(e) => setForm((f) => ({ ...f, maxSalary: e.target.value }))}
          />
          <Input
            label={t('jobOpenings.openedAt')}
            type="date"
            disabled={isFilledLocked}
            value={form.openedAt}
            onChange={(e) => setForm((f) => ({ ...f, openedAt: e.target.value }))}
          />
          <Input
            label={t('jobOpenings.plannedClosedAt')}
            type="date"
            disabled={isFilledLocked}
            value={form.plannedClosedAt}
            onChange={(e) => setForm((f) => ({ ...f, plannedClosedAt: e.target.value }))}
          />
          <div className="hr-form-full">
            <label className="hr-field__label" htmlFor="job-desc">
              {t('jobOpenings.description')}
            </label>
            <textarea
              id="job-desc"
              className="hr-textarea"
              rows={3}
              disabled={isFilledLocked}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <Input
            label={t('jobOpenings.requiredSkills')}
            disabled={isFilledLocked}
            value={form.requiredSkills}
            onChange={(e) => setForm((f) => ({ ...f, requiredSkills: e.target.value }))}
          />
          <Input
            label={t('jobOpenings.desiredSkills')}
            disabled={isFilledLocked}
            value={form.desiredSkills}
            onChange={(e) => setForm((f) => ({ ...f, desiredSkills: e.target.value }))}
          />
          <Input
            label={t('jobOpenings.benefits')}
            disabled={isFilledLocked}
            value={form.benefits}
            onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(detailJob)}
        onClose={() => setDetailJob(null)}
        title={detailJob ? detailJob.title : t('jobOpenings.detailsTitle')}
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setDetailJob(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {detailLoading ? (
          <p>{t('common.loading')}</p>
        ) : detailJob ? (
          <Tabs
            label={t('jobOpenings.detailsTitle')}
            items={[
              {
                id: 'info',
                label: t('jobOpenings.infoTab'),
                content: (
                  <div className="hr-detail-stack">
                    <div className="hr-detail-grid">
                      <div>
                        <strong>{t('jobOpenings.company')}:</strong> {detailJob.companyName || '—'}
                      </div>
                      <div>
                        <strong>{t('jobOpenings.department')}:</strong> {detailJob.department || '—'}
                      </div>
                      <div>
                        <strong>{t('jobOpenings.salaryRange')}:</strong>{' '}
                        {formatCurrency(detailJob.minSalary, i18n.language)} —{' '}
                        {formatCurrency(detailJob.maxSalary, i18n.language)}
                      </div>
                      <div>
                        <strong>{t('jobOpenings.openedAt')}:</strong>{' '}
                        {formatDate(detailJob.openedAt, i18n.language)}
                      </div>
                    </div>
                    {detailJob.description ? <p>{detailJob.description}</p> : null}
                  </div>
                ),
              },
              {
                id: 'candidates',
                label: t('jobOpenings.candidatesTab'),
                badge: detailCandidates.length,
                content:
                  detailCandidates.length === 0 ? (
                    <p className="hr-text-muted">{t('table.noResults')}</p>
                  ) : (
                    <ul className="hr-simple-list">
                      {detailCandidates.map((p) => (
                        <li key={p.id}>
                          <strong>{p.candidateName}</strong> —{' '}
                          {translateStageName(p.currentStageName || '', i18n.language)} ({p.status})
                        </li>
                      ))}
                    </ul>
                  ),
              },
              {
                id: 'analytics',
                label: t('jobOpenings.analyticsTab'),
                content: detailAnalytics ? (
                  <div className="hr-detail-stack">
                    {detailAnalytics.candidatesByStage.map((row) => (
                      <div key={row.stageId} className="hr-bar-row">
                        <span className="hr-bar-row__label">
                          {translateStageName(row.stageName, i18n.language)}
                        </span>
                        <progress
                          className="hr-risk-progress"
                          max={Math.max(1, detailJob.totalCandidates || 1)}
                          value={row.candidateCount}
                        />
                        <span className="hr-bar-row__val">{row.candidateCount}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hr-text-muted">{t('common.noData')}</p>
                ),
              },
            ]}
          />
        ) : null}
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('jobOpenings.deleteTitle')}
        message={t('jobOpenings.deleteConfirm', { title: deleteTarget?.title || '' })}
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
