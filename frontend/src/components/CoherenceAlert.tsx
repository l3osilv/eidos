import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { CoherenceIssue } from '../types';

interface CoherenceAlertProps {
  coherenceIssues: CoherenceIssue[];
  hasMismatch: boolean;
}

const LABEL_LABELS = {
  Blood: 'Emorragia / Sangue',
  Ischemia: 'Ischemia acuta',
  Chronic_Ischemia: 'Ischemia cronica',
  Edema: 'Edema cerebrale',
  Mass: 'Massa espansiva',
};

export default function CoherenceAlert({
  coherenceIssues,
  hasMismatch,
}: CoherenceAlertProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm" id="coherence-alert-panel">
      <div className="px-4 py-2 border-b border-background bg-slate-50/55 text-[10px] font-mono font-semibold tracking-wider flex items-center justify-between">
        <span>VERIFICA DI COERENZA CLINICA (REPERTI VS TESTO REFERTO)</span>
        {hasMismatch ? (
          <span className="text-red-700 bg-red-100/80 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse border border-red-200 text-[10px]" id="coherence-warning-badge">
            <ShieldAlert className="h-3.5 w-3.5" /> INCOERENZA RILEVATA
          </span>
        ) : (
          <span className="text-emerald-700 bg-emerald-100/85 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-emerald-250 text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> ALLINEAMENTO OK
          </span>
        )}
      </div>

      {hasMismatch && (
        <div className="p-4 bg-red-50/50 border-t border-red-100 flex gap-3 items-start text-xs text-red-800" id="mismatch-warning-alert">
          <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-900 uppercase font-mono text-[11px] tracking-wider mb-1">Mancata coerenza clinica rilevata:</h4>
            <p className="text-slate-700 text-[11px] leading-normal mb-2 font-sans">
              La valutazione preliminare ha evidenziato reperti patologici positivi le cui parole semantiche o esiti non risultano compiutamente menzionate o escluse nella bozza di referto attualmente salvata.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {coherenceIssues.map((issue, i) => {
                const isMismatch = (issue.in_findings && !issue.mentioned_in_report);
                if (!isMismatch) return null;
                const mappedLabel = LABEL_LABELS[issue.label as keyof typeof LABEL_LABELS] || issue.label;
                return (
                  <div key={i} className="bg-white border border-red-200 p-1.5 rounded text-[11px] text-red-900 font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                    <span>Manca riferimento a: <strong>{mappedLabel}</strong></span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
