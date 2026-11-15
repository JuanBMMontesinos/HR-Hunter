import { Lock, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import {
  getPermissionsMatrix,
  listPermissionAuditLog,
  updateRolePermissions,
} from '../../services/securityAdminService';
import type { UserRole } from '../../types/auth';
import type { AuditLogEntry, PermissionsMatrixData } from '../../types/domain';
import { formatDateTime } from '../../utils/formatters';

export function PermissionsManagerTab() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [data, setData] = useState<PermissionsMatrixData | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Recrutador');
  const selectedRoleRef = useRef<UserRole>('Recrutador');
  selectedRoleRef.current = selectedRole;
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [matrixData, auditRes] = await Promise.all([
        getPermissionsMatrix(),
        listPermissionAuditLog({ limit: 10 }),
      ]);
      setData(matrixData);
      const roleInfo = matrixData.matrix[selectedRoleRef.current];
      if (roleInfo) {
        setSelectedIds(roleInfo.permissionIds);
      }
      setAuditLogs(auditRes.items);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    if (data?.matrix[role]) {
      setSelectedIds(data.matrix[role].permissionIds);
    }
  };

  const togglePermission = (permId: number) => {
    if (!data?.matrix[selectedRole]?.editable) return;
    setSelectedIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId],
    );
  };

  const handleSave = async () => {
    if (!data?.matrix[selectedRole]?.editable) return;
    setSaving(true);
    try {
      const updated = await updateRolePermissions(selectedRole, selectedIds);
      const nextIds = Array.isArray(updated.permissionIds) ? updated.permissionIds : selectedIds;
      setSelectedIds(nextIds);
      setData((prev) =>
        prev
          ? {
              ...prev,
              matrix: {
                ...prev.matrix,
                [selectedRole]: {
                  ...prev.matrix[selectedRole],
                  permissionIds: nextIds,
                },
              },
            }
          : prev,
      );
      showToast({
        variant: 'success',
        message: t('settings.permissions.savedSuccess', { role: selectedRole }),
      });
      const logs = await listPermissionAuditLog({ limit: 10 });
      setAuditLogs(logs.items);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <p>{t('common.loading')}</p>;
  if (!data) return null;

  const isEditable = data.matrix[selectedRole]?.editable ?? false;

  return (
    <div className="hr-detail-stack" data-testid="permissions-manager-tab">
      <section className="hr-card hr-section-card hr-detail-stack">
        <header className="hr-chart-card__head">
          <div className="hr-row-actions" role="group" aria-label={t('settings.permissions.selectRole')}>
            {data.roles.map((role) => (
              <Button
                key={role}
                size="sm"
                variant={selectedRole === role ? 'solid' : 'ghost'}
                onClick={() => handleSelectRole(role)}
                data-testid={`perm-role-${role}`}
              >
                {role}
              </Button>
            ))}
          </div>

          <Button
            size="sm"
            disabled={!isEditable || saving}
            icon={<ShieldCheck size={15} />}
            onClick={() => void handleSave()}
            data-testid="save-permissions-btn"
          >
            {saving ? t('common.saving') : t('settings.permissions.savePermissions')}
          </Button>
        </header>

        {!isEditable ? (
          <div className="hr-banner hr-banner--warning" role="status">
            <Lock size={16} aria-hidden="true" />
            <span>{t('settings.permissions.adminReadOnlyNotice')}</span>
          </div>
        ) : null}

        <div className="hr-table-scroll">
          <table className="hr-mini-table hr-perm-matrix">
            <thead>
              <tr>
                <th>{t('settings.permissions.resource')}</th>
                {data.actions.map((action) => (
                  <th key={action}>{action}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.resources.map((resource) => (
                <tr key={resource}>
                  <td>
                    <strong>{resource}</strong>
                  </td>
                  {data.actions.map((action) => {
                    const perm = data.permissions.find(
                      (p) => p.resource === resource && p.action === action,
                    );
                    if (!perm) {
                      return <td key={action}>—</td>;
                    }
                    const checked = selectedIds.includes(perm.id);
                    return (
                      <td key={action}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!isEditable}
                          aria-label={`${selectedRole} ${resource}:${action}`}
                          data-testid={`perm-check-${resource}-${action}`}
                          onChange={() => togglePermission(perm.id)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="hr-card hr-section-card hr-detail-stack">
        <h3 className="hr-chart-card__title">{t('settings.permissions.auditLogTitle')}</h3>
        <ul className="hr-simple-list">
          {auditLogs.map((entry) => (
            <li key={entry.id}>
              <StatusBadge status="info" label={entry.action} />{' '}
              {formatDateTime(entry.createdAt, i18n.language)} —{' '}
              {entry.userName || entry.userEmail || 'Admin'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
