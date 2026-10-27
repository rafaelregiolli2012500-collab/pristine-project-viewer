/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EquipmentType, STOP_REASON_LABELS, isNullStopReason, normalizeFrenteNome } from '@/types/maintenance';
import { useMaintenanceStore } from '@/hooks/useMaintenanceStore';
import { useEquipmentStore } from '@/hooks/useEquipmentStore';
import { useFrenteStore } from '@/hooks/useFrenteStore';
import { useAuth } from '@/hooks/useAuth';
import { MaintenanceTable } from '@/components/MaintenanceTable';
import { AddMaintenanceDialog } from '@/components/AddMaintenanceDialog';
import { HistoryTable } from '@/components/HistoryTable';
import { TimelineChart, type GroupStopReason } from '@/components/TimelineChart';
import { PrintView } from '@/components/PrintView';
import { EquipmentManager } from '@/components/EquipmentManager';
import { FrenteManager } from '@/components/FrenteManager';
import { DashboardView } from '@/components/DashboardView';
import { TruckDashboard } from '@/components/TruckDashboard';
import { SettingsView } from '@/components/SettingsView';
import { LoginScreen } from '@/components/LoginScreen';
import { InstallationGate } from '@/components/InstallationGate';
import { TrajetosView } from '@/components/TrajetosView';
import { LinhaDoTempo } from '@/components/LinhaDoTempo';
import { BaseTerceirosView } from '@/components/BaseTerceirosView';
import { useBaseTerceirosStore } from '@/hooks/useBaseTerceirosStore';
import { History, BarChart3, Camera, Wrench, LayoutDashboard, Factory, Route, ClipboardList, Settings2, Activity, PowerOff, Lock, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { MoagemModule } from '@/components/MoagemModule';
import { useSystemTime } from '@/hooks/useSystemTime';
import { CoaHeader } from '@/components/coa/CoaHeader';
import { KpiCard } from '@/components/coa/KpiCard';
import { HarvesterIcon, TractorIcon, TruckIcon } from '@/components/coa/MachineIcons';
import coaHero from '@/assets/coa-hero.jpg';
import { setInstallationName } from '@/lib/access/local';
import { getActiveUnit } from '@/lib/units';

const GREEN = '#22C55E';
const BLUE = '#3B82F6';
const AMBER = '#F59E0B';

const NAV_GROUPS: { title: string; items: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  {
    title: 'Operações',
    items: [
      { value: 'manutencoes', label: 'Manutenções', icon: Wrench },
      { value: 'base-terceiros', label: 'Base e Terceiros', icon: PowerOff },
    ],
  },
  {
    title: 'Dashboard',
    items: [
      { value: 'dashboard', label: 'Dashboard Frentes', icon: LayoutDashboard },
      { value: 'dash-caminhoes', label: 'Dash Caminhões', icon: TruckIcon },
      { value: 'moagem', label: 'Moagem', icon: Factory },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { value: 'cronograma', label: 'Cronograma', icon: BarChart3 },
      { value: 'linha-tempo', label: 'Linha do Tempo', icon: Activity },
      { value: 'trajetos', label: 'Trajetos', icon: Route },
      { value: 'print', label: 'Visão para Print', icon: Camera },
    ],
  },
  {
    title: 'Dados',
    items: [
      { value: 'historico', label: 'Histórico', icon: History },
      { value: 'cadastro', label: 'Cadastro', icon: Settings2 },
    ],
  },
  {
    title: 'Configuração',
    items: [{ value: 'config', label: 'Config', icon: Wrench }],
  },
];

function Panel({
  title,
  icon,
  action,
  children,
  noPadding,
}: {
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <section className={`coa-glass coa-enter rounded-2xl w-full`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <h2 className="flex min-w-0 items-center gap-2.5 text-sm font-bold uppercase tracking-[0.1em] text-foreground">
            {icon}
            <span className="truncate">{title}</span>
          </h2>
          {action}
        </header>
      )}
      <div className={noPadding ? '' : 'p-4 sm:p-5'}>{children}</div>
    </section>
  );
}



const Index = () => {
  const { authenticated, login, logout, access, accessMessage, online } = useAuth();
  const { records, activeRecords, historyRecords, addRecord, addFromTimeline, finalizeRecord, finalizeRecordAt, updateRecord, restoreRecord, renameFrente: renameFrenteRecords, deleteRecord, clearHistory, exportData, importData } = useMaintenanceStore();
  const { equipment, addEquipment, removeEquipment, renameFrente: renameFrenteEquip } = useEquipmentStore();
  /** Cronograma: registros com tipo de manutenção "NULL" ficam apenas no Histórico. */
  const cronogramaRecords = records.filter(r => !isNullStopReason(r.stopReason));

  /**
   * ADD+ da Linha do Tempo: a frota é validada na aba Cadastro e o registro
   * recebe a mesma frota, frente e tipo de equipamento do cadastro — mesma
   * estrutura de uma manutenção aberta normalmente, para que o Cronograma o
   * agrupe na frente/frota corretas quando o tipo deixar de ser "NULL".
   */
  const findCadastro = (frota: string) => {
    const alvo = String(frota ?? '').trim();
    if (!alvo) return undefined;
    return equipment.find(e => {
      const f = String(e.frota ?? '').trim();
      return f === alvo || (/^\d+$/.test(f) && /^\d+$/.test(alvo) && Number(f) === Number(alvo));
    });
  };

  /**
   * Edição no Histórico: para registros vindos da Linha do Tempo, ao trocar
   * "NULL" por um tipo válido, a frota é revalidada na aba Cadastro e o mesmo
   * registro recebe frente/tipo do cadastro (atualização, sem duplicar).
   */
  const handleUpdateHistory: typeof updateRecord = (id, data) => {
    const atual = records.find(r => r.id === id);
    const novoTipo = data.stopReason ?? atual?.stopReason;
    if (atual?.origem === 'linha_do_tempo' && !isNullStopReason(novoTipo)) {
      const cad = findCadastro(atual.frota);
      if (!cad) {
        return { ok: false, error: 'Frota não cadastrada. Cadastre a frota na aba Cadastro antes de enviar ao Cronograma.' };
      }
      return updateRecord(id, { ...data, frota: cad.frota, equipmentType: cad.equipmentType, frente: normalizeFrenteNome(atual.frente) || cad.frente });
    }
    return updateRecord(id, data);
  };

  const handleAddFromTimeline: typeof addFromTimeline = (payload) => {
    const alvo = String(payload.frota ?? '').trim();
    const cad = alvo
      ? equipment.find(e => {
          const f = String(e.frota ?? '').trim();
          return f === alvo || (/^\d+$/.test(f) && /^\d+$/.test(alvo) && Number(f) === Number(alvo));
        })
      : undefined;
    if (!cad) {
      return { ok: false, error: 'Frota não cadastrada. Cadastre a frota na aba Cadastro antes de adicionar ao Histórico.' };
    }
    return addFromTimeline({
      ...payload,
      frota: cad.frota,
      equipmentType: cad.equipmentType,
      // Frente da ocorrência (histórica) preservada; Cadastro só como reserva.
      frente: (payload.frente && payload.frente !== 'SEM' ? normalizeFrenteNome(payload.frente) : '') || cad.frente || '',
    });
  };
  const { frentes, addFrente, removeFrente, updateFazenda, updateIdentidade, updateLider, updateKmh, updatePipa, updateCmOficina, updateTrajeto, updateNotas } = useFrenteStore();

  /** Edita número/Fazenda no cadastro original e mantém todos os vínculos. */
  const handleUpdateIdentidade = (id: string, numero: string, fazenda: string) => {
    const atual = frentes.find(f => f.id === id);
    updateIdentidade(id, numero, fazenda);
    const novoNome = `FRENTE ${numero.trim()}`;
    if (atual && atual.nome !== novoNome) {
      renameFrenteEquip(atual.nome, novoNome);
      renameFrenteRecords(atual.nome, novoNome);
    }
  };

  /**
   * Parada em grupo (Climática / Usina Parada) — um registro por frota, com o
   * horário exato da confirmação. Se a frota já possuir uma parada em aberto,
   * ela é finalizada no mesmo instante (sem sobreposição) e vai para o Histórico.
   */
  const handleStartClimate = (
    targets: { frota: string; frente: string; equipmentType: EquipmentType }[],
    reason: GroupStopReason = 'climatico',
    /** Horário de início manual (ISO). Ausente → horário atual da confirmação. */
    inicioIso?: string
  ) => {
    const nowIso = new Date().toISOString();
    const startIso = inicioIso || nowIso;
    targets.forEach(t => {
      const jaAtivo = activeRecords.find(r => r.frota === t.frota && r.stopReason === reason);
      if (jaAtivo) return; // nunca duplicar parada ativa do mesmo motivo
      const aberta = activeRecords.find(r => r.frota === t.frota);
      if (aberta) {
        // encerra a parada aberta no início da nova (sem sobreposição); se não for possível, no horário atual
        const res = finalizeRecordAt(aberta.id, startIso);
        if (!res.ok) finalizeRecordAt(aberta.id, nowIso);
      }
      addRecord({
        frente: t.frente,
        frota: t.frota,
        equipmentType: t.equipmentType,
        motivo: STOP_REASON_LABELS[reason],
        stopReason: reason,
        inicioTime: startIso,
      });
    });
  };

  /** Finaliza paradas em grupo (lápis ou X) — cada frota com seu próprio tempo. */
  const handleFinalizeClimate = (ids: string[]) => {
    const nowIso = new Date().toISOString();
    ids.forEach(id => finalizeRecordAt(id, nowIso));
  };

  const { isLocked, lockedDate } = useSystemTime();
  const { items: baseTerceiros } = useBaseTerceirosStore();
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('manutencoes');
  const [maintTab, setMaintTab] = useState<'todas' | 'colhedoras' | 'tratores' | 'caminhoes'>('todas');

  const goToMaintenance = (tab: 'todas' | 'colhedoras' | 'tratores' | 'caminhoes') => {
    setMaintTab(tab);
    setActiveTab('manutencoes');
  };

  useEffect(() => {
    document.body.style.setProperty('--coa-bg', `url(${coaHero})`);
  }, []);

  /* Nome da instalação (unidade ativa) — usado para identificação no Admin. */
  useEffect(() => {
    if (!authenticated) return;
    setInstallationName(getActiveUnit().name);
  }, [authenticated]);

  /* 1) Autorização da instalação. Só depois vem o login operacional. */
  if (access !== 'permitido') {
    return (
      <InstallationGate
        message={accessMessage ?? ''}
        verificando={access === 'verificando'}
        online={online}
      />
    );
  }

  if (!authenticated) {
    return <LoginScreen onLogin={login} />;
  }

  const activeColhedoras = activeRecords.filter(r => r.equipmentType === 'colhedora').length;
  const activeTratores = activeRecords.filter(r => r.equipmentType === 'trator').length;
  const activeCaminhoes = activeRecords.filter(r => r.equipmentType === 'caminhao').length;

  return (
    <div className="min-h-screen">
      <CoaHeader paradas={activeRecords.length} baseTerceiros={baseTerceiros.length} />

      {isLocked && lockedDate && (
        <div className="no-print flex items-center gap-2 border-b border-warning/40 bg-warning/10 px-5 py-2 text-xs text-warning">
          <Lock className="size-3.5 shrink-0" />
          <span>
            <strong>Cronograma travado</strong> na data operacional {(() => { const [y, m, d] = lockedDate.split('-'); return `${d}/${m}/${y}`; })()} — todos os cálculos estão congelados.
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="mx-auto flex w-full max-w-[2100px] flex-col gap-0 lg:flex-row">
        {/* Menu lateral */}
        <aside
          className={`no-print shrink-0 border-b border-sidebar-border bg-sidebar/85 backdrop-blur-xl lg:sticky lg:top-[74px] lg:h-[calc(100vh-74px)] lg:overflow-y-auto lg:border-b-0 lg:border-r ${collapsed ? 'lg:w-[76px]' : 'lg:w-[248px]'} transition-[width] duration-300`}
        >
          <div className="hidden justify-end px-3 pt-3 lg:flex">
            <button
              type="button"
              onClick={() => setCollapsed(v => !v)}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>

          <TabsList className="flex h-auto w-full flex-row flex-wrap items-stretch justify-start gap-1 bg-transparent p-3 lg:flex-col lg:gap-0">
            {NAV_GROUPS.map(group => (
              <div key={group.title} className="w-full lg:mb-4">
                {!collapsed && <p className="coa-group-label mb-1.5 hidden lg:block">{group.title}</p>}
                <div className="flex flex-row flex-wrap gap-1 lg:flex-col">
                  {group.items.map(item => (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      title={item.label}
                      className={`coa-nav-item w-auto justify-start! lg:w-full ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                    >
                      <item.icon className="size-[18px] shrink-0" />
                      <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                    </TabsTrigger>
                  ))}
                </div>
              </div>
            ))}
          </TabsList>

          {!collapsed && (
            <p className="hidden px-4 pb-3 pt-1 text-right text-[10px] text-muted-foreground/60 lg:block">
              Dev: Rafael Regiolli
            </p>
          )}
          {collapsed && (
            <p className="hidden px-2 pb-3 pt-1 text-center text-[9px] text-muted-foreground/60 lg:block">
              Dev
            </p>
          )}
        </aside>

        {/* Conteúdo */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Colhedoras paradas"
              value={activeColhedoras}
              hint="Equipamentos em manutenção agora"
              color={GREEN}
              icon={<HarvesterIcon className="size-8" />}
              onClick={() => goToMaintenance('colhedoras')}
            />
            <KpiCard
              label="Tratores parados"
              value={activeTratores}
              hint="Transbordos e tratores em atendimento"
              color={AMBER}
              icon={<TractorIcon className="size-8" />}
              onClick={() => goToMaintenance('tratores')}
            />
            <KpiCard
              label="Caminhões parados"
              value={activeCaminhoes}
              hint="Frota rodoviária em manutenção"
              color={BLUE}
              icon={<TruckIcon className="size-8" />}
              onClick={() => goToMaintenance('caminhoes')}
            />
          </div>

          <TabsContent value="manutencoes" className="mt-0">
            <Tabs value={maintTab} onValueChange={v => setMaintTab(v as typeof maintTab)} className="space-y-4">
              <div className="coa-glass flex flex-wrap items-center justify-between gap-2 rounded-xl p-1.5">
                <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                  <TabsTrigger value="todas" className="coa-nav-item !w-auto !py-1.5 !px-3 !gap-1.5 text-xs"><Wrench className="size-4 shrink-0" />Todas</TabsTrigger>
                  <TabsTrigger value="colhedoras" className="coa-nav-item !w-auto !py-1.5 !px-3 !gap-1.5 text-xs"><HarvesterIcon className="size-4 shrink-0" />Colhedoras</TabsTrigger>
                  <TabsTrigger value="tratores" className="coa-nav-item !w-auto !py-1.5 !px-3 !gap-1.5 text-xs"><TractorIcon className="size-4 shrink-0" />Tratores</TabsTrigger>
                  <TabsTrigger value="caminhoes" className="coa-nav-item !w-auto !py-1.5 !px-3 !gap-1.5 text-xs"><TruckIcon className="size-4 shrink-0" />Caminhões</TabsTrigger>
                </TabsList>
                <AddMaintenanceDialog
                  autoDetectType
                  triggerLabel="Adicionar Manutenção"
                  equipmentType={maintTab === 'tratores' ? 'trator' : maintTab === 'caminhoes' ? 'caminhao' : 'colhedora'}
                  onAdd={addRecord}
                  registeredEquipment={equipment}
                  frentes={frentes}
                  activeRecords={activeRecords}
                  onFinalizeAt={finalizeRecordAt}
                />
              </div>

              <TabsContent value="todas" className="mt-0 space-y-4">
                <Panel
                  title="Colhedoras em Manutenção"
                  icon={<HarvesterIcon className="size-5 text-primary" />}
                >
                  <MaintenanceTable records={records} equipmentType="colhedora" onFinalize={finalizeRecord} onUpdateRecord={updateRecord} showFrente />
                </Panel>
                <Panel
                  title="Tratores em Manutenção"
                  icon={<TractorIcon className="size-5 text-warning" />}
                >
                  <MaintenanceTable records={records} equipmentType="trator" onFinalize={finalizeRecord} onUpdateRecord={updateRecord} showFrente />
                </Panel>
                <Panel
                  title="Caminhões em Manutenção"
                  icon={<TruckIcon className="size-5 text-[#3B82F6]" />}
                >
                  <MaintenanceTable records={records} equipmentType="caminhao" onFinalize={finalizeRecord} onUpdateRecord={updateRecord} />
                </Panel>
              </TabsContent>

              <TabsContent value="colhedoras" className="mt-0">
            <Panel
              title="Colhedoras em Manutenção"
              icon={<HarvesterIcon className="size-5 text-primary" />}
            >
              <MaintenanceTable records={records} equipmentType="colhedora" onFinalize={finalizeRecord} onUpdateRecord={updateRecord} showFrente />
            </Panel>
              </TabsContent>

              <TabsContent value="tratores" className="mt-0">
            <Panel
              title="Tratores em Manutenção"
              icon={<TractorIcon className="size-5 text-warning" />}
            >
              <MaintenanceTable records={records} equipmentType="trator" onFinalize={finalizeRecord} onUpdateRecord={updateRecord} showFrente />
            </Panel>
              </TabsContent>

              <TabsContent value="caminhoes" className="mt-0">
            <Panel
              title="Caminhões em Manutenção"
              icon={<TruckIcon className="size-5 text-[#3B82F6]" />}
            >
              <MaintenanceTable records={records} equipmentType="caminhao" onFinalize={finalizeRecord} onUpdateRecord={updateRecord} />
            </Panel>
              </TabsContent>

            </Tabs>
          </TabsContent>

          <TabsContent value="print" className="mt-0">
            <Panel title="Visão para Print" icon={<Camera className="size-4 text-primary" />}>
              <PrintView records={records} frentes={frentes} equipment={equipment} onAdd={addRecord} />
            </Panel>
          </TabsContent>

          <TabsContent value="cronograma" className="mt-0">
            <Panel title="Cronogramas" icon={<BarChart3 className="size-4 text-primary" />}>
              <TimelineChart
                records={cronogramaRecords}
                equipment={equipment}
                frentes={frentes}
                onStartClimate={handleStartClimate}
                onFinalizeClimate={handleFinalizeClimate}
              />

            </Panel>
          </TabsContent>

          <TabsContent value="dashboard" className="mt-0">
            <DashboardView records={records} frentes={frentes} equipment={equipment} />
          </TabsContent>

          <TabsContent value="dash-caminhoes" className="mt-0">
            <TruckDashboard records={records} />
          </TabsContent>

          <TabsContent value="base-terceiros" className="mt-0">
            <BaseTerceirosView />
          </TabsContent>

          <TabsContent value="historico" className="mt-0">
            <Panel title="Histórico" icon={<History className="size-4 text-primary" />}>
              <HistoryTable records={historyRecords} onDelete={deleteRecord} onClearAll={clearHistory} onUpdateRecord={updateRecord} onRestore={restoreRecord} />
            </Panel>
          </TabsContent>

          <TabsContent value="moagem" className="mt-0">
            <MoagemModule />
          </TabsContent>

          <TabsContent value="trajetos" className="mt-0">
            <TrajetosView frentes={frentes} onUpdateTrajeto={updateTrajeto} onUpdateNotas={updateNotas} />
          </TabsContent>

          <TabsContent value="linha-tempo" forceMount className="mt-0 data-[state=inactive]:hidden">
            <LinhaDoTempo records={records} onAddToHistory={addFromTimeline} />
          </TabsContent>

          <TabsContent value="cadastro" className="mt-0 space-y-4">
            <FrenteManager
              frentes={frentes}
              onAdd={addFrente}
              onRemove={removeFrente}
              onUpdateFazenda={updateFazenda}
              onUpdateIdentidade={handleUpdateIdentidade}
              onUpdateLider={updateLider}
              onUpdateKmh={updateKmh}
              onUpdatePipa={updatePipa}
              onUpdateCmOficina={updateCmOficina}
            />
            <EquipmentManager
              equipment={equipment}
              onAdd={addEquipment}
              onRemove={removeEquipment}
              frentes={frentes.map(f => f.nome)}
            />
          </TabsContent>

          <TabsContent value="config" className="mt-0">
            <SettingsView
              onExport={exportData}
              onImport={importData}
              records={records}
              onLogout={logout}
            />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
};

export default Index;
