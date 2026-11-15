const STAGE_MAP: Record<string, { 'pt-BR': string; 'en-US': string }> = {
  candidatura_recebida: {
    'pt-BR': 'Candidatura Recebida',
    'en-US': 'Application Received',
  },
  triagem_cv: {
    'pt-BR': 'Triagem CV',
    'en-US': 'Resume Screening',
  },
  entrevista_telefonica: {
    'pt-BR': 'Entrevista Telefônica',
    'en-US': 'Phone Interview',
  },
  entrevista_tecnica: {
    'pt-BR': 'Entrevista Técnica',
    'en-US': 'Technical Interview',
  },
  dinamica_de_grupo: {
    'pt-BR': 'Dinâmica de Grupo',
    'en-US': 'Group Dynamics',
  },
  entrevista_com_gestor: {
    'pt-BR': 'Entrevista com Gestor',
    'en-US': 'Hiring Manager Interview',
  },
  oferta: {
    'pt-BR': 'Oferta',
    'en-US': 'Job Offer',
  },
  contratado: {
    'pt-BR': 'Contratado',
    'en-US': 'Hired',
  },
  rejeitado: {
    'pt-BR': 'Rejeitado',
    'en-US': 'Rejected',
  },
};

export function normalizeStageSlug(stageName: string): string {
  return String(stageName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Translates dynamic recruitment stage names stored in Supabase PT-BR into the active UI locale.
 * Unknown custom stage names preserve their original label intact.
 */
export function translateStageName(stageName: string, language = 'pt-BR'): string {
  const raw = String(stageName || '').trim();
  if (!raw) return '';

  const slug = normalizeStageSlug(raw);
  const entry = STAGE_MAP[slug];
  if (!entry) {
    return raw;
  }

  return language.toLowerCase().startsWith('en') ? entry['en-US'] : entry['pt-BR'];
}
