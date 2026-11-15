import { Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { ConfirmModal } from '../common/ConfirmModal';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { RichTextEditor } from '../common/RichTextEditor';
import { Select } from '../common/Select';
import { StatusBadge } from '../common/StatusBadge';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import {
  createEmailTemplate,
  deleteEmailTemplate,
  getSystemSettings,
  listEmailTemplates,
  sendTestEmail,
  updateEmailTemplate,
  updateSystemSettings,
} from '../../services/settingsService';
import type { EmailTemplate, SystemConfigItem } from '../../types/domain';

export function EmailTemplatesTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [smtpItems, setSmtpItems] = useState<SystemConfigItem[]>([]);
  const [smtpValues, setSmtpValues] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [testTo, setTestTo] = useState('');
  const [testTemplateKey, setTestTemplateKey] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<EmailTemplate | null>(null);
  const [tplKey, setTplKey] = useState('');
  const [tplName, setTplName] = useState('');
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [tplLang, setTplLang] = useState<'pt-BR' | 'en-US'>('pt-BR');
  const [savingTpl, setSavingTpl] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, tplList] = await Promise.all([getSystemSettings(), listEmailTemplates()]);
      const emailConfigs = settings.items.filter(
        (i) => i.category === 'Email' || i.configKey.toLowerCase().includes('smtp'),
      );
      setSmtpItems(emailConfigs);
      const map: Record<string, string> = {};
      for (const item of emailConfigs) {
        map[item.configKey] = item.isSensitive ? '********' : item.configValue ?? '';
      }
      setSmtpValues(map);
      setTemplates(tplList);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSaveSmtp = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = smtpItems
        .filter((i) => !(i.isSensitive && smtpValues[i.configKey] === '********'))
        .map((i) => ({
          configKey: i.configKey,
          configValue: smtpValues[i.configKey] ?? '',
          dataType: i.dataType,
          category: i.category,
          isSensitive: Boolean(i.isSensitive),
        }));
      await updateSystemSettings(payload);
      showToast({ variant: 'success', message: t('settings.general.savedSuccess') });
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    }
  };

  const handleTestEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!testTo.trim()) return;
    setSendingTest(true);
    try {
      const res = await sendTestEmail({
        to: testTo.trim(),
        templateKey: testTemplateKey || undefined,
      });
      showToast({
        variant: 'success',
        message: t('settings.email.testSuccess', {
          status: res.simulated ? 'simulado' : 'enviado',
        }),
      });
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSendingTest(false);
    }
  };

  const openCreateTpl = () => {
    setEditingTpl(null);
    setTplKey('');
    setTplName('');
    setTplSubject('');
    setTplBody('<p>Olá {{candidate_name}},</p>');
    setTplLang('pt-BR');
    setTplModalOpen(true);
  };

  const openEditTpl = (tpl: EmailTemplate) => {
    setEditingTpl(tpl);
    setTplKey(tpl.templateKey);
    setTplName(tpl.name);
    setTplSubject(tpl.subject);
    setTplBody(tpl.bodyHtml);
    setTplLang(tpl.language || 'pt-BR');
    setTplModalOpen(true);
  };

  const handleSaveTpl = async (e: FormEvent) => {
    e.preventDefault();
    setSavingTpl(true);
    try {
      if (editingTpl) {
        await updateEmailTemplate(editingTpl.id, {
          name: tplName.trim(),
          subject: tplSubject.trim(),
          bodyHtml: tplBody,
          language: tplLang,
          isActive: true,
        });
      } else {
        await createEmailTemplate({
          templateKey: tplKey.trim(),
          name: tplName.trim(),
          subject: tplSubject.trim(),
          bodyHtml: tplBody,
          language: tplLang,
          isActive: true,
        });
      }
      showToast({ variant: 'success', message: t('settings.email.savedTemplate') });
      setTplModalOpen(false);
      await loadAll();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSavingTpl(false);
    }
  };

  if (loading) return <p>{t('common.loading')}</p>;

  return (
    <div className="hr-detail-stack">
      <section className="hr-card hr-section-card hr-detail-stack">
        <h2 className="hr-chart-card__title">
          <Mail size={18} className="hr-inline-icon" aria-hidden="true" />
          {t('settings.email.smtpTitle')}
        </h2>
        <form className="hr-form-grid" onSubmit={(e) => void handleSaveSmtp(e)}>
          {smtpItems.map((item) => (
            <Input
              key={item.configKey}
              label={item.description || item.configKey}
              type={item.isSensitive ? 'password' : 'text'}
              value={smtpValues[item.configKey] ?? ''}
              onChange={(e) =>
                setSmtpValues((prev) => ({ ...prev, [item.configKey]: e.target.value }))
              }
            />
          ))}
          <div className="hr-form-full">
            <Button type="submit" size="sm">
              {t('settings.general.saveConfigs')}
            </Button>
          </div>
        </form>

        <form className="hr-form-grid" onSubmit={(e) => void handleTestEmail(e)}>
          <Input
            label={t('settings.email.testEmailTo')}
            type="email"
            required
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="teste@empresa.com"
          />
          <Select
            label={t('settings.email.testTemplateOptional')}
            value={testTemplateKey}
            onChange={(e) => setTestTemplateKey(e.target.value)}
            placeholder={t('common.optional')}
            options={templates.map((tpl) => ({ value: tpl.templateKey, label: tpl.name }))}
          />
          <div className="hr-form-full">
            <Button type="submit" size="sm" variant="neutral" icon={<Send size={14} />} disabled={sendingTest}>
              {t('settings.email.sendTest')}
            </Button>
          </div>
        </form>
      </section>

      <section className="hr-card hr-section-card hr-detail-stack">
        <header className="hr-chart-card__head">
          <h2 className="hr-chart-card__title">{t('settings.email.templatesTitle')}</h2>
          <Button size="sm" icon={<Plus size={14} />} onClick={openCreateTpl}>
            {t('settings.email.newTemplate')}
          </Button>
        </header>

        <ul className="hr-simple-list">
          {templates.map((tpl) => (
            <li key={tpl.id} className="hr-simple-list__row">
              <div>
                <strong>{tpl.name}</strong> (<code>{tpl.templateKey}</code>){' '}
                {tpl.isSystem ? <StatusBadge status="neutral" label={t('settings.email.systemProtected')} /> : null}
                <div className="hr-text-muted">{tpl.subject}</div>
              </div>
              <div className="hr-row-actions">
                <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => openEditTpl(tpl)}>
                  {t('common.edit')}
                </Button>
                {!tpl.isSystem ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={13} />}
                    onClick={() => setDeleteTarget(tpl)}
                  >
                    {t('common.delete')}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Modal
        open={tplModalOpen}
        onClose={() => setTplModalOpen(false)}
        title={editingTpl ? t('common.edit') : t('settings.email.newTemplate')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTplModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="email-tpl-form" disabled={savingTpl}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="email-tpl-form" className="hr-detail-stack" onSubmit={(e) => void handleSaveTpl(e)}>
          <div className="hr-form-grid">
            <Input
              label={t('settings.email.templateKey')}
              required
              disabled={Boolean(editingTpl)}
              value={tplKey}
              onChange={(e) => setTplKey(e.target.value)}
            />
            <Input
              label={t('settings.email.templateName')}
              required
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
            />
            <Input
              label={t('settings.email.subject')}
              required
              value={tplSubject}
              onChange={(e) => setTplSubject(e.target.value)}
            />
            <Select
              label={t('common.language')}
              value={tplLang}
              onChange={(e) => setTplLang(e.target.value as 'pt-BR' | 'en-US')}
              options={[
                { value: 'pt-BR', label: 'pt-BR' },
                { value: 'en-US', label: 'en-US' },
              ]}
            />
          </div>
          <RichTextEditor label={t('settings.email.bodyHtml')} value={tplBody} onChange={setTplBody} />
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('common.delete')}
        message={`${t('common.delete')} "${deleteTarget?.name || ''}"?`}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteEmailTemplate(deleteTarget.id);
            showToast({ variant: 'success', message: t('settings.email.deletedTemplate') });
            setDeleteTarget(null);
            await loadAll();
          } catch (err) {
            showToast({ variant: 'danger', message: parseApiError(err).message });
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
