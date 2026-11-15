import { Kanban, List, Plus, Workflow } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/common/Button';
import { DataTable, type DataTableColumn } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ProcessDetailModal } from '../../components/processes/ProcessDetailModal';
import { ProcessKanban } from '../../components/processes/ProcessKanban';
import { useToast } from '../../contexts/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { parseApiError } from '../../services/api';
import { listCandidates } from '../../services/candidateService';
import { listJobOpenings } from '../../services/jobOpeningService';
import {
  createProcess,
  getKanbanBoard,
  listProcesses,
  moveToNextStage,
} from '../../services/processService';
import { listFunnels } from '../../services/settingsService';
import type { PaginationState, SelectOption } from '../../types/common';
import {
  toPaginationState,
  type KanbanColumn,
  type ProcessItem,
  type ProcessStatus,
} from '../../types/domain';
import { translateStageName } from '../../utils/stageTranslation';

const PROCESS_STATUSES: ProcessStatus[] = ['Em Andamento', 'Parado', 'Concluído'];

export function ProcessesPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { can } = usePermissions();

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tableRows, setTableRows] = useState<ProcessItem[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState('');

  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [funnelFilter, setFunnelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [jobOptions, setJobOptions] = useState<SelectOption[]>([]);
  const [funnelOptions, setFunnelOptions] = useState<SelectOption[]>([]);
  const [candidateOptions, setCandidateOptions] = useState<SelectOption[]>([]);

  const [detailProcessId, setDetailProcessId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newJobId, setNewJobId] = useState('');
  const [newCandidateId, setNewCandidateId] = useState('');
  const [newFeedback, setNewFeedback] = useState('');
  const [creating, setCreating] = useState(false);

  const loadRefs = useCallback(async () => {
    try {
      const [jobsRes, funnelsList] = await Promise.all([
        listJobOpenings({ limit: 50 }),
        listFunnels().catch(() => []),
      ]);
      setJobOptions(
        jobsRes.items.map((j) => ({
          value: String(j.id),
          label: `${j.title} — ${j.companyName || `#${j.companyId}`}`,
        })),
      );
      setFunnelOptions(
        funnelsList.map((f) => ({
          value: String(f.id),
          label: f.name,
        })),
      );
    } catch {
      // Non-blocking filter metadata
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const board = await getKanbanBoard({
        jobOpeningId: jobFilter ? Number(jobFilter) : undefined,
        funnelId: funnelFilter ? Number(funnelFilter) : undefined,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setColumns(board.columns);

      if (viewMode === 'table') {
        const listRes = await listProcesses({
          page,
          limit: 20,
          jobOpeningId: jobFilter ? Number(jobFilter) : undefined,
          funnelId: funnelFilter ? Number(funnelFilter) : undefined,
          status: statusFilter || undefined,
          search: search.trim() || undefined,
        });
        setTableRows(listRes.items);
        setPagination(toPaginationState(listRes));
      }
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [viewMode, page, jobFilter, funnelFilter, statusFilter, search, showToast]);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenCreate = async () => {
    setCreateOpen(true);
    setNewFeedback('');
    try {
      const [jobsRes, candsRes] = await Promise.all([
        listJobOpenings({ limit: 50 }),
        listCandidates({ limit: 50, status: 'Ativo' }),
      ]);
      const openJobs = jobsRes.items.filter((j) => j.status === 'Aberta' || j.status === 'Em Progresso');
      setJobOptions(
        openJobs.map((j) => ({
          value: String(j.id),
          label: `${j.title} — ${j.companyName || `#${j.companyId}`}`,
        })),
      );
      setCandidateOptions(
        candsRes.items.map((c) => ({
          value: String(c.id),
          label: `${c.fullName} (${c.email})`,
        })),
      );
      setNewJobId(openJobs[0] ? String(openJobs[0].id) : '');
      setNewCandidateId(candsRes.items[0] ? String(candsRes.items[0].id) : '');
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    }
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newJobId || !newCandidateId) return;
    setCreating(true);
    try {
      await createProcess({
        jobOpeningId: Number(newJobId),
        candidateId: Number(newCandidateId),
        feedback: newFeedback.trim() || null,
      });
      showToast({ variant: 'success', message: t('processes.createdSuccess') });
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setCreating(false);
    }
  };

  const handleKanbanMove = async (
    proc: ProcessItem,
    targetStageId: number,
    targetStageName: string,
  ) => {
    if (proc.currentStageId === targetStageId) return;
    try {
      await moveToNextStage(proc.id, { nextStageId: targetStageId });
      const translatedStage = translateStageName(targetStageName, i18n.language);
      setAnnouncement(
        t('processes.movedAnnouncement', {
          candidate: proc.candidateName || `#${proc.id}`,
          stage: translatedStage,
        }),
      );
      showToast({ variant: 'success', message: t('processes.movedSuccess') });
      await loadData();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    }
  };

  const tableColumns: Array<DataTableColumn<ProcessItem>> = [
    {
      key: 'candidateName',
      label: t('processes.candidate'),
      render: (row) => (
        <div>
          <strong>{row.candidateName}</strong>
          <div className="hr-text-muted">{row.candidateEmail}</div>
        </div>
      ),
    },
    {
      key: 'jobTitle',
      label: t('processes.jobOpening'),
      render: (row) => (
        <div>
          <strong>{row.jobTitle}</strong>
          <div className="hr-text-muted">{row.companyName}</div>
        </div>
      ),
    },
    {
      key: 'currentStageName',
      label: t('processes.stage'),
      render: (row) => translateStageName(row.currentStageName || '', i18n.language),
    },
    {
      key: 'daysInStage',
      label: t('processes.daysInStage'),
      align: 'center',
      render: (row) => `${row.daysInStage ?? 0}d`,
    },
    {
      key: 'status',
      label: t('processes.status'),
      render: (row) => (
        <StatusBadge
          status={row.status === 'Concluído' ? 'success' : row.status === 'Parado' ? 'warning' : 'info'}
          label={row.status}
        />
      ),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="neutral" onClick={() => setDetailProcessId(row.id)}>
          {t('processes.moveStage')}
        </Button>
      ),
    },
  ];

  const canUpdate = can('processes', 'update');

  return (
    <div className="hr-page" data-testid="processes-page">
      <div className="hr-page-heading hr-page-heading--row">
        <div>
          <h1 className="hr-page-heading__title">
            <Workflow size={24} className="hr-inline-icon" aria-hidden="true" />
            {t('processes.title')}
          </h1>
          <p className="hr-page-heading__subtitle">{t('pages.processesSubtitle')}</p>
        </div>
        <div className="hr-row-actions">
          <Button
            variant={viewMode === 'kanban' ? 'solid' : 'ghost'}
            size="sm"
            icon={<Kanban size={15} />}
            onClick={() => setViewMode('kanban')}
            data-testid="processes-view-kanban"
          >
            {t('processes.viewKanban')}
          </Button>
          <Button
            variant={viewMode === 'table' ? 'solid' : 'ghost'}
            size="sm"
            icon={<List size={15} />}
            onClick={() => setViewMode('table')}
            data-testid="processes-view-table"
          >
            {t('processes.viewTable')}
          </Button>
          {can('processes', 'create') ? (
            <Button icon={<Plus size={16} />} onClick={() => void handleOpenCreate()} data-testid="new-process-btn">
              {t('processes.newProcess')}
            </Button>
          ) : null}
        </div>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder={t('processes.searchPlaceholder')}
        hasActiveFilters={Boolean(jobFilter || funnelFilter || statusFilter)}
        onClearFilters={() => {
          setSearch('');
          setJobFilter('');
          setFunnelFilter('');
          setStatusFilter('');
          setPage(1);
        }}
      >
        <Select
          label={t('processes.filterByJob')}
          value={jobFilter}
          onChange={(e) => {
            setJobFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={jobOptions}
        />
        <Select
          label={t('processes.filterByFunnel')}
          value={funnelFilter}
          onChange={(e) => {
            setFunnelFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={funnelOptions}
        />
        <Select
          label={t('processes.filterByStatus')}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={PROCESS_STATUSES.map((s) => ({ value: s, label: s }))}
        />
      </FilterBar>

      {loading && columns.length === 0 ? (
        <p>{t('common.loading')}</p>
      ) : viewMode === 'kanban' ? (
        <ProcessKanban
          columns={columns}
          canUpdate={canUpdate}
          announcement={announcement}
          onMoveStage={handleKanbanMove}
          onOpenDetail={(proc) => setDetailProcessId(proc.id)}
        />
      ) : (
        <DataTable
          caption={t('processes.title')}
          columns={tableColumns}
          data={tableRows}
          rowKey={(row) => row.id}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <ProcessDetailModal
        processId={detailProcessId}
        columns={columns}
        canUpdate={canUpdate}
        onClose={() => setDetailProcessId(null)}
        onUpdated={loadData}
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('processes.newProcess')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="new-process-form"
              disabled={creating || !newJobId || !newCandidateId}
              data-testid="create-process-submit"
            >
              {creating ? t('common.saving') : t('common.confirm')}
            </Button>
          </>
        }
      >
        <form id="new-process-form" className="hr-detail-stack" onSubmit={(e) => void handleCreateSubmit(e)}>
          <Select
            label={t('processes.jobOpening')}
            required
            value={newJobId}
            onChange={(e) => setNewJobId(e.target.value)}
            options={jobOptions}
          />
          <Select
            label={t('processes.candidate')}
            required
            value={newCandidateId}
            onChange={(e) => setNewCandidateId(e.target.value)}
            options={candidateOptions}
          />
          <Input
            label={t('candidates.initialFeedback')}
            value={newFeedback}
            onChange={(e) => setNewFeedback(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
