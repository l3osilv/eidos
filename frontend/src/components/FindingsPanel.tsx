import { ClipboardList, Activity, AlertCircle } from 'lucide-react';
import { Finding, Patient } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface FindingsPanelProps {
  patient: Patient;
  findings: Finding[];
  isClassifying: boolean;
  onExecute: () => void;
}

const getPercentageString = (prob: number) => `${(prob * 100).toFixed(0)}%`;

const BAR_COLORS = {
  Blood: { positive: 'bg-red-600', negative: 'bg-slate-400' },
  Ischemia: { positive: 'bg-orange-500', negative: 'bg-slate-400' },
  Chronic_Ischemia: { positive: 'bg-amber-500', negative: 'bg-slate-400' },
  Edema: { positive: 'bg-indigo-500', negative: 'bg-slate-400' },
  Mass: { positive: 'bg-purple-500', negative: 'bg-slate-400' },
};

export default function FindingsPanel({
  patient,
  findings,
  isClassifying,
  onExecute,
}: FindingsPanelProps) {
  const { t } = useLanguage();

  const LABEL_LABELS: Record<string, string> = {
    Blood: t('findings.label.blood'),
    Ischemia: t('findings.label.ischemia'),
    Chronic_Ischemia: t('findings.label.chronic_ischemia'),
    Edema: t('findings.label.edema'),
    Mass: t('findings.label.mass'),
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm" id="findings-panel">
      <h3 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
        <ClipboardList className="h-4.5 w-4.5 text-sky-500 shrink-0" />
        {t('findings.title')}
      </h3>

      {findings.length === 0 ? (
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-5 text-center flex flex-col items-center justify-center gap-3">
          <Activity className="h-10 w-10 text-slate-300 animate-pulse" />
          <div>
            <p className="text-xs font-semibold text-slate-700">{t('findings.emptyTitle')}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {t('findings.emptyDesc')}
            </p>
          </div>

          <button
            onClick={onExecute}
            disabled={isClassifying || patient.validated}
            className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 transition disabled:opacity-50 font-mono shadow-sm uppercase tracking-wide cursor-pointer"
            id="btn-esegui-valutazione"
          >
            {isClassifying ? (
              <>
                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                {t('findings.executing')}
              </>
            ) : (
              <>
                <ClipboardList className="h-3.5 w-3.5" />
                {t('findings.btnExecute')}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3.5" id="classification-findings-container">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {findings.map((f) => {
              const barColors = BAR_COLORS[f.label as keyof typeof BAR_COLORS] || { positive: 'bg-blue-600', negative: 'bg-slate-400' };

              return (
                <div
                  key={f.label}
                  className={`sm:col-span-1 border rounded p-2.5 flex flex-col justify-between h-20 transition ${
                    f.positive ? 'shadow-sm ring-1 ring-red-300 bg-slate-50/20' : 'bg-white opacity-85 hover:opacity-100'
                  }`}
                  id={`finding-block-${f.label}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-800 leading-tight font-sans">
                      {LABEL_LABELS[f.label] || f.label}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`text-sm font-semibold font-mono ${f.positive ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                      {getPercentageString(f.probability)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">soglia {getPercentageString(f.threshold)}</span>
                  </div>

                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1 p-0">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${f.positive ? barColors.positive : barColors.negative}`}
                      style={{ width: `${f.probability * 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          {patient.validated && (
            <div className="bg-slate-50 border border-slate-200 rounded p-2.5 flex items-center gap-2 text-[11px] text-slate-500 font-sans mt-2" id="findings-validated-notice">
              <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
              <span>
                L'esame è stato validato. Per rieseguire l'analisi, un medico strutturato deve prima riaprire il referto.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
              {t('findings.thresholdNote')}
            </span>
            {patient.validated ? (
              <span className="text-slate-400 font-bold uppercase select-none" title="Il referto è validato. Per rieseguire, il medico deve prima riaprire il referto.">
                {t('findings.locked')}
              </span>
            ) : (
              <button
                onClick={onExecute}
                disabled={isClassifying}
                className="text-blue-900 hover:text-blue-950 font-bold underline uppercase cursor-pointer"
              >
                {t('findings.reexecute')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

