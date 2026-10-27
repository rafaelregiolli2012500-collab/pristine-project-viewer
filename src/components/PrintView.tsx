/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useRef, useState, type CSSProperties } from 'react';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { MaintenanceRecord, FrenteConfig, StopReason, STOP_REASON_LABELS, STOP_REASON_SHORT_LABELS, STOP_REASON_COLORS, Equipment } from '@/types/maintenance';
import { contrastTextColor, subtleBorderForBackground } from '@/lib/statusColor';
import { TimerCell } from './TimerCell';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddMaintenanceDialog } from './AddMaintenanceDialog';
import { isSameOperationalDay } from '@/lib/operationalDay';

interface Props {
  records: MaintenanceRecord[];
  frentes: FrenteConfig[];
  equipment?: Equipment[];
  onAdd?: (data: any) => void;
}

const trunc25 = (v?: string) => {
  const t = (v || '').trim();
  if (!t) return '-';
  return t.length > 25 ? `${t.slice(0, 25)}...` : t;
};

export function PrintView({ records, frentes, equipment = [], onAdd }: Props) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  const activeRecords = records.filter(r => r.status === 'em_manutencao');
  const activeColhedoras = activeRecords.filter(r => r.equipmentType === 'colhedora');
  const activeTratores = activeRecords.filter(r => r.equipmentType === 'trator');
  const activeCaminhoes = activeRecords.filter(r => r.equipmentType === 'caminhao');

  const frenteNum = (s: string) => {
    const m = (s || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
  };
  const sortByFrenteFrota = (a: MaintenanceRecord, b: MaintenanceRecord) =>
    frenteNum(a.frente) - frenteNum(b.frente) || a.frota.localeCompare(b.frota);

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

  const handleCopy = async () => {
    if (!captureRef.current) return;
    setCopying(true);
    try {
      const el = captureRef.current;
      await document.fonts?.ready;

      // Freeze the geometry that is already rendered on screen. html2canvas creates
      // its own document; without these measurements the cloned tables can run a
      // second layout pass with different column widths.
      const panelRect = el.getBoundingClientRect();
      const panelWidth = Math.ceil(panelRect.width);
      const panelHeight = Math.ceil(el.scrollHeight);
      const measuredTables = Array.from(el.querySelectorAll('table')).map(table => ({
        width: table.getBoundingClientRect().width,
        rows: Array.from(table.rows).map(row => ({
          height: row.getBoundingClientRect().height,
          cells: Array.from(row.cells).map(cell => cell.getBoundingClientRect().width),
        })),
      }));

      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: Math.max(2, Math.min(window.devicePixelRatio || 1, 3)),
        useCORS: true,
        width: panelWidth,
        height: panelHeight,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        onclone: clonedDocument => {
          const clone = clonedDocument.querySelector<HTMLElement>('[data-print-panel]');
          if (!clone) return;

          clone.dataset.printMode = 'true';
          clone.style.setProperty('width', `${panelWidth}px`, 'important');
          clone.style.setProperty('min-width', `${panelWidth}px`, 'important');
          clone.style.setProperty('max-width', `${panelWidth}px`, 'important');
          clone.style.setProperty('height', `${panelHeight}px`, 'important');
          clone.style.setProperty('box-sizing', 'border-box', 'important');

          Array.from(clone.querySelectorAll('table')).forEach((table, tableIndex) => {
            const measurement = measuredTables[tableIndex];
            if (!measurement) return;

            const tableElement = table as HTMLElement;
            tableElement.style.setProperty('width', `${measurement.width}px`, 'important');
            tableElement.style.setProperty('min-width', `${measurement.width}px`, 'important');
            tableElement.style.setProperty('max-width', `${measurement.width}px`, 'important');
            tableElement.style.setProperty('table-layout', 'fixed', 'important');

            Array.from(table.rows).forEach((row, rowIndex) => {
              const rowMeasurement = measurement.rows[rowIndex];
              if (!rowMeasurement) return;
              row.style.setProperty('height', `${rowMeasurement.height}px`, 'important');

              Array.from(row.cells).forEach((cell, cellIndex) => {
                const cellWidth = rowMeasurement.cells[cellIndex];
                if (!cellWidth) return;
                cell.style.setProperty('width', `${cellWidth}px`, 'important');
                cell.style.setProperty('min-width', `${cellWidth}px`, 'important');
                cell.style.setProperty('max-width', `${cellWidth}px`, 'important');
                cell.style.setProperty('box-sizing', 'border-box', 'important');
                cell.style.setProperty('vertical-align', 'middle', 'important');
              });
            });
          });
        },
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => result ? resolve(result) : reject(new Error('Falha ao gerar a imagem')), 'image/png');
      });
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success('Print copiado!');
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `print-manutencao-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Print baixado!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao copiar print');
    } finally {
      setCopying(false);
    }
  };

  const cellBase: CSSProperties = {
    padding: '5px 8px',
    borderRight: '1px solid #e5e7eb',
    verticalAlign: 'middle',
    overflow: 'hidden',
  };

  const renderCompactRow = (r: MaintenanceRecord, showFrente = true) => {
    const inicio = new Date(r.inicioTime);
    const isOld = !isSameOperationalDay(inicio, now);
    const horaStr = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dataStr = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const reason = (r.stopReason || 'manutencao') as StopReason;
    // Cor oficial do sistema (mesma usada no cronograma e na legenda)
    const bg = STOP_REASON_COLORS[reason];
    // Contraste calculado automaticamente: fundo claro -> preto, fundo escuro -> branco
    const textColor = contrastTextColor(bg);
    const statusBorder = subtleBorderForBackground(bg);
    const statusLabel = STOP_REASON_SHORT_LABELS[reason] || STOP_REASON_LABELS[reason];
    return (
      <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
        <td style={{ ...cellBase, fontFamily: 'monospace', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{r.frota}</td>
        {showFrente && <td style={{ ...cellBase, fontSize: 12, whiteSpace: 'nowrap' }}>{r.frente || '-'}</td>}
        {/* STATUS = célula real da tabela (sem badge flutuante) */}
        <td
          data-status-cell
          style={{
            ...cellBase,
            padding: '5px 6px',
            textAlign: 'center',
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1.2,
            textTransform: 'uppercase',
            letterSpacing: 0.2,
            background: bg,
            color: textColor,
            borderRight: statusBorder ? `1px solid ${statusBorder}` : '1px solid #e5e7eb',
            wordBreak: 'break-word',
          }}
        >
          {statusLabel}
        </td>
        <td style={{ ...cellBase, fontSize: 11, lineHeight: 1.3, wordBreak: 'break-word' }}>{r.motivo || '-'}</td>
        <td style={{ ...cellBase, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
          {isOld ? (
            <span>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>{dataStr}</span>{' '}
              <span>{horaStr}</span>
            </span>
          ) : horaStr}
        </td>
        <td style={{ ...cellBase, borderRight: 'none', whiteSpace: 'nowrap', fontSize: 11 }}><span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}><TimerCell startIso={r.inicioTime} minutesOnly /></span></td>
      </tr>
    );
  };

  const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '4px 8px',
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#475569',
    fontWeight: 700,
    borderRight: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  };

  const tableCols = (showFrente = true) => (
    <colgroup>
      <col style={{ width: 78 }} />
      {showFrente && <col style={{ width: 104 }} />}
      <col style={{ width: 158 }} />
      <col />
      <col style={{ width: 104 }} />
      <col style={{ width: 70 }} />
    </colgroup>
  );

  const tableHeader = (showFrente = true) => (
    <thead>
      <tr style={{ borderBottom: '1px solid #d1d5db', background: '#eef2f7' }}>
        <th style={thStyle}>Frota</th>
        {showFrente && <th style={thStyle}>Frente</th>}
        <th data-status-header style={{ ...thStyle, textAlign: 'center' }}>Status</th>
        <th style={thStyle}>Motivo</th>
        <th style={thStyle}>Início</th>
        <th style={{ ...thStyle, borderRight: 'none' }}>Tempo</th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-2 w-full flex flex-col items-center">
      {/* Toolbar — fora do print */}
      <div className="flex items-center justify-between no-print w-full max-w-[1180px] mx-auto">
        <div className="flex items-center gap-2">
          {onAdd && (
            <AddMaintenanceDialog equipmentType="colhedora" autoDetectType onAdd={onAdd} registeredEquipment={equipment} frentes={frentes} />
          )}
        </div>
        <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1">
          <Copy className="w-3.5 h-3.5" />
          {copying ? 'Copiando...' : 'Copiar Print'}
        </Button>
      </div>

      {/* Conteúdo capturado pelo Copiar */}
      <div
        ref={captureRef}
        id="visao-print-area"
        data-print-panel
        style={{
          width: 1180,
          maxWidth: '100%',
          margin: '0 auto',
          background: '#ffffff',
          color: '#0f172a',
          padding: 22,
          fontFamily: 'Arial, Helvetica, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, margin: 0, color: '#0f172a' }}>
            Situação de Manutenção em Campo
          </h2>
          <p style={{ fontSize: 13, color: '#475569', margin: '6px 0 0', fontWeight: 600 }}>{dateStr} — {timeStr}</p>
        </div>

        {/* Frentes + Localidades + KM/H */}
        {frentes.length > 0 && (
          <div style={{ border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: '#1e3a8a', color: '#ffffff', fontSize: 12, fontWeight: 700, padding: '5px 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              FRENTES DE COLHEITA
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, width: 100 }}>Frente</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Fazenda</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, width: 70 }}>KM/H</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, width: 150 }}>Coordenador</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, width: 90 }}>Pipa</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, width: 110 }}>CM Oficina</th>
                </tr>
              </thead>
              <tbody>
                {frentes.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 700, fontSize: 12 }}>{f.nome}</td>
                    <td style={{ padding: '4px 8px', fontSize: 12, wordBreak: 'break-word' }}>{f.fazenda || f.localidade || '-'}</td>
                    <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 12 }}>{f.kmh || '-'}</td>
                    <td style={{ padding: '4px 8px', fontSize: 12, wordBreak: 'break-word' }}>{f.lider || '-'}</td>
                    <td style={{ padding: '4px 8px', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.pipa || ''}>{trunc25(f.pipa)}</td>
                    <td style={{ padding: '4px 8px', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.cmOficina || ''}>{trunc25(f.cmOficina)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* COLHEDORAS */}
        {activeColhedoras.length > 0 && (
          <div style={{ border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: '#1e3a8a', color: '#ffffff', fontSize: 13, fontWeight: 700, padding: '6px 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              COLHEDORAS ({activeColhedoras.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              {tableCols(true)}
              {tableHeader(true)}
              <tbody>
                {activeColhedoras.sort(sortByFrenteFrota).map(r => renderCompactRow(r, true))}
              </tbody>
            </table>
          </div>
        )}

        {/* TRATORES */}
        {activeTratores.length > 0 && (
          <div style={{ border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: '#1e3a8a', color: '#ffffff', fontSize: 13, fontWeight: 700, padding: '6px 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              TRATORES ({activeTratores.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              {tableCols(true)}
              {tableHeader(true)}
              <tbody>
                {activeTratores.sort(sortByFrenteFrota).map(r => renderCompactRow(r, true))}
              </tbody>
            </table>
          </div>
        )}

        {/* CAMINHÕES */}
        {activeCaminhoes.length > 0 && (
          <div style={{ border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: '#1e3a8a', color: '#ffffff', fontSize: 13, fontWeight: 700, padding: '6px 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              CAMINHÕES ({activeCaminhoes.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              {tableCols(false)}
              {tableHeader(false)}
              <tbody>
                {activeCaminhoes.sort((a, b) => a.frota.localeCompare(b.frota)).map(r => renderCompactRow(r, false))}
              </tbody>
            </table>
          </div>
        )}

        {activeRecords.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: '#6b7280', fontSize: 14 }}>Nenhum equipamento em manutenção</div>
        )}
      </div>
    </div>
  );
}
