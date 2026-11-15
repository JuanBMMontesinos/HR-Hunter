import { test, expect } from '@playwright/test';
import {
  normalizeStageSlug,
  translateStageName,
} from '../../frontend/src/utils/stageTranslation';
import { evaluatePasswordStrength } from '../../frontend/src/utils/passwordPolicy';

test.describe('Unit — stageTranslation & passwordPolicy', () => {
  test('translates all 9 default Supabase recruitment stages to EN-US cleanly', () => {
    const cases: Array<[string, string]> = [
      ['Candidatura Recebida', 'Application Received'],
      ['Triagem CV', 'Resume Screening'],
      ['Entrevista Telefônica', 'Phone Interview'],
      ['Entrevista Técnica', 'Technical Interview'],
      ['Dinâmica de Grupo', 'Group Dynamics'],
      ['Entrevista com Gestor', 'Hiring Manager Interview'],
      ['Oferta', 'Job Offer'],
      ['Contratado', 'Hired'],
      ['Rejeitado', 'Rejected'],
    ];

    for (const [ptName, enName] of cases) {
      expect(translateStageName(ptName, 'en-US')).toBe(enName);
      expect(translateStageName(ptName, 'pt-BR')).toBe(ptName);
    }
  });

  test('normalizes accents/whitespace and preserves unknown custom stage labels verbatim', () => {
    expect(normalizeStageSlug('  Entrevista Técnica  ')).toBe('entrevista_tecnica');
    expect(translateStageName('  entrevista telefonica ', 'en')).toBe('Phone Interview');
    expect(translateStageName('Desafio Técnico Executivo', 'en-US')).toBe(
      'Desafio Técnico Executivo',
    );
    expect(translateStageName('   ', 'en-US')).toBe('');
  });

  test('evaluates password complexity rules matching backend policy', () => {
    const weak = evaluatePasswordStrength('abc');
    expect(weak.valid).toBe(false);
    expect(weak.score).toBe(1);
    expect(weak.rules.lowercase).toBe(true);
    expect(weak.rules.minLength).toBe(false);

    const missingSpecial = evaluatePasswordStrength('Hunter2026');
    expect(missingSpecial.valid).toBe(false);
    expect(missingSpecial.score).toBe(4);
    expect(missingSpecial.rules.special).toBe(false);

    const customLengthUnmet = evaluatePasswordStrength('Hr@2026!', 12);
    expect(customLengthUnmet.valid).toBe(false);
    expect(customLengthUnmet.minLength).toBe(12);
    expect(customLengthUnmet.rules.minLength).toBe(false);

    const strong = evaluatePasswordStrength('HrHunter@2026!');
    expect(strong.valid).toBe(true);
    expect(strong.score).toBe(5);
  });
});
