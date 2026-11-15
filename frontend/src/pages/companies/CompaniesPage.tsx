import { Building2, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/common/Button';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { DataTable, type DataTableColumn } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useToast } from '../../contexts/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { parseApiError } from '../../services/api';
import {
  createCompany,
  deleteCompany,
  getCompanyById,
  listCompanies,
  updateCompany,
} from '../../services/companyService';
import type { PaginationState } from '../../types/common';
import {
  toPaginationState,
  type Company,
  type CompanyDetail,
  type CompanyPayload,
  type CompanyStatus,
} from '../../types/domain';
import { formatCep, formatCnpj, formatDate, formatPhone } from '../../utils/formatters';

interface CompanyFormState {
  legalName: string;
  tradeName: string;
  cnpj: string;
  sector: string;
  street: string;
  number: string;
  complement: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  status: CompanyStatus;
}

const INITIAL_FORM: CompanyFormState = {
  legalName: '',
  tradeName: '',
  cnpj: '',
  sector: '',
  street: '',
  number: '',
  complement: '',
  city: '',
  state: '',
  country: 'Brasil',
  postalCode: '',
  phone: '',
  email: '',
  website: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
  status: 'Ativo',
};

function toFormState(c: Company): CompanyFormState {
  return {
    legalName: c.legalName || '',
    tradeName: c.tradeName || '',
    cnpj: formatCnpj(c.cnpj),
    sector: c.sector || '',
    street: c.street || '',
    number: c.number || '',
    complement: c.complement || '',
    city: c.city || '',
    state: c.state || '',
    country: c.country || 'Brasil',
    postalCode: formatCep(c.postalCode),
    phone: formatPhone(c.phone),
    email: c.email || '',
    website: c.website || '',
    contactName: c.contactName || '',
    contactEmail: c.contactEmail || '',
    contactPhone: formatPhone(c.contactPhone),
    notes: c.notes || '',
    status: c.status || 'Ativo',
  };
}

export function CompaniesPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { can } = usePermissions();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [viewDetail, setViewDetail] = useState<CompanyDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCompanies({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        sector: sectorFilter.trim() || undefined,
      });
      setCompanies(res.items);
      setPagination(toPaginationState(res));
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sectorFilter, showToast]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const openCreate = () => {
    setEditingCompany(null);
    setForm(INITIAL_FORM);
    setFormOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    setForm(toFormState(company));
    setFormOpen(true);
  };

  const openView = async (id: number) => {
    setViewLoading(true);
    setViewDetail(null);
    try {
      const detail = await getCompanyById(id);
      setViewDetail(detail);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setViewLoading(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.legalName.trim() || !form.cnpj.trim()) {
      showToast({ variant: 'warning', message: t('companies.validationRequired') });
      return;
    }

    setSubmitting(true);
    try {
      const payload: CompanyPayload = {
        legalName: form.legalName.trim(),
        tradeName: form.tradeName.trim() || null,
        cnpj: form.cnpj.trim(),
        sector: form.sector.trim() || null,
        street: form.street.trim() || null,
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        country: form.country.trim() || 'Brasil',
        postalCode: form.postalCode.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      };

      if (editingCompany) {
        await updateCompany(editingCompany.id, payload);
        showToast({ variant: 'success', message: t('companies.updatedSuccess') });
      } else {
        await createCompany(payload);
        showToast({ variant: 'success', message: t('companies.createdSuccess') });
      }
      setFormOpen(false);
      await loadCompanies();
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
      await deleteCompany(deleteTarget.id);
      showToast({ variant: 'success', message: t('companies.deletedSuccess') });
      setDeleteTarget(null);
      await loadCompanies();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setDeleting(false);
    }
  };

  const columns: Array<DataTableColumn<Company>> = [
    {
      key: 'legalName',
      label: t('companies.legalName'),
      sortable: true,
      render: (row) => (
        <div>
          <strong>{row.legalName}</strong>
          {row.tradeName ? <div className="hr-text-muted">{row.tradeName}</div> : null}
        </div>
      ),
    },
    {
      key: 'cnpj',
      label: t('companies.cnpj'),
      render: (row) => <span>{formatCnpj(row.cnpj)}</span>,
    },
    {
      key: 'sector',
      label: t('companies.sector'),
      sortable: true,
      render: (row) => row.sector || '—',
    },
    {
      key: 'city',
      label: t('companies.cityState'),
      render: (row) => (row.city ? `${row.city}${row.state ? ` / ${row.state}` : ''}` : '—'),
    },
    {
      key: 'activeJobOpenings',
      label: t('companies.activeJobs'),
      align: 'center',
      sortable: true,
      render: (row) => `${row.activeJobOpenings ?? 0} / ${row.totalJobOpenings ?? 0}`,
    },
    {
      key: 'status',
      label: t('companies.status'),
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={row.status === 'Ativo' ? 'success' : 'neutral'}
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
          <Button
            size="sm"
            variant="ghost"
            icon={<Eye size={14} />}
            aria-label={`${t('common.view')} ${row.legalName}`}
            onClick={() => void openView(row.id)}
          >
            {t('common.view')}
          </Button>
          {can('companies', 'update') ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Pencil size={14} />}
              aria-label={`${t('common.edit')} ${row.legalName}`}
              onClick={() => openEdit(row)}
            >
              {t('common.edit')}
            </Button>
          ) : null}
          {can('companies', 'delete') ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={14} />}
              aria-label={`${t('common.delete')} ${row.legalName}`}
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
    <div className="hr-page" data-testid="companies-page">
      <div className="hr-page-heading hr-page-heading--row">
        <div>
          <h1 className="hr-page-heading__title">
            <Building2 size={24} className="hr-inline-icon" aria-hidden="true" />
            {t('companies.title')}
          </h1>
          <p className="hr-page-heading__subtitle">{t('pages.companiesSubtitle')}</p>
        </div>
        {can('companies', 'create') ? (
          <Button
            icon={<Plus size={16} />}
            onClick={openCreate}
            data-testid="new-company-btn"
          >
            {t('companies.newCompany')}
          </Button>
        ) : null}
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder={t('companies.searchPlaceholder')}
        hasActiveFilters={Boolean(statusFilter || sectorFilter)}
        onClearFilters={() => {
          setSearch('');
          setStatusFilter('');
          setSectorFilter('');
          setPage(1);
        }}
      >
        <Select
          label={t('companies.status')}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={[
            { value: 'Ativo', label: 'Ativo' },
            { value: 'Inativo', label: 'Inativo' },
          ]}
        />
        <Input
          label={t('companies.sector')}
          value={sectorFilter}
          onChange={(e) => {
            setSectorFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('companies.sector')}
        />
      </FilterBar>

      <DataTable
        caption={t('companies.title')}
        columns={columns}
        data={companies}
        rowKey={(row) => row.id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCompany ? t('companies.editCompany') : t('companies.newCompany')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="company-form"
              disabled={submitting}
              data-testid="company-save-btn"
            >
              {submitting ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <form id="company-form" className="hr-form-grid" onSubmit={(e) => void handleSave(e)}>
          <Input
            label={t('companies.legalName')}
            required
            value={form.legalName}
            onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
          />
          <Input
            label={t('companies.tradeName')}
            value={form.tradeName}
            onChange={(e) => setForm((f) => ({ ...f, tradeName: e.target.value }))}
          />
          <Input
            label={t('companies.cnpj')}
            required
            value={form.cnpj}
            onChange={(e) => setForm((f) => ({ ...f, cnpj: formatCnpj(e.target.value) }))}
            placeholder="00.000.000/0000-00"
          />
          <Input
            label={t('companies.sector')}
            value={form.sector}
            onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
          />
          <Select
            label={t('companies.status')}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CompanyStatus }))}
            options={[
              { value: 'Ativo', label: 'Ativo' },
              { value: 'Inativo', label: 'Inativo' },
            ]}
          />
          <Input
            label={t('companies.website')}
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            placeholder="https://"
          />

          <h3 className="hr-form-section-title">{t('companies.addressSection')}</h3>
          <Input
            label={t('companies.postalCode')}
            value={form.postalCode}
            onChange={(e) => setForm((f) => ({ ...f, postalCode: formatCep(e.target.value) }))}
            placeholder="00000-000"
          />
          <Input
            label={t('companies.street')}
            value={form.street}
            onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
          />
          <Input
            label={t('companies.number')}
            value={form.number}
            onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
          />
          <Input
            label={t('companies.complement')}
            value={form.complement}
            onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))}
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
            label={t('companies.country')}
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          />

          <h3 className="hr-form-section-title">{t('companies.contactSection')}</h3>
          <Input
            label={t('companies.phone')}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
          />
          <Input
            label={t('companies.email')}
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label={t('companies.contactName')}
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
          />
          <Input
            label={t('companies.contactEmail')}
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
          />
          <Input
            label={t('companies.contactPhone')}
            value={form.contactPhone}
            onChange={(e) => setForm((f) => ({ ...f, contactPhone: formatPhone(e.target.value) }))}
          />

          <div className="hr-form-full">
            <label className="hr-field__label" htmlFor="company-notes">
              {t('companies.notes')}
            </label>
            <textarea
              id="company-notes"
              className="hr-textarea"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewDetail) || viewLoading}
        onClose={() => setViewDetail(null)}
        title={viewDetail ? viewDetail.legalName : t('companies.viewCompany')}
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setViewDetail(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {viewLoading ? (
          <p>{t('common.loading')}</p>
        ) : viewDetail ? (
          <div className="hr-detail-stack">
            <div className="hr-mini-stats">
              <div className="hr-mini-stat">
                <span>{t('companies.statsTotalJobs')}</span>
                <strong>{viewDetail.stats.totalJobOpenings}</strong>
              </div>
              <div className="hr-mini-stat">
                <span>{t('companies.statsActiveJobs')}</span>
                <strong>{viewDetail.stats.activeJobOpenings}</strong>
              </div>
              <div className="hr-mini-stat">
                <span>{t('companies.statsFilledJobs')}</span>
                <strong>{viewDetail.stats.filledJobOpenings}</strong>
              </div>
              <div className="hr-mini-stat">
                <span>{t('companies.statsCandidatesInProcess')}</span>
                <strong>{viewDetail.stats.candidatesInProcess}</strong>
              </div>
            </div>

            <div className="hr-detail-grid">
              <div>
                <strong>{t('companies.cnpj')}:</strong> {formatCnpj(viewDetail.cnpj)}
              </div>
              <div>
                <strong>{t('companies.sector')}:</strong> {viewDetail.sector || '—'}
              </div>
              <div>
                <strong>{t('companies.contactName')}:</strong> {viewDetail.contactName || '—'}
              </div>
              <div>
                <strong>{t('companies.contactEmail')}:</strong> {viewDetail.contactEmail || '—'}
              </div>
              <div>
                <strong>{t('companies.cityState')}:</strong>{' '}
                {viewDetail.city ? `${viewDetail.city} / ${viewDetail.state || ''}` : '—'}
              </div>
              <div>
                <strong>{t('companies.status')}:</strong> {viewDetail.status}
              </div>
            </div>

            <div>
              <h3>{t('companies.recentJobsTitle')}</h3>
              {viewDetail.recentJobOpenings.length === 0 ? (
                <p className="hr-text-muted">{t('table.noResults')}</p>
              ) : (
                <ul className="hr-simple-list">
                  {viewDetail.recentJobOpenings.map((job) => (
                    <li key={job.id}>
                      <strong>{job.title}</strong> — {job.status} ({job.totalCandidates}{' '}
                      {t('jobOpenings.candidates').toLowerCase()}, {formatDate(job.openedAt, i18n.language)})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('companies.deleteTitle')}
        message={t('companies.deleteConfirm', { name: deleteTarget?.legalName || '' })}
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
