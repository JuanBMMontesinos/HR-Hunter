import { useState } from 'react';
import { Autocomplete } from '../../../src/components/common/Autocomplete';
import { Button } from '../../../src/components/common/Button';
import { DataTable, type DataTableColumn } from '../../../src/components/common/DataTable';
import { FilterBar } from '../../../src/components/common/FilterBar';
import { Input } from '../../../src/components/common/Input';
import { Modal } from '../../../src/components/common/Modal';
import { RichTextEditor } from '../../../src/components/common/RichTextEditor';
import { Select } from '../../../src/components/common/Select';
import { ToastViewport } from '../../../src/components/common/Toast';
import { ToastProvider, useToast } from '../../../src/contexts/ToastContext';

interface DemoCandidate {
  id: number;
  name: string;
  score: number;
  city: string;
}

const DEMO_ROWS: DemoCandidate[] = [
  { id: 1, name: 'Carlos Mendes', score: 78, city: 'Curitiba' },
  { id: 2, name: 'Ana Beatriz', score: 95, city: 'São Paulo' },
  { id: 3, name: 'Bruno Silva', score: 84, city: 'Recife' },
];

const DEMO_COLUMNS: Array<DataTableColumn<DemoCandidate>> = [
  { key: 'name', label: 'Candidato', sortable: true },
  { key: 'score', label: 'Pontuação', sortable: true, align: 'right' },
  { key: 'city', label: 'Cidade', sortable: false },
];

export function DataTableHarness({
  empty = false,
  loading = false,
  pageSize = 2,
}: {
  empty?: boolean;
  loading?: boolean;
  pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const rows = empty ? [] : DEMO_ROWS.slice((page - 1) * pageSize, page * pageSize);

  return (
    <DataTable
      caption="Candidatos em processo"
      columns={DEMO_COLUMNS}
      data={rows}
      rowKey={(row) => row.id}
      loading={loading}
      pagination={{
        page,
        limit: pageSize,
        total: empty ? 0 : DEMO_ROWS.length,
        totalPages: empty ? 1 : Math.ceil(DEMO_ROWS.length / pageSize),
      }}
      onPageChange={setPage}
    />
  );
}

function ModalToastInner() {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Abrir Modal</Button>
      <Button
        variant="neutral"
        onClick={() =>
          showToast({
            variant: 'success',
            title: 'Salvo',
            message: 'Registro salvo com sucesso',
          })
        }
      >
        Disparar Toast
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Confirmar ação"
        footer={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        }
      >
        <Input label="Observação" placeholder="Digite aqui" />
      </Modal>
    </div>
  );
}

export function ModalToastHarness() {
  return (
    <ToastProvider>
      <ToastViewport />
      <ModalToastInner />
    </ToastProvider>
  );
}

export function RichTextEditorHarness() {
  const [html, setHtml] = useState('<p>Olá {{candidate_name}}</p>');

  return (
    <div>
      <RichTextEditor
        label="Template de Mensagem"
        value={html}
        onChange={setHtml}
        variables={['candidate_name', 'job_title']}
      />
      <output data-testid="editor-raw-value">{html}</output>
    </div>
  );
}

export function FilterAndInputsHarness() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [city, setCity] = useState('');

  return (
    <div>
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        hasActiveFilters={Boolean(roleFilter)}
        onClearFilters={() => {
          setSearch('');
          setRoleFilter('');
        }}
      >
        <Select
          label="Status"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={[
            { value: 'active', label: 'Ativo' },
            { value: 'paused', label: 'Pausado' },
          ]}
        />
      </FilterBar>

      <Autocomplete
        label="Cidade"
        value={city}
        onChange={setCity}
        options={[
          { value: 'sp', label: 'São Paulo', hint: 'SP' },
          { value: 'rj', label: 'Rio de Janeiro', hint: 'RJ' },
          { value: 'cwb', label: 'Curitiba', hint: 'PR' },
        ]}
      />
      <output data-testid="selected-city">{city}</output>
    </div>
  );
}
