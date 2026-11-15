import { History, KeyRound, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PasswordStrengthMeter } from '../../components/auth/PasswordStrengthMeter';
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
  adminResetPassword,
  createUser,
  deleteUser,
  getUserActivity,
  listUsers,
  updateUser,
} from '../../services/userService';
import type { UserRole } from '../../types/auth';
import type { PaginationState } from '../../types/common';
import { toPaginationState, type UserAccount, type UserActivityData } from '../../types/domain';
import { formatDateTime, formatPhone } from '../../utils/formatters';

const ROLES: UserRole[] = ['Admin', 'Gerente', 'Recrutador', 'Consultor', 'GestorRH'];

interface UserFormState {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  department: string;
  preferredLanguage: 'pt-BR' | 'en-US';
  isActive: boolean;
  password: string;
  isPasswordResetRequired: boolean;
}

const INITIAL_USER_FORM: UserFormState = {
  fullName: '',
  email: '',
  phone: '',
  role: 'Recrutador',
  department: '',
  preferredLanguage: 'pt-BR',
  isActive: true,
  password: '',
  isPasswordResetRequired: false,
};

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { can } = usePermissions();

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [form, setForm] = useState<UserFormState>(INITIAL_USER_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);
  const [resetCustomPassword, setResetCustomPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [activityData, setActivityData] = useState<UserActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers({
        page,
        limit: 20,
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        department: departmentFilter.trim() || undefined,
      });
      setUsers(res.items);
      setPagination(toPaginationState(res));
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter, departmentFilter, showToast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(INITIAL_USER_FORM);
    setFormOpen(true);
  };

  const openEdit = (u: UserAccount) => {
    setEditingUser(u);
    setForm({
      fullName: u.fullName,
      email: u.email,
      phone: formatPhone(u.phone),
      role: u.role,
      department: u.department || '',
      preferredLanguage: (u.preferredLanguage as 'pt-BR' | 'en-US') || 'pt-BR',
      isActive: u.isActive,
      password: '',
      isPasswordResetRequired: Boolean(u.isPasswordResetRequired),
    });
    setFormOpen(true);
  };

  const openActivity = async (u: UserAccount) => {
    setActivityLoading(true);
    setActivityData(null);
    try {
      const data = await getUserActivity(u.id);
      setActivityData(data);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setActivityLoading(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          department: form.department.trim() || null,
          preferredLanguage: form.preferredLanguage,
          isActive: form.isActive,
          isPasswordResetRequired: form.isPasswordResetRequired,
        });
        showToast({ variant: 'success', message: t('users.updatedSuccess') });
      } else {
        await createUser({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || null,
          role: form.role,
          department: form.department.trim() || null,
          preferredLanguage: form.preferredLanguage,
          isActive: form.isActive,
          isPasswordResetRequired: form.isPasswordResetRequired,
        });
        showToast({ variant: 'success', message: t('users.createdSuccess') });
      }
      setFormOpen(false);
      await loadUsers();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    setGeneratedPassword(null);
    try {
      const res = await adminResetPassword(resetTarget.id, {
        newPassword: resetCustomPassword.trim() || undefined,
        requireResetOnLogin: true,
      });
      setGeneratedPassword(res.temporaryPassword || null);
      showToast({ variant: 'success', message: res.message });
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      showToast({ variant: 'success', message: t('users.deletedSuccess') });
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setDeleting(false);
    }
  };

  const columns: Array<DataTableColumn<UserAccount>> = [
    {
      key: 'fullName',
      label: t('users.fullName'),
      sortable: true,
      render: (row) => (
        <div>
          <strong>{row.fullName}</strong>
          <div className="hr-text-muted">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      label: t('users.role'),
      render: (row) => <StatusBadge status="info" label={row.role} />,
    },
    {
      key: 'department',
      label: t('users.department'),
      render: (row) => row.department || '—',
    },
    {
      key: 'lastLogin',
      label: t('users.lastLogin'),
      render: (row) => formatDateTime(row.lastLogin, i18n.language),
    },
    {
      key: 'isActive',
      label: t('users.status'),
      render: (row) => (
        <StatusBadge
          status={row.isActive ? 'success' : 'neutral'}
          label={row.isActive ? t('status.active') : t('status.inactive')}
        />
      ),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      align: 'right',
      render: (row) => (
        <div className="hr-row-actions">
          <Button size="sm" variant="ghost" icon={<History size={14} />} onClick={() => void openActivity(row)}>
            Audit
          </Button>
          {can('users', 'update') ? (
            <>
              <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => openEdit(row)}>
                {t('common.edit')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<KeyRound size={14} />}
                onClick={() => {
                  setResetTarget(row);
                  setResetCustomPassword('');
                  setGeneratedPassword(null);
                }}
              >
                {t('users.resetPasswordAction')}
              </Button>
            </>
          ) : null}
          {can('users', 'delete') ? (
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setDeleteTarget(row)}>
              {t('common.delete')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="hr-page" data-testid="users-page">
      <div className="hr-page-heading hr-page-heading--row">
        <div>
          <h1 className="hr-page-heading__title">
            <Users size={24} className="hr-inline-icon" aria-hidden="true" />
            {t('users.title')}
          </h1>
          <p className="hr-page-heading__subtitle">{t('pages.usersSubtitle')}</p>
        </div>
        {can('users', 'create') ? (
          <Button icon={<Plus size={16} />} onClick={openCreate} data-testid="new-user-btn">
            {t('users.newUser')}
          </Button>
        ) : null}
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        hasActiveFilters={Boolean(roleFilter || statusFilter || departmentFilter)}
        onClearFilters={() => {
          setSearch('');
          setRoleFilter('');
          setStatusFilter('');
          setDepartmentFilter('');
          setPage(1);
        }}
      >
        <Select
          label={t('users.role')}
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={ROLES.map((r) => ({ value: r, label: r }))}
        />
        <Select
          label={t('users.status')}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={[
            { value: 'Ativo', label: t('status.active') },
            { value: 'Inativo', label: t('status.inactive') },
          ]}
        />
        <Input
          label={t('users.department')}
          value={departmentFilter}
          onChange={(e) => {
            setDepartmentFilter(e.target.value);
            setPage(1);
          }}
        />
      </FilterBar>

      <DataTable
        caption={t('users.title')}
        columns={columns}
        data={users}
        rowKey={(row) => row.id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingUser ? t('users.editUser') : t('users.newUser')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="user-form" disabled={submitting} data-testid="user-save-btn">
              {submitting ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <form id="user-form" className="hr-form-grid" onSubmit={(e) => void handleSave(e)}>
          <Input
            label={t('users.fullName')}
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
          <Input
            label={t('users.email')}
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label={t('users.phone')}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
          />
          <Select
            label={t('users.role')}
            required
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
            options={ROLES.map((r) => ({ value: r, label: r }))}
          />
          <Input
            label={t('users.department')}
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
          />
          <Select
            label={t('profile.preferredLanguage')}
            value={form.preferredLanguage}
            onChange={(e) =>
              setForm((f) => ({ ...f, preferredLanguage: e.target.value as 'pt-BR' | 'en-US' }))
            }
            options={[
              { value: 'pt-BR', label: 'Português (Brasil)' },
              { value: 'en-US', label: 'English (US)' },
            ]}
          />
          {!editingUser ? (
            <div className="hr-form-full hr-detail-stack">
              <Input
                label={t('users.password')}
                type="password"
                allowPasswordToggle
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <PasswordStrengthMeter password={form.password} />
            </div>
          ) : null}
          <label className="hr-checkbox-row hr-form-full">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <span>{t('status.active')}</span>
          </label>
          <label className="hr-checkbox-row hr-form-full">
            <input
              type="checkbox"
              checked={form.isPasswordResetRequired}
              onChange={(e) => setForm((f) => ({ ...f, isPasswordResetRequired: e.target.checked }))}
            />
            <span>{t('users.requireReset')}</span>
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={t('users.resetPasswordTitle')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>
              {t('common.close')}
            </Button>
            <Button type="submit" form="admin-reset-pwd-form" disabled={resetting}>
              {resetting ? t('common.saving') : t('users.resetPasswordAction')}
            </Button>
          </>
        }
      >
        <form id="admin-reset-pwd-form" className="hr-detail-stack" onSubmit={(e) => void handleResetPassword(e)}>
          <p>
            <strong>{resetTarget?.fullName}</strong> ({resetTarget?.email})
          </p>
          <Input
            label={t('auth.newPasswordLabel')}
            hint={t('users.resetPasswordHint')}
            type="password"
            allowPasswordToggle
            value={resetCustomPassword}
            onChange={(e) => setResetCustomPassword(e.target.value)}
          />
          {generatedPassword ? (
            <div className="hr-banner hr-banner--info">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>
                {t('users.generatedTempPassword')} <code>{generatedPassword}</code>
              </span>
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(activityData) || activityLoading}
        onClose={() => setActivityData(null)}
        title={
          activityData
            ? t('users.activityTitle', { name: activityData.user.fullName })
            : t('common.loading')
        }
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setActivityData(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {activityLoading ? (
          <p>{t('common.loading')}</p>
        ) : activityData ? (
          <div className="hr-detail-stack">
            <h3>{t('users.recentLogins')}</h3>
            <ul className="hr-simple-list">
              {activityData.recentLogins.map((l) => (
                <li key={l.id}>
                  {formatDateTime(l.loginTime, i18n.language)} —{' '}
                  {l.isSuccessful ? t('settings.loginHistory.successLabel') : t('settings.loginHistory.failureLabel')}{' '}
                  ({l.ipAddress || '—'})
                </li>
              ))}
            </ul>
            <h3>{t('users.recentAudit')}</h3>
            <ul className="hr-simple-list">
              {activityData.recentAudit.map((a) => (
                <li key={a.id}>
                  {formatDateTime(a.createdAt, i18n.language)} — {a.action} em <code>{a.tableName}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('users.deleteTitle')}
        message={t('users.deleteConfirm', { name: deleteTarget?.fullName || '' })}
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
