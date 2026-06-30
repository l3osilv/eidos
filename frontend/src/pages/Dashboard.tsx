import { useState } from 'react';
import { Search, Calendar, FileSpreadsheet, Plus, Database } from 'lucide-react';
import { Patient } from '../types';

interface DashboardProps {
  patients: Patient[];
  onSelectPatient: (id: string) => void;
  onOpenNewPatientForm: () => void;
}

type FilterStatus = 'ALL' | 'TO_CLASSIFY' | 'CLASSIFIED' | 'REPORT_GENERATED' | 'VALIDATED';

export default function Dashboard({
  patients,
  onSelectPatient,
  onOpenNewPatientForm,
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

  // Stato aggregato del paziente ricavato dai tre flag booleani.
  // L'ordine di precedenza è: validated > has_report > has_classification > niente
  const getPatientStatus = (p: Patient): 'TO_CLASSIFY' | 'CLASSIFIED' | 'REPORT_GENERATED' | 'VALIDATED' => {
    if (p.validated) return 'VALIDATED';
    if (p.has_report) return 'REPORT_GENERATED';
    if (p.has_classification) return 'CLASSIFIED';
    return 'TO_CLASSIFY';
  };

  const getStatusBadge = (p: Patient) => {
    const status = getPatientStatus(p);
    switch (status) {
      case 'VALIDATED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[11px] font-medium px-2.5 py-0.5 rounded-full" id={`status-badge-validated-${p.patient_id}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Validato
          </span>
        );
      case 'REPORT_GENERATED':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[11px] font-medium px-2.5 py-0.5 rounded-full" id={`status-badge-reported-${p.patient_id}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Referto Redatto
          </span>
        );
      case 'CLASSIFIED':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-700 border border-sky-500/20 text-[11px] font-medium px-2.5 py-0.5 rounded-full" id={`status-badge-classified-${p.patient_id}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            Analizzato
          </span>
        );
      case 'TO_CLASSIFY':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-500/10 text-slate-700 border border-slate-500/20 text-[11px] font-medium px-2.5 py-0.5 rounded-full" id={`status-badge-toclassify-${p.patient_id}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Da Analizzare
          </span>
        );
    }
  };

  // Filtraggio combinato: testo libero su nome/CF/ID + tab di stato
  const filteredPatients = patients.filter(p => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      p.nome.toLowerCase().includes(query) ||
      p.cognome.toLowerCase().includes(query) ||
      p.codice_fiscale.toLowerCase().includes(query) ||
      p.patient_id.toLowerCase().includes(query);

    const status = getPatientStatus(p);
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'TO_CLASSIFY' && status === 'TO_CLASSIFY') ||
      (statusFilter === 'CLASSIFIED' && status === 'CLASSIFIED') ||
      (statusFilter === 'REPORT_GENERATED' && status === 'REPORT_GENERATED') ||
      (statusFilter === 'VALIDATED' && status === 'VALIDATED');

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" id="patient-dashboard-list">
      {/* Intestazione della tabella con titolo e azioni */}
      <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Titolo e descrizione sintetica */}
        <div>
          <h2 className="text-sm font-semibold text-slate-800 tracking-tight flex items-center gap-2 uppercase font-mono">
            <Database className="h-4 w-4 text-slate-500" />
            Registro Pazienti ed Esami Neuroradiologici
          </h2>
          <p className="text-xs text-slate-500">
            Seleziona un esame per visualizzare le slice TC, avviare la valutazione dei reperti e redigere il referto.
          </p>
        </div>

        {/* Bottone per aggiungere un paziente */}
        <button
          onClick={onOpenNewPatientForm}
          className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 self-start md:self-auto transition shadow-sm uppercase font-mono tracking-wide"
          id="btn-registra-paziente"
        >
          <Plus className="h-4 w-4" />
          REGISTRA NUOVO PAZIENTE
        </button>
      </div>

      {/* Pannello filtri: barra di ricerca e tab di stato */}
      <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Campo di testo per la ricerca */}
        <div className="relative md:col-span-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Cerca per Nome, CF o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 bg-white rounded text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 font-sans"
            id="search-patient-input"
          />
        </div>

        {/* Filtri rapidi per stato */}
        <div className="flex flex-wrap gap-1.5 md:col-span-2 md:justify-end" id="filter-tabs-pannel">
          {(['ALL', 'TO_CLASSIFY', 'CLASSIFIED', 'REPORT_GENERATED', 'VALIDATED'] as FilterStatus[]).map((filter) => {
            const labels: Record<FilterStatus, string> = {
              ALL: 'Tutti',
              TO_CLASSIFY: 'Da Analizzare',
              CLASSIFIED: 'Analizzati',
              REPORT_GENERATED: 'Refertati',
              VALIDATED: 'Validati',
            };
            const isActive = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition ${isActive
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabella dei dati */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
              <th className="py-3 px-4">Paziente {`&`} Codice ID</th>
              <th className="py-3 px-4">Codice Fiscale</th>
              <th className="py-3 px-4 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data Caricamento
              </th>
              <th className="py-3 px-4">Slice</th>
              <th className="py-3 px-4">Stato Diagnostico</th>
              <th className="py-3 px-4 text-right">Azione Clinica</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredPatients.length > 0 ? (
              filteredPatients.map((p) => {
                const status = getPatientStatus(p);
                return (
                  <tr
                    key={p.patient_id}
                    className="hover:bg-slate-50/70 transition cursor-pointer"
                    onClick={() => onSelectPatient(p.patient_id)}
                    id={`patient-row-${p.patient_id}`}
                  >
                    {/* Nome, Cognome e ID del paziente */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 text-sm">
                        {p.cognome.toUpperCase()} {p.nome}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        ID: <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded">{p.patient_id}</span>
                      </div>
                    </td>

                    {/* Codice Fiscale */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono bg-slate-50 border border-slate-100 font-medium text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                        {p.codice_fiscale}
                      </span>
                    </td>

                    {/* Data di inserimento */}
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {formatDate(p.created_at)}
                    </td>

                    {/* Conteggio slice */}
                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {p.num_slices} / 8 png
                    </td>

                    {/* Badge dello stato */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        {getStatusBadge(p)}
                        {p.validated && p.validated_by && (
                          <div className="text-[10px] italic text-slate-400 mt-0.5">
                            Convalidato da: <span className="underline font-mono text-slate-500">{p.validated_by}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Pulsanti per l'azione clinica */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectPatient(p.patient_id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded transition shadow-sm uppercase font-mono tracking-wide ${status === 'VALIDATED'
                            ? 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                            : 'bg-blue-900 hover:bg-blue-950 text-white'
                          }`}
                        id={`btn-esamina-paziente-${p.patient_id}`}
                      >
                        {status === 'VALIDATED' ? 'Visualizza Referto' : 'Esamina Esame'}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-1.5">
                    <FileSpreadsheet className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium">Nessun esame corrisponde ai criteri impostati.</p>
                    <p className="text-xs">Prova a cambiare i filtri superiori o a cercare un codice diverso.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
