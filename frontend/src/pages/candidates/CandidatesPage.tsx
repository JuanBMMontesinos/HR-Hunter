import { Eye, FileSpreadsheet, Pencil, Plus, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  addCandidateEducation,
  addCandidateExperience,
  addCandidateSkill,
  createCandidate,
  deleteCandidate,
  deleteCandidateEducation,
  deleteCandidateExperience,
  deleteCandidateSkill,
  getCandidateById,
  importCandidatesCsv,
  importCandidatesFile,
  listCandidates,
  updateCandidate,
} from '../../services/candidateService';
import { listJobOpenings } from '../../services/jobOpeningService';
import { createProcess } from '../../services/processService';
import type { PaginationState, SelectOption } from '../../types/common';
import {
  toPaginationState,
  type Candidate,
  type CandidateDetail,
  type CandidateEducation,
  type CandidateExperience,
  type CandidateGender,
  type CandidateSkill,
  type CandidateStatus,
  type CsvImportResult,
  type EducationLevel,
  type EducationStatus,
  type SkillLevel,
} from '../../types/domain';
import { formatCep, formatCpf, formatDate, formatPhone, toDateInputValue } from '../../utils/formatters';
import { translateStageName } from '../../utils/stageTranslation';

const GENDERS: CandidateGender[] = ['Masculino', 'Feminino', 'Outro', 'Prefiro não responder'];
const STATUSES: CandidateStatus[] = ['Ativo', 'Inativo', 'Bloqueado'];
const EDU_LEVELS: EducationLevel[] = ['Técnico', 'Graduação', 'Pós-Graduação', 'Mestrado', 'Doutorado'];
const EDU_STATUSES: EducationStatus[] = ['Cursando', 'Concluído'];
const SKILL_LEVELS: SkillLevel[] = ['Iniciante', 'Intermediário', 'Avançado', 'Especialista'];

type DraftExp = Omit<CandidateExperience, 'id' | 'candidateId'> & { id?: number };
type DraftEdu = Omit<CandidateEducation, 'id' | 'candidateId'> & { id?: number };
type DraftSkill = Omit<CandidateSkill, 'id' | 'candidateId'> & { id?: number };

interface CandidateFormState {
  fullName: string;
  email: string;
  phone: string;
  cpf: string;
  dateBirth: string;
  gender: string;
  street: string;
  number: string;
  complement: string;
  city: string;
  state: string;
  postalCode: string;
  linkedin: string;
  github: string;
  portfolio: string;
  notes: string;
  status: CandidateStatus;
}

const INITIAL_CAND_FORM: CandidateFormState = {
  fullName: '',
  email: '',
  phone: '',
  cpf: '',
  dateBirth: '',
  gender: '',
  street: '',
  number: '',
  complement: '',
  city: '',
  state: '',
  postalCode: '',
  linkedin: '',
  github: '',
  portfolio: '',
  notes: '',
  status: 'Ativo',
};

export function CandidatesPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { can } = usePermissions();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateDetail | null>(null);
  const [form, setForm] = useState<CandidateFormState>(INITIAL_CAND_FORM);
  const [experiences, setExperiences] = useState<DraftExp[]>([]);
  const [education, setEducation] = useState<DraftEdu[]>([]);
  const [skills, setSkills] = useState<DraftSkill[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [expDraft, setExpDraft] = useState<DraftExp>({
    company: '',
    position: '',
    startDate: '',
    endDate: '',
    description: '',
    skills: '',
  });
  const [eduDraft, setEduDraft] = useState<DraftEdu>({
    institution: '',
    course: '',
    level: 'Graduação',
    yearConclusion: new Date().getFullYear(),
    status: 'Concluído',
  });
  const [skillDraft, setSkillDraft] = useState<DraftSkill>({
    skill: '',
    level: 'Intermediário',
  });

  const [profileDetail, setProfileDetail] = useState<CandidateDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);

  const [processTarget, setProcessTarget] = useState<Candidate | null>(null);
  const [jobOptions, setJobOptions] = useState<SelectOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [processFeedback, setProcessFeedback] = useState('');
  const [startingProcess, setStartingProcess] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCandidates({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        skill: skillFilter.trim() || undefined,
      });
      setCandidates(res.items);
      setPagination(toPaginationState(res));
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, skillFilter, showToast]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const openCreate = () => {
    setEditingCandidate(null);
    setForm(INITIAL_CAND_FORM);
    setExperiences([]);
    setEducation([]);
    setSkills([]);
    setFormOpen(true);
  };

  const openEdit = async (candidate: Candidate) => {
    try {
      const detail = await getCandidateById(candidate.id);
      setEditingCandidate(detail);
      setForm({
        fullName: detail.fullName,
        email: detail.email,
        phone: formatPhone(detail.phone),
        cpf: formatCpf(detail.cpf),
        dateBirth: toDateInputValue(detail.dateBirth),
        gender: detail.gender || '',
        street: detail.street || '',
        number: detail.number || '',
        complement: detail.complement || '',
        city: detail.city || '',
        state: detail.state || '',
        postalCode: formatCep(detail.postalCode),
        linkedin: detail.linkedin || '',
        github: detail.github || '',
        portfolio: detail.portfolio || '',
        notes: detail.notes || '',
        status: detail.status,
      });
      setExperiences(detail.experiences || []);
      setEducation(detail.education || []);
      setSkills(detail.skills || []);
      setFormOpen(true);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    }
  };

  const openProfile = async (id: number) => {
    setProfileLoading(true);
    setProfileDetail(null);
    try {
      const detail = await getCandidateById(id);
      setProfileDetail(detail);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setProfileLoading(false);
    }
  };

  const openAddToProcess = async (candidate: Candidate) => {
    setProcessTarget(candidate);
    setProcessFeedback('');
    try {
      const jobsRes = await listJobOpenings({ limit: 50 });
      const openJobs = jobsRes.items.filter((j) => j.status === 'Aberta' || j.status === 'Em Progresso');
      setJobOptions(
        openJobs.map((j) => ({
          value: String(j.id),
          label: `${j.title} — ${j.companyName || `#${j.companyId}`}`,
        })),
      );
      setSelectedJobId(openJobs[0] ? String(openJobs[0].id) : '');
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) {
      showToast({ variant: 'warning', message: t('candidates.validationRequired') });
      return;
    }

    setSubmitting(true);
    try {
      const basePayload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        cpf: form.cpf.trim() || null,
        dateBirth: form.dateBirth || null,
        gender: (form.gender as CandidateGender) || null,
        street: form.street.trim() || null,
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        postalCode: form.postalCode.trim() || null,
        linkedin: form.linkedin.trim() || null,
        github: form.github.trim() || null,
        portfolio: form.portfolio.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      };

      if (editingCandidate) {
        await updateCandidate(editingCandidate.id, basePayload);
        showToast({ variant: 'success', message: t('candidates.updatedSuccess') });
      } else {
        await createCandidate({
          ...basePayload,
          experiences: experiences.map(({ id: _id, ...rest }) => rest),
          education: education.map(({ id: _id, ...rest }) => rest),
          skills: skills.map(({ id: _id, ...rest }) => rest),
        });
        showToast({ variant: 'success', message: t('candidates.createdSuccess') });
      }
      setFormOpen(false);
      await loadCandidates();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExp = async () => {
    if (!expDraft.company.trim() || !expDraft.position.trim() || !expDraft.startDate) return;
    const item = {
      company: expDraft.company.trim(),
      position: expDraft.position.trim(),
      startDate: expDraft.startDate,
      endDate: expDraft.endDate || null,
      description: expDraft.description || null,
      skills: expDraft.skills || null,
    };

    if (editingCandidate) {
      try {
        const created = await addCandidateExperience(editingCandidate.id, item);
        setExperiences((prev) => [...prev, created]);
      } catch (err) {
        showToast({ variant: 'danger', message: parseApiError(err).message });
        return;
      }
    } else {
      setExperiences((prev) => [...prev, item]);
    }
    setExpDraft({ company: '', position: '', startDate: '', endDate: '', description: '', skills: '' });
  };

  const handleRemoveExp = async (index: number, item: DraftExp) => {
    if (editingCandidate && item.id) {
      try {
        await deleteCandidateExperience(editingCandidate.id, item.id);
      } catch (err) {
        showToast({ variant: 'danger', message: parseApiError(err).message });
        return;
      }
    }
    setExperiences((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddEdu = async () => {
    if (!eduDraft.institution.trim() || !eduDraft.course.trim()) return;
    const item = {
      institution: eduDraft.institution.trim(),
      course: eduDraft.course.trim(),
      level: eduDraft.level || 'Graduação',
      yearConclusion: eduDraft.yearConclusion ? Number(eduDraft.yearConclusion) : null,
      status: eduDraft.status || 'Concluído',
    };

    if (editingCandidate) {
      try {
        const created = await addCandidateEducation(editingCandidate.id, item);
        setEducation((prev) => [...prev, created]);
      } catch (err) {
        showToast({ variant: 'danger', message: parseApiError(err).message });
        return;
      }
    } else {
      setEducation((prev) => [...prev, item]);
    }
    setEduDraft({
      institution: '',
      course: '',
      level: 'Graduação',
      yearConclusion: new Date().getFullYear(),
      status: 'Concluído',
    });
  };

  const handleRemoveEdu = async (index: number, item: DraftEdu) => {
    if (editingCandidate && item.id) {
      try {
        await deleteCandidateEducation(editingCandidate.id, item.id);
      } catch (err) {
        showToast({ variant: 'danger', message: parseApiError(err).message });
        return;
      }
    }
    setEducation((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddSkill = async () => {
    if (!skillDraft.skill.trim()) return;
    const item: DraftSkill = {
      skill: skillDraft.skill.trim(),
      level: skillDraft.level || 'Intermediário',
    };

    if (editingCandidate) {
      try {
        const created = await addCandidateSkill(editingCandidate.id, item);
        setSkills((prev) => [...prev, created]);
      } catch (err) {
        showToast({ variant: 'danger', message: parseApiError(err).message });
        return;
      }
    } else {
      setSkills((prev) => [...prev, item]);
    }
    setSkillDraft({ skill: '', level: 'Intermediário' });
  };

  const handleRemoveSkill = async (index: number, item: DraftSkill) => {
    if (editingCandidate && item.id) {
      try {
        await deleteCandidateSkill(editingCandidate.id, item.id);
      } catch (err) {
        showToast({ variant: 'danger', message: parseApiError(err).message });
        return;
      }
    }
    setSkills((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCsvFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCsvFile(file);
    if (file) {
      const text = await file.text().catch(() => '');
      if (text) setCsvText(text);
    }
  };

  const handleImportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!csvFile && !csvText.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = csvFile
        ? await importCandidatesFile(csvFile)
        : await importCandidatesCsv(csvText);
      setImportResult(result);
      showToast({
        variant: result.failedCount > 0 ? 'warning' : 'success',
        message: t('candidates.importSummary', {
          imported: result.importedCount,
          failed: result.failedCount,
        }),
      });
      await loadCandidates();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setImporting(false);
    }
  };

  const handleStartProcess = async (e: FormEvent) => {
    e.preventDefault();
    if (!processTarget || !selectedJobId) return;
    setStartingProcess(true);
    try {
      await createProcess({
        candidateId: processTarget.id,
        jobOpeningId: Number(selectedJobId),
        feedback: processFeedback.trim() || null,
      });
      showToast({ variant: 'success', message: t('candidates.processStarted') });
      setProcessTarget(null);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setStartingProcess(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCandidate(deleteTarget.id);
      showToast({ variant: 'success', message: t('candidates.deletedSuccess') });
      setDeleteTarget(null);
      await loadCandidates();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setDeleting(false);
    }
  };

  const columns: Array<DataTableColumn<Candidate>> = [
    {
      key: 'fullName',
      label: t('candidates.fullName'),
      sortable: true,
      render: (row) => (
        <div>
          <strong>{row.fullName}</strong>
          <div className="hr-text-muted">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: t('candidates.phone'),
      render: (row) => (row.phone ? formatPhone(row.phone) : '—'),
    },
    {
      key: 'cpf',
      label: 'CPF',
      render: (row) => (row.cpf ? formatCpf(row.cpf) : '—'),
    },
    {
      key: 'city',
      label: t('candidates.cityState'),
      render: (row) => (row.city ? `${row.city}${row.state ? ` / ${row.state}` : ''}` : '—'),
    },
    {
      key: 'skillCount',
      label: t('candidates.tabSkills'),
      align: 'center',
      render: (row) => row.skillCount ?? 0,
    },
    {
      key: 'status',
      label: t('candidates.status'),
      render: (row) => (
        <StatusBadge
          status={row.status === 'Ativo' ? 'success' : row.status === 'Bloqueado' ? 'danger' : 'neutral'}
          label={row.status}
        />
      ),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      align: 'right',
      render: (row) => (
        <div className="hr-row-actions">
          <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => void openProfile(row.id)}>
            {t('common.view')}
          </Button>
          {can('processes', 'create') ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<UserPlus size={14} />}
              onClick={() => void openAddToProcess(row)}
            >
              {t('processes.newProcess')}
            </Button>
          ) : null}
          {can('candidates', 'update') ? (
            <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => void openEdit(row)}>
              {t('common.edit')}
            </Button>
          ) : null}
          {can('candidates', 'delete') ? (
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setDeleteTarget(row)}>
              {t('common.delete')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="hr-page" data-testid="candidates-page">
      <div className="hr-page-heading hr-page-heading--row">
        <div>
          <h1 className="hr-page-heading__title">
            <UserCheck size={24} className="hr-inline-icon" aria-hidden="true" />
            {t('candidates.title')}
          </h1>
          <p className="hr-page-heading__subtitle">{t('pages.candidatesSubtitle')}</p>
        </div>
        <div className="hr-row-actions">
          {can('candidates', 'create') ? (
            <>
              <Button
                variant="neutral"
                icon={<FileSpreadsheet size={16} />}
                onClick={() => {
                  setCsvText('');
                  setCsvFile(null);
                  setImportResult(null);
                  setImportOpen(true);
                }}
                data-testid="import-csv-btn"
              >
                {t('candidates.importCsv')}
              </Button>
              <Button icon={<Plus size={16} />} onClick={openCreate} data-testid="new-candidate-btn">
                {t('candidates.newCandidate')}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder={t('candidates.searchPlaceholder')}
        hasActiveFilters={Boolean(statusFilter || skillFilter)}
        onClearFilters={() => {
          setSearch('');
          setStatusFilter('');
          setSkillFilter('');
          setPage(1);
        }}
      >
        <Select
          label={t('candidates.status')}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Input
          label={t('candidates.tabSkills')}
          value={skillFilter}
          onChange={(e) => {
            setSkillFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('candidates.skillFilterPlaceholder')}
        />
      </FilterBar>

      <DataTable
        caption={t('candidates.title')}
        columns={columns}
        data={candidates}
        rowKey={(row) => row.id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCandidate ? t('candidates.editCandidate') : t('candidates.newCandidate')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="candidate-form"
              disabled={submitting}
              data-testid="candidate-save-btn"
            >
              {submitting ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <form id="candidate-form" onSubmit={(e) => void handleSave(e)}>
          <Tabs
            label={t('candidates.title')}
            testIdPrefix="cand-form-tab"
            items={[
              {
                id: 'personal',
                label: t('candidates.tabPersonal'),
                content: (
                  <div className="hr-form-grid">
                    <Input
                      label={t('candidates.fullName')}
                      required
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    />
                    <Input
                      label={t('candidates.email')}
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                    <Input
                      label={t('candidates.phone')}
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
                    />
                    <Input
                      label={t('candidates.cpf')}
                      hint={t('candidates.cpfOptionalHint')}
                      value={form.cpf}
                      onChange={(e) => setForm((f) => ({ ...f, cpf: formatCpf(e.target.value) }))}
                      placeholder="000.000.000-00"
                    />
                    <Input
                      label={t('candidates.dateBirth')}
                      type="date"
                      value={form.dateBirth}
                      onChange={(e) => setForm((f) => ({ ...f, dateBirth: e.target.value }))}
                    />
                    <Select
                      label={t('candidates.gender')}
                      value={form.gender}
                      onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                      options={GENDERS.map((g) => ({ value: g, label: g }))}
                    />
                    <Select
                      label={t('candidates.status')}
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CandidateStatus }))}
                      options={STATUSES.map((s) => ({ value: s, label: s }))}
                    />
                    <Input
                      label={t('companies.city')}
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                    <Input
                      label={t('companies.state')}
                      maxLength={2}
                      value={form.state}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                    />
                    <Input
                      label={t('candidates.linkedin')}
                      value={form.linkedin}
                      onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                    />
                    <Input
                      label={t('candidates.github')}
                      value={form.github}
                      onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))}
                    />
                    <Input
                      label={t('candidates.portfolio')}
                      value={form.portfolio}
                      onChange={(e) => setForm((f) => ({ ...f, portfolio: e.target.value }))}
                    />
                    <div className="hr-form-full">
                      <label className="hr-field__label" htmlFor="cand-notes">
                        {t('candidates.notes')}
                      </label>
                      <textarea
                        id="cand-notes"
                        className="hr-textarea"
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                ),
              },
              {
                id: 'experience',
                label: t('candidates.tabExperience'),
                badge: experiences.length,
                content: (
                  <div className="hr-detail-stack">
                    <div className="hr-form-grid">
                      <Input
                        label={t('candidates.expCompany')}
                        value={expDraft.company}
                        onChange={(e) => setExpDraft((d) => ({ ...d, company: e.target.value }))}
                      />
                      <Input
                        label={t('candidates.expPosition')}
                        value={expDraft.position}
                        onChange={(e) => setExpDraft((d) => ({ ...d, position: e.target.value }))}
                      />
                      <Input
                        label={t('candidates.expStartDate')}
                        type="date"
                        value={expDraft.startDate}
                        onChange={(e) => setExpDraft((d) => ({ ...d, startDate: e.target.value }))}
                      />
                      <Input
                        label={t('candidates.expEndDate')}
                        type="date"
                        value={expDraft.endDate || ''}
                        onChange={(e) => setExpDraft((d) => ({ ...d, endDate: e.target.value }))}
                      />
                      <div className="hr-form-full">
                        <Button variant="neutral" size="sm" onClick={() => void handleAddExp()}>
                          {t('candidates.addExperience')}
                        </Button>
                      </div>
                    </div>
                    <ul className="hr-simple-list">
                      {experiences.map((exp, idx) => (
                        <li key={exp.id ?? idx} className="hr-simple-list__row">
                          <span>
                            <strong>{exp.position}</strong> @ {exp.company} ({toDateInputValue(exp.startDate)})
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleRemoveExp(idx, exp)}
                          >
                            {t('common.delete')}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              },
              {
                id: 'education',
                label: t('candidates.tabEducation'),
                badge: education.length,
                content: (
                  <div className="hr-detail-stack">
                    <div className="hr-form-grid">
                      <Input
                        label={t('candidates.eduInstitution')}
                        value={eduDraft.institution}
                        onChange={(e) => setEduDraft((d) => ({ ...d, institution: e.target.value }))}
                      />
                      <Input
                        label={t('candidates.eduCourse')}
                        value={eduDraft.course}
                        onChange={(e) => setEduDraft((d) => ({ ...d, course: e.target.value }))}
                      />
                      <Select
                        label={t('candidates.eduLevel')}
                        value={eduDraft.level || 'Graduação'}
                        onChange={(e) =>
                          setEduDraft((d) => ({ ...d, level: e.target.value as EducationLevel }))
                        }
                        options={EDU_LEVELS.map((l) => ({ value: l, label: l }))}
                      />
                      <Select
                        label={t('candidates.eduStatus')}
                        value={eduDraft.status || 'Concluído'}
                        onChange={(e) =>
                          setEduDraft((d) => ({ ...d, status: e.target.value as EducationStatus }))
                        }
                        options={EDU_STATUSES.map((s) => ({ value: s, label: s }))}
                      />
                      <div className="hr-form-full">
                        <Button variant="neutral" size="sm" onClick={() => void handleAddEdu()}>
                          {t('candidates.addEducation')}
                        </Button>
                      </div>
                    </div>
                    <ul className="hr-simple-list">
                      {education.map((edu, idx) => (
                        <li key={edu.id ?? idx} className="hr-simple-list__row">
                          <span>
                            <strong>{edu.course}</strong> — {edu.institution} ({edu.level || '—'})
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleRemoveEdu(idx, edu)}
                          >
                            {t('common.delete')}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              },
              {
                id: 'skills',
                label: t('candidates.tabSkills'),
                badge: skills.length,
                content: (
                  <div className="hr-detail-stack">
                    <div className="hr-form-grid">
                      <Input
                        label={t('candidates.skillName')}
                        value={skillDraft.skill}
                        onChange={(e) => setSkillDraft((d) => ({ ...d, skill: e.target.value }))}
                      />
                      <Select
                        label={t('candidates.skillLevel')}
                        value={skillDraft.level}
                        onChange={(e) =>
                          setSkillDraft((d) => ({ ...d, level: e.target.value as SkillLevel }))
                        }
                        options={SKILL_LEVELS.map((l) => ({ value: l, label: l }))}
                      />
                      <div className="hr-form-full">
                        <Button variant="neutral" size="sm" onClick={() => void handleAddSkill()}>
                          {t('candidates.addSkill')}
                        </Button>
                      </div>
                    </div>
                    <div className="hr-chip-wrap">
                      {skills.map((sk, idx) => (
                        <span key={sk.id ?? `${sk.skill}-${idx}`} className="hr-perm-chip">
                          {sk.skill} ({sk.level})
                          <button
                            type="button"
                            className="hr-chip-remove"
                            aria-label={`${t('common.delete')} ${sk.skill}`}
                            onClick={() => void handleRemoveSkill(idx, sk)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </form>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('candidates.importModalTitle')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>
              {t('common.close')}
            </Button>
            <Button
              type="submit"
              form="csv-import-form"
              disabled={importing || (!csvFile && !csvText.trim())}
              data-testid="csv-import-submit"
            >
              {importing ? t('common.loading') : t('candidates.importSubmit')}
            </Button>
          </>
        }
      >
        <form id="csv-import-form" className="hr-detail-stack" onSubmit={(e) => void handleImportSubmit(e)}>
          <p className="hr-field__hint">{t('candidates.importCsvHint')}</p>
          <div>
            <label className="hr-field__label" htmlFor="csv-file-input">
              {t('candidates.importCsvFile')}
            </label>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              className="hr-input"
              onChange={(e) => void handleCsvFileChange(e)}
            />
          </div>
          <div>
            <label className="hr-field__label" htmlFor="csv-paste-area">
              {t('candidates.importCsvPaste')}
            </label>
            <textarea
              id="csv-paste-area"
              className="hr-textarea"
              rows={6}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setCsvFile(null);
              }}
              placeholder="full_name,email,phone,city,state,skills&#10;Ana Silva,ana@exemplo.com,11999990000,São Paulo,SP,React;TypeScript"
            />
          </div>
          {importResult ? (
            <div className="hr-banner hr-banner--info" data-testid="csv-import-result">
              <strong>
                {t('candidates.importSummary', {
                  imported: importResult.importedCount,
                  failed: importResult.failedCount,
                })}
              </strong>
              {importResult.errors.length > 0 ? (
                <ul className="hr-simple-list">
                  {importResult.errors.map((errItem, idx) => (
                    <li key={idx}>
                      Linha {errItem.row} ({errItem.email || '—'}): {errItem.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(profileDetail) || profileLoading}
        onClose={() => setProfileDetail(null)}
        title={profileDetail ? profileDetail.fullName : t('candidates.profileTitle')}
        size="lg"
        footer={
          <>
            {profileDetail && can('processes', 'create') ? (
              <Button
                variant="neutral"
                onClick={() => {
                  const target = profileDetail;
                  setProfileDetail(null);
                  void openAddToProcess(target);
                }}
              >
                {t('candidates.addToProcess')}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setProfileDetail(null)}>
              {t('common.close')}
            </Button>
          </>
        }
      >
        {profileLoading ? (
          <p>{t('common.loading')}</p>
        ) : profileDetail ? (
          <div className="hr-detail-stack">
            <div className="hr-detail-grid">
              <div>
                <strong>{t('candidates.email')}:</strong> {profileDetail.email}
              </div>
              <div>
                <strong>{t('candidates.phone')}:</strong> {formatPhone(profileDetail.phone) || '—'}
              </div>
              <div>
                <strong>CPF:</strong> {profileDetail.cpf ? formatCpf(profileDetail.cpf) : '—'}
              </div>
              <div>
                <strong>{t('candidates.cityState')}:</strong>{' '}
                {profileDetail.city ? `${profileDetail.city} / ${profileDetail.state || ''}` : '—'}
              </div>
            </div>
            <div>
              <h3>{t('candidates.tabSkills')}</h3>
              <div className="hr-chip-wrap">
                {profileDetail.skills.map((s) => (
                  <span key={s.id} className="hr-perm-chip">
                    {s.skill} ({s.level})
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3>{t('candidates.tabExperience')}</h3>
              <ul className="hr-simple-list">
                {profileDetail.experiences.map((exp) => (
                  <li key={exp.id}>
                    <strong>{exp.position}</strong> — {exp.company} ({formatDate(exp.startDate, i18n.language)})
                  </li>
                ))}
              </ul>
            </div>
            {profileDetail.processes && profileDetail.processes.length > 0 ? (
              <div>
                <h3>{t('processes.title')}</h3>
                <ul className="hr-simple-list">
                  {profileDetail.processes.map((proc) => (
                    <li key={proc.id}>
                      <strong>{proc.jobTitle}</strong> —{' '}
                      {translateStageName(proc.currentStageName, i18n.language)} ({proc.status})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(processTarget)}
        onClose={() => setProcessTarget(null)}
        title={t('candidates.addToProcess')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setProcessTarget(null)} disabled={startingProcess}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="add-to-process-form"
              disabled={startingProcess || !selectedJobId}
            >
              {startingProcess ? t('common.saving') : t('common.confirm')}
            </Button>
          </>
        }
      >
        <form id="add-to-process-form" className="hr-detail-stack" onSubmit={(e) => void handleStartProcess(e)}>
          <p>
            <strong>{processTarget?.fullName}</strong>
          </p>
          <Select
            label={t('candidates.selectJobOpening')}
            required
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            options={jobOptions}
          />
          <Input
            label={t('candidates.initialFeedback')}
            value={processFeedback}
            onChange={(e) => setProcessFeedback(e.target.value)}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('candidates.deleteTitle')}
        message={t('candidates.deleteConfirm', { name: deleteTarget?.fullName || '' })}
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
