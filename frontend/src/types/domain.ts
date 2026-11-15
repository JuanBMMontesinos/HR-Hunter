import type { PaginationState } from './common';
import type { PermissionAction, PermissionResource, UserDto, UserRole } from './auth';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function toPaginationState(res: PaginatedResult<unknown>): PaginationState {
  return {
    page: res.page,
    limit: res.limit,
    total: res.total,
    totalPages: res.totalPages,
  };
}

// --- Companies ---

export type CompanyStatus = 'Ativo' | 'Inativo';

export interface Company {
  id: number;
  legalName: string;
  tradeName?: string | null;
  cnpj: string;
  sector?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  status: CompanyStatus;
  totalJobOpenings?: number;
  activeJobOpenings?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyStats {
  totalJobOpenings: number;
  activeJobOpenings: number;
  filledJobOpenings: number;
  totalCandidatesApplied: number;
  candidatesInProcess: number;
}

export interface CompanyDetail extends Company {
  stats: CompanyStats;
  recentJobOpenings: Array<{
    id: number;
    title: string;
    status: JobOpeningStatus;
    priority: JobPriority;
    openedAt: string;
    totalCandidates: number;
  }>;
}

export interface CompanyPayload {
  legalName: string;
  tradeName?: string | null;
  cnpj: string;
  sector?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  status?: CompanyStatus;
}

// --- Job Openings ---

export type JobLevel = 'Estagiário' | 'Júnior' | 'Pleno' | 'Sênior' | 'Especialista';
export type JobContractType = 'CLT' | 'PJ' | 'Temporário' | 'Estágio';
export type JobRegime = 'Presencial' | 'Híbrido' | 'Remoto';
export type JobOpeningStatus = 'Aberta' | 'Em Progresso' | 'Preenchida' | 'Cancelada';
export type JobPriority = 'Alta' | 'Média' | 'Baixa';

export interface JobOpening {
  id: number;
  companyId: number;
  companyName?: string;
  funnelId?: number | null;
  funnelName?: string | null;
  title: string;
  description?: string | null;
  department?: string | null;
  level?: JobLevel | null;
  contractType?: JobContractType | null;
  regime?: JobRegime | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  quantityNeeded: number;
  requiredSkills?: string | null;
  desiredSkills?: string | null;
  benefits?: string | null;
  openedAt: string;
  plannedClosedAt?: string | null;
  closedAt?: string | null;
  closedReason?: string | null;
  responsibleUserId?: number | null;
  responsibleUserName?: string | null;
  status: JobOpeningStatus;
  priority: JobPriority;
  daysOpen?: number;
  totalCandidates?: number;
  activeCandidates?: number;
  hiredCandidates?: number;
}

export interface JobOpeningAnalytics {
  jobOpening: {
    id: number;
    title: string;
    status: JobOpeningStatus;
    daysOpen: number;
    totalCandidates: number;
    activeCandidates: number;
    hiredCandidates: number;
  };
  candidatesByStage: Array<{
    stageId: number;
    stageName: string;
    candidateCount: number;
    averageRating: number | null;
  }>;
  processStatusBreakdown: Array<{ status: string; total: number }>;
  offersBreakdown: Array<{ status: string; total: number }>;
}

export interface JobOpeningPayload {
  companyId: number;
  funnelId?: number | null;
  title: string;
  description?: string | null;
  department?: string | null;
  level?: JobLevel | null;
  contractType?: JobContractType | null;
  regime?: JobRegime | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  quantityNeeded?: number;
  requiredSkills?: string | null;
  desiredSkills?: string | null;
  benefits?: string | null;
  openedAt?: string | null;
  plannedClosedAt?: string | null;
  closedAt?: string | null;
  closedReason?: string | null;
  responsibleUserId?: number | null;
  status?: JobOpeningStatus;
  priority?: JobPriority;
}

// --- Candidates ---

export type CandidateGender = 'Masculino' | 'Feminino' | 'Outro' | 'Prefiro não responder';
export type CandidateStatus = 'Ativo' | 'Inativo' | 'Bloqueado';
export type EducationLevel = 'Técnico' | 'Graduação' | 'Pós-Graduação' | 'Mestrado' | 'Doutorado';
export type EducationStatus = 'Cursando' | 'Concluído';
export type SkillLevel = 'Iniciante' | 'Intermediário' | 'Avançado' | 'Especialista';

export interface CandidateExperience {
  id: number;
  candidateId: number;
  company: string;
  position: string;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
  skills?: string | null;
}

export interface CandidateEducation {
  id: number;
  candidateId: number;
  institution: string;
  course: string;
  level?: EducationLevel | null;
  yearConclusion?: number | null;
  status?: EducationStatus | null;
}

export interface CandidateSkill {
  id: number;
  candidateId: number;
  skill: string;
  level: SkillLevel;
}

export interface Candidate {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  dateBirth?: string | null;
  gender?: CandidateGender | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
  cvFilePath?: string | null;
  notes?: string | null;
  status: CandidateStatus;
  experienceCount?: number;
  educationCount?: number;
  skillCount?: number;
  processCount?: number;
  createdAt?: string;
}

export interface CandidateDetail extends Candidate {
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  skills: CandidateSkill[];
  processes?: Array<{
    id: number;
    jobOpeningId: number;
    jobTitle: string;
    companyName?: string;
    currentStageName: string;
    status: ProcessStatus;
    startDate: string;
  }>;
}

export interface CandidatePayload {
  fullName: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  dateBirth?: string | null;
  gender?: CandidateGender | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
  notes?: string | null;
  status?: CandidateStatus;
  experiences?: Array<Omit<CandidateExperience, 'id' | 'candidateId'>>;
  education?: Array<Omit<CandidateEducation, 'id' | 'candidateId'>>;
  skills?: Array<Omit<CandidateSkill, 'id' | 'candidateId'>>;
}

export interface CsvImportResult {
  importedCount: number;
  failedCount: number;
  createdIds: number[];
  items: Candidate[];
  errors: Array<{ row: number; email?: string; error: string }>;
}

// --- Processes ---

export type ProcessStatus = 'Em Andamento' | 'Parado' | 'Concluído';
export type ProcessRecommendation = 'Avançar' | 'Rejeitar' | 'Em Dúvida';
export type OfferStatus = 'Enviada' | 'Visualizada' | 'Aceita' | 'Recusada';

export interface ProcessItem {
  id: number;
  jobOpeningId: number;
  candidateId: number;
  currentStageId: number;
  status: ProcessStatus;
  startDate: string;
  endDate?: string | null;
  finalResult?: string | null;
  rejectionReason?: string | null;
  jobTitle?: string;
  companyId?: number;
  companyName?: string;
  candidateName?: string;
  candidateEmail?: string;
  currentStageName?: string;
  daysInStage?: number;
  latestRating?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProcessStageHistoryItem {
  id: number;
  processId: number;
  stageId: number;
  stageName: string;
  enteredAt: string;
  exitedAt?: string | null;
  feedback?: string | null;
  rating?: number | null;
  strengths?: string | null;
  weaknesses?: string | null;
  recommendation?: ProcessRecommendation | null;
  responsibleUserName?: string | null;
}

export interface ProcessOffer {
  id: number;
  processId: number;
  position: string;
  salary?: number | null;
  benefits?: string | null;
  startDate?: string | null;
  conditions?: string | null;
  status: OfferStatus;
  createdAt?: string;
  respondedAt?: string | null;
}

export interface ProcessDetail extends ProcessItem {
  stages: ProcessStageHistoryItem[];
  offers: ProcessOffer[];
}

export interface KanbanColumn {
  stageId: number;
  stageName: string;
  stageOrder: number;
  requiresFeedback: boolean;
  isTerminal: boolean;
  count: number;
  processes: ProcessItem[];
}

export interface KanbanBoardData {
  funnelId: number | null;
  totalProcesses: number;
  columns: KanbanColumn[];
}

export interface ProcessTimelineEvent {
  eventType: 'STAGE_CHANGE' | 'OFFER' | 'AUDIT';
  timestamp: string;
  title: string;
  description?: string | null;
  rating?: number | null;
  recommendation?: string | null;
  actorName?: string | null;
  meta?: Record<string, unknown>;
}

export interface ProcessTimelineData {
  process: ProcessDetail;
  timeline: ProcessTimelineEvent[];
}

// --- Users & Profile ---

export interface UserAccount extends UserDto {
  hiringDate?: string | null;
  managerName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UserActivityData {
  user: UserAccount;
  recentLogins: LoginHistoryEntry[];
  recentAudit: AuditLogEntry[];
}

// --- Dashboard ---

export interface DashboardKpis {
  totalCompanies: number;
  activeJobOpenings: number;
  totalCandidates: number;
  ongoingProcesses: number;
  pendingOffers: number;
  hiredCount: number;
  newJobOpenings: number;
  conversionRate: number;
  avgDaysToFill: number;
  filters?: {
    startDate?: string | null;
    endDate?: string | null;
    companyId?: number | null;
    department?: string | null;
  };
}

export interface DashboardAnalytics {
  candidatesByDepartment: Array<{ department: string; total: number }>;
  jobStatusDistribution: Array<{ status: string; total: number }>;
  candidateEvolution: Array<{ date: string; total: number }>;
  candidatesByStage: Array<{
    stageId: number;
    stageName: string;
    stageOrder: number;
    candidateCount: number;
    averageRating: number | null;
  }>;
  topCompanies: Array<{
    companyId: number;
    companyName: string;
    activeJobOpenings: number;
    totalProcesses: number;
    hiredCount: number;
  }>;
}

export interface CriticalProcessItem {
  criticalType: string;
  jobOpeningId: number;
  title: string;
  companyName: string;
  daysElapsed: number;
  candidateCount: number;
}

export interface CriticalProcessesData {
  items: CriticalProcessItem[];
  total: number;
  longOpenJobsCount: number;
  stalledProcessesCount: number;
}

// --- Settings & Administration ---

export interface SystemConfigItem {
  id: number;
  configKey: string;
  configValue: string;
  dataType: string;
  category: string;
  description?: string | null;
  isSensitive?: boolean;
  updatedAt?: string;
}

export interface SystemConfigData {
  items: SystemConfigItem[];
  map: Record<string, string>;
  grouped: Record<string, SystemConfigItem[]>;
}

export interface StageTemplate {
  id: number;
  stageName: string;
  stageOrder: number;
  isActive: boolean;
  requiresFeedback: boolean;
  isTerminal: boolean;
  description?: string | null;
}

export interface StageFunnelItem {
  id?: number;
  stageId: number;
  stageName: string;
  stageOrder: number;
  requiresFeedback?: boolean;
  isTerminal?: boolean;
}

export interface StageFunnel {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
  items: StageFunnelItem[];
}

export interface EmailTemplate {
  id: number;
  templateKey: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables?: string[] | string;
  language: 'pt-BR' | 'en-US';
  isActive: boolean;
  isSystem?: boolean;
}

export interface AuditLogEntry {
  id: number;
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  action: string;
  tableName: string;
  recordId?: number | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface LoginHistoryEntry {
  id: number;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  emailAttempted: string;
  isSuccessful: boolean;
  failureReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  loginTime: string;
}

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecurityAlertStatus = 'ACTIVE' | 'RESOLVED' | 'DISMISSED';

export interface SecurityAlert {
  id: number;
  alertType: string;
  severity: SecuritySeverity;
  userId?: number | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  message: string;
  details?: Record<string, unknown> | null;
  status: SecurityAlertStatus;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: number | null;
}

export interface SecurityStats {
  totalActive: number;
  byStatus: { ACTIVE: number; RESOLVED: number; DISMISSED: number };
  activeBySeverity: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number };
  unauthorizedAttempts: { last24h: number; last7d: number; total: number };
  topOffendingIps: Array<{ ipAddress: string; attempts: number }>;
  topAttemptedResources: Array<{ resource: string; action: string; attempts: number }>;
}

export interface SecurityReport {
  id: number;
  reportDate?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  riskScore: number;
  riskLevel: SecuritySeverity;
  totalUnauthorizedAttempts?: number;
  totalFailedLogins?: number;
  totalActiveAlerts?: number;
  recommendations?: string[];
  reportData?: {
    unauthorizedAttempts?: number;
    uniqueOffendingIps?: number;
    failedLogins?: number;
    activeAlertsBySeverity?: Record<string, number>;
    recommendations?: string[];
  };
  summary?: Record<string, unknown>;
  generatedAt: string;
  createdByName?: string | null;
}

export interface RetentionPolicy {
  id: number;
  configKey: string;
  configValue: string;
  days: number;
  eligibleForCleanup: number;
  category: string;
  updatedAt?: string;
}

export interface RetentionExecutionResult {
  dryRun: boolean;
  recordsDeleted: number;
  policySummary: Record<string, unknown>;
  executedAt: string;
}

export interface RetentionExecutionLog {
  id: number;
  executedBy?: number | null;
  executedByName?: string | null;
  policySummary: Record<string, unknown>;
  recordsDeleted: number;
  executedAt: string;
}

export interface PermissionMatrixEntry {
  id: number;
  resource: PermissionResource;
  action: PermissionAction;
  description?: string | null;
  key: string;
}

export interface PermissionsMatrixData {
  roles: UserRole[];
  editableRoles: UserRole[];
  resources: PermissionResource[];
  actions: PermissionAction[];
  permissions: PermissionMatrixEntry[];
  matrix: Record<
    UserRole,
    {
      editable: boolean;
      permissionIds: number[];
      keys: string[];
    }
  >;
}

export interface BackupSnapshotResult {
  metadata: {
    generatedAt: string;
    format: 'json' | 'sql';
    provider: string;
    projectRef: string;
    managedBackupNote: string;
  };
  tableCounts: Record<string, number>;
  sqlContent?: string;
  tables?: Record<string, unknown[]>;
}
