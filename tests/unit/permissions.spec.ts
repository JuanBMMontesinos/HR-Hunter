import { test, expect } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const analytics = require('../../backend/services/securityAnalyticsService');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const alertService = require('../../backend/services/securityAlertService');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { redactSensitiveValues } = require('../../backend/services/auditService');

test.describe('Backend Unit — Permissions, Security Analytics & Audit Redaction', () => {
  test('computeRiskScore and classifyRiskLevel map incident weights cleanly across 0..100', () => {
    const low = analytics.computeRiskScore({
      unauthorizedAttempts: 1,
      failedLogins: 2,
      activeCriticalAlerts: 0,
      activeHighAlerts: 0,
      activeMediumAlerts: 0,
    });
    expect(low).toBe(5);
    expect(analytics.classifyRiskLevel(low)).toBe('LOW');

    const medium = analytics.computeRiskScore({
      unauthorizedAttempts: 6,
      failedLogins: 6,
      activeCriticalAlerts: 0,
      activeHighAlerts: 1,
      activeMediumAlerts: 1,
    });
    expect(medium).toBe(38);
    expect(analytics.classifyRiskLevel(medium)).toBe('MEDIUM');

    const critical = analytics.computeRiskScore({
      unauthorizedAttempts: 20,
      failedLogins: 30,
      activeCriticalAlerts: 3,
      activeHighAlerts: 2,
      activeMediumAlerts: 2,
    });
    expect(critical).toBe(100);
    expect(analytics.classifyRiskLevel(critical)).toBe('CRITICAL');
  });

  test('buildRecommendations returns targeted actions for HIGH/CRITICAL alerts', () => {
    const healthy = analytics.buildRecommendations({});
    expect(healthy).toHaveLength(1);

    const urgent = analytics.buildRecommendations({
      unauthorizedAttempts: 7,
      failedLogins: 12,
      activeCriticalAlerts: 1,
      activeHighAlerts: 2,
    });
    expect(urgent).toHaveLength(3);
  });

  test('evaluateAlertThresholds detects user >=5 HIGH and IP >=10 CRITICAL thresholds', () => {
    expect(alertService.evaluateAlertThresholds({ userAttemptsLastHour: 4, ipAttemptsLastHour: 9 })).toEqual(
      [],
    );

    const userHigh = alertService.evaluateAlertThresholds({
      userAttemptsLastHour: 5,
      ipAttemptsLastHour: 5,
    });
    expect(userHigh).toHaveLength(1);
    expect(userHigh[0].severity).toBe('HIGH');
    expect(userHigh[0].alertType).toBe('REPEATED_UNAUTHORIZED_USER');

    const both = alertService.evaluateAlertThresholds({
      userAttemptsLastHour: 5,
      ipAttemptsLastHour: 10,
    });
    expect(both).toHaveLength(2);
    expect(both.map((a: { severity: string }) => a.severity)).toEqual(['HIGH', 'CRITICAL']);
  });

  test('redactSensitiveValues masks passwords and tokens recursively in audit payloads', () => {
    const sanitized = redactSensitiveValues({
      email: 'admin@hrhunter.com',
      password: 'plain-secret-value',
      nested: {
        token: 'raw-token-123',
        role: 'Recrutador',
      },
    });

    expect(sanitized.email).toBe('admin@hrhunter.com');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.nested.token).toBe('[REDACTED]');
    expect(sanitized.nested.role).toBe('Recrutador');
  });
});
