import { Database, Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import { generateBackupSnapshot } from '../../services/settingsService';
import type { BackupSnapshotResult } from '../../types/domain';
import { triggerBlobDownload } from '../../utils/formatters';

export function BackupSnapshotTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<BackupSnapshotResult | null>(null);

  const handleGenerate = async (format: 'json' | 'sql') => {
    setGenerating(true);
    try {
      const res = await generateBackupSnapshot(format);
      setLastResult(res);
      const count = Object.keys(res.tableCounts).length;
      showToast({ variant: 'success', message: t('settings.backup.snapshotReady', { count }) });

      if (format === 'sql' && res.sqlContent) {
        triggerBlobDownload(
          new Blob([res.sqlContent], { type: 'application/sql;charset=utf-8' }),
          `hr-hunter-snapshot-${Date.now()}.sql`,
        );
      } else {
        triggerBlobDownload(
          new Blob([JSON.stringify(res, null, 2)], { type: 'application/json;charset=utf-8' }),
          `hr-hunter-snapshot-${Date.now()}.json`,
        );
      }
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="hr-detail-stack">
      <section className="hr-card hr-section-card hr-detail-stack">
        <h2 className="hr-chart-card__title">
          <Database size={18} className="hr-inline-icon" aria-hidden="true" />
          {t('settings.backup.managedTitle')}
        </h2>
        <p>{t('settings.backup.managedDescription')}</p>
      </section>

      <section className="hr-card hr-section-card hr-detail-stack">
        <h2 className="hr-chart-card__title">{t('settings.backup.snapshotTitle')}</h2>
        <div className="hr-row-actions">
          <Button
            icon={<Download size={15} />}
            disabled={generating}
            onClick={() => void handleGenerate('json')}
            data-testid="backup-json-btn"
          >
            {t('settings.backup.generateJson')}
          </Button>
          <Button
            variant="neutral"
            icon={<Download size={15} />}
            disabled={generating}
            onClick={() => void handleGenerate('sql')}
            data-testid="backup-sql-btn"
          >
            {t('settings.backup.generateSql')}
          </Button>
        </div>

        {lastResult ? (
          <div className="hr-mini-stats">
            {Object.entries(lastResult.tableCounts).map(([table, count]) => (
              <div key={table} className="hr-mini-stat">
                <span>{table}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
