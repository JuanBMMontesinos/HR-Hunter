import { Briefcase } from 'lucide-react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Button } from '../../../src/components/common/Button';
import { ConfirmModal } from '../../../src/components/common/ConfirmModal';
import { Tabs } from '../../../src/components/common/Tabs';
import { DashboardChartsGrid } from '../../../src/components/dashboard/AccessibleCharts';
import { CriticalProcessesCard } from '../../../src/components/dashboard/CriticalProcessesCard';
import { KpiCard } from '../../../src/components/dashboard/KpiCard';
import { ProcessKanban } from '../../../src/components/processes/ProcessKanban';
import type {
  CriticalProcessesData,
  DashboardAnalytics,
  KanbanColumn,
  ProcessItem,
} from '../../../src/types/domain';

export function TabsHarness({ selectionMode = 'automatic' }: { selectionMode?: 'automatic' | 'activation' }) {
  return (
    <Tabs
      label="Demo Tabs"
      selectionMode={selectionMode}
      testIdPrefix="ct-tab"
      items={[
        { id: 'one', label: 'Aba 1', content: <div>Conteúdo da Aba 1</div> },
        { id: 'two', label: 'Aba 2', badge: 5, content: <div>Conteúdo da Aba 2</div> },
        { id: 'three', label: 'Aba 3', content: <div>Conteúdo da Aba 3</div> },
      ]}
    />
  );
}

const SAMPLE_ANALYTICS: DashboardAnalytics = {
  candidatesByStage: [
    { stageId: 1, stageName: 'Triagem CV', stageOrder: 1, candidateCount: 12, averageRating: 4.2 },
    { stageId: 2, stageName: 'Entrevista Técnica', stageOrder: 2, candidateCount: 6, averageRating: 4.5 },
  ],
  jobStatusDistribution: [
    { status: 'Aberta', total: 4 },
    { status: 'Preenchida', total: 2 },
  ],
  candidatesByDepartment: [
    { department: 'Engenharia', total: 10 },
    { department: 'Produto', total: 5 },
  ],
  candidateEvolution: [
    { date: '2026-10-01', total: 3 },
    { date: '2026-10-15', total: 7 },
  ],
  topCompanies: [],
};

const SAMPLE_CRITICAL: CriticalProcessesData = {
  total: 1,
  longOpenJobsCount: 1,
  stalledProcessesCount: 0,
  items: [
    {
      criticalType: 'Vaga > 30 dias',
      jobOpeningId: 101,
      title: 'Tech Lead Node.js',
      companyName: 'TechNova SA',
      daysElapsed: 36,
      candidateCount: 4,
    },
  ],
};

export function DashboardWidgetsHarness() {
  return (
    <MemoryRouter>
      <div className="hr-detail-stack">
        <KpiCard
          label="Vagas Abertas"
          value={9}
          icon={<Briefcase size={18} />}
          tone="primary"
          testId="ct-kpi-jobs"
        />
        <DashboardChartsGrid analytics={SAMPLE_ANALYTICS} />
        <CriticalProcessesCard data={SAMPLE_CRITICAL} />
      </div>
    </MemoryRouter>
  );
}

export function KanbanHarness() {
  const [columns, setColumns] = useState<KanbanColumn[]>([
    {
      stageId: 1,
      stageName: 'Triagem CV',
      stageOrder: 1,
      requiresFeedback: false,
      isTerminal: false,
      count: 1,
      processes: [
        {
          id: 901,
          jobOpeningId: 10,
          candidateId: 50,
          currentStageId: 1,
          status: 'Em Andamento',
          startDate: '2026-10-01T00:00:00Z',
          candidateName: 'Mariana Souza',
          jobTitle: 'Fullstack Engineer',
          companyName: 'Acme Corp',
          currentStageName: 'Triagem CV',
          daysInStage: 3,
          latestRating: 5,
        },
      ],
    },
    {
      stageId: 2,
      stageName: 'Entrevista Técnica',
      stageOrder: 2,
      requiresFeedback: true,
      isTerminal: false,
      count: 0,
      processes: [],
    },
  ]);
  const [announcement, setAnnouncement] = useState('');

  const handleMove = async (proc: ProcessItem, targetStageId: number, targetStageName: string) => {
    setColumns((prev) =>
      prev.map((col) => {
        if (col.stageId === proc.currentStageId) {
          const remaining = col.processes.filter((p) => p.id !== proc.id);
          return { ...col, count: remaining.length, processes: remaining };
        }
        if (col.stageId === targetStageId) {
          const updated: ProcessItem = {
            ...proc,
            currentStageId: targetStageId,
            currentStageName: targetStageName,
          };
          const next = [...col.processes, updated];
          return { ...col, count: next.length, processes: next };
        }
        return col;
      }),
    );
    setAnnouncement(`Processo de ${proc.candidateName} movido para ${targetStageName}.`);
  };

  return (
    <ProcessKanban
      columns={columns}
      canUpdate={true}
      announcement={announcement}
      onMoveStage={handleMove}
      onOpenDetail={() => {}}
    />
  );
}

export function ConfirmAndProgressHarness() {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="hr-detail-stack">
      <progress className="hr-risk-progress" max={100} value={62} aria-label="Pontuação de Risco" />
      <Button onClick={() => setOpen(true)}>Solicitar Confirmação</Button>
      {confirmed ? <span data-testid="confirm-result">Confirmado</span> : null}
      <ConfirmModal
        open={open}
        title="Confirmar Exclusão"
        message="Deseja prosseguir com a remoção?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          setConfirmed(true);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
