import { ClipboardList, RefreshCw, Activity, AlertCircle } from 'lucide-react';
import { Finding } from '../types';

interface FindingsPanelProps {
  findings: Finding[];
  isClassifying: boolean;
  onExecute: () => void;
}

export default function FindingsPanel({
  findings,
  isClassifying,
  onExecute,
}: FindingsPanelProps) {
  const getPercentageString = (prob: number) => {
    return `${(prob * 100).toFixed(0)}%`;
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm" id="findings-panel">
      <h3 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
        <ClipboardList className="h-4.5 w-4.5 text-sky-500 shrink-0" />
        RILEVAZIONE STRUMENTALE REPERTI — Analisi Clinica del Volume
      </h3>

      {findings.length === 0 ? (
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-5 text-center flex flex-col items-center justify-center gap-3">
          <Activity className="h-10 w-10 text-slate-350 animate-pulse" />
          <div>
            <p className="text-xs font-semibold text-slate-700">Valutazione dei reperti non ancora eseguita</p>
            <p className="text-[11px] text-slate-500 mt-1">
              L'analisi quantitativa valuterà l'intero volume TC per evidenziare eventuali alterazioni di densità o anomalie strutturali.
            </p>
          </div>
          
          <button
            onClick={onExecute}
            disabled={isClassifying}
            className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 transition disabled:opacity-50 font-mono shadow-sm uppercase tracking-wide"
            id="btn-esegui-valutazione"
          >
            {isClassifying ? (
              <>
                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                ELABORAZIONE VALUTAZIONE IN CORSO...
              </>
            ) : (
              <>
                <ClipboardList className="h-3.5 w-3.5" />
                ESEGUI VALUTAZIONE REPERTI
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3.5" id="classification-findings-container">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {findings.map((f) => {
              const labelColors = {
                Blood: f.positive ? 'text-red-700 bg-red-50 border-red-200' : 'text-slate-600 bg-slate-50 border-slate-200',
                Ischemia: f.positive ? 'text-orange-700 bg-orange-50 border-orange-200' : 'text-slate-600 bg-slate-50 border-slate-200',
                Chronic_Ischemia: f.positive ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200',
                Edema: f.positive ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-slate-600 bg-slate-50 border-slate-200',
                Mass: f.positive ? 'text-purple-700 bg-purple-50 border-purple-200' : 'text-slate-600 bg-slate-50 border-slate-200',
              };

              const barColors = {
                Blood: f.positive ? 'bg-red-600' : 'bg-slate-405 bg-slate-400',
                Ischemia: f.positive ? 'bg-orange-500' : 'bg-slate-405 bg-slate-400',
                Chronic_Ischemia: f.positive ? 'bg-amber-500' : 'bg-slate-405 bg-slate-400',
                Edema: f.positive ? 'bg-indigo-500' : 'bg-slate-405 bg-slate-400',
                Mass: f.positive ? 'bg-purple-500' : 'bg-slate-405 bg-slate-400',
              };

              const labelLabels = {
                Blood: 'Emorragia / Sangue',
                Ischemia: 'Ischemia acuta',
                Chronic_Ischemia: 'Ischemia cronica',
                Edema: 'Edema cerebrale',
                Mass: 'Massa espansiva',
              };

              return (
                <div 
                  key={f.label} 
                  className={`sm:col-span-1 border rounded p-2.5 flex flex-col justify-between h-20 transition ${
                    f.positive ? 'shadow-sm ring-1 ring-red-350 bg-slate-50/20' : 'bg-white opacity-85 hover:opacity-100'
                  }`}
                  id={`finding-block-${f.label}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-800 leading-tight font-sans">
                      {labelLabels[f.label]}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`text-sm font-semibold font-mono ${f.positive ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                      {getPercentageString(f.probability)}
                    </span>
                    <span className="text-[9px] text-slate-405 font-mono text-slate-450">soglia {getPercentageString(f.threshold)}</span>
                  </div>

                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1 p-0">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${barColors[f.label]}`} 
                      style={{ width: `${f.probability * 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
              Soglia clinica decisionale configurata su dataset di validazione: 0.50 (50%)
            </span>
            <button
              onClick={onExecute}
              disabled={isClassifying}
              className="text-blue-900 hover:text-blue-950 font-bold underline uppercase"
            >
              Riesegui Valutazione Reperti
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
