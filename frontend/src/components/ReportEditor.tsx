import { FileText, FileSpreadsheet, Save, Download, ShieldAlert, CheckCircle2, Lock, CheckCheck } from 'lucide-react';
import { Patient, User } from '../types';

interface ReportEditorProps {
  patient: Patient;
  currentUser: User | null;
  reportText: string;
  setReportText: (text: string) => void;
  disclaimer: string;
  isGeneratingReport: boolean;
  isSavingReport: boolean;
  isValidating: boolean;
  onGenerateReportText: () => void;
  onSaveDraftChanges: () => void;
  onExportTextFile: () => void;
  onValidateReport: () => void;
}

export default function ReportEditor({
  patient,
  currentUser,
  reportText,
  setReportText,
  disclaimer,
  isGeneratingReport,
  isSavingReport,
  isValidating,
  onGenerateReportText,
  onSaveDraftChanges,
  onExportTextFile,
  onValidateReport,
}: ReportEditorProps) {
  return (
    <div className="space-y-4">
      {/* Sezione C: compilazione referto testuale */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3.5" id="clinical-reporting-editor">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-4.5 w-4.5 text-slate-600" />
            STESURA E REVISIONE CLINICA DEL REFERTO
          </h3>
          
          <span id="save-alert-badge" className="text-emerald-700 bg-emerald-50 text-[10px] border border-emerald-250 font-bold font-mono py-0.5 px-2 rounded opacity-0 transition-opacity duration-300">
            SALVATO NEL SISTEMA
          </span>
        </div>

        {/* Area di compilazione del referto */}
        {!patient.has_report && !reportText ? (
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-8 text-center flex flex-col items-center justify-center gap-3">
            <FileSpreadsheet className="h-10 w-10 text-slate-350" />
            <div>
              <p className="text-xs font-semibold text-slate-700">Testo del referto non ancora preparato</p>
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                {!patient.has_classification 
                  ? "Disabilitato: è necessario eseguire prima la valutazione preliminare dei reperti per abilitare la stesura strutturata."
                  : "La valutazione dei reperti è stata completata con successo. Clicca sotto per preparare la bozza di referto strutturata secondo il protocollo clinico."}
              </p>
            </div>

            <div className="relative group">
              <button
                disabled={!patient.has_classification || isGeneratingReport}
                onClick={onGenerateReportText}
                className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 transition disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 font-mono shadow-sm uppercase tracking-wide cursor-pointer"
                id="btn-genera-referto"
              >
                {isGeneratingReport ? (
                  <>
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                    ELABORAZIONE BOZZA...
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5" />
                    PREPARA BOZZA REFERTO CLINICO
                  </>
                )}
              </button>
              
              {!patient.has_classification && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] py-1 px-2.5 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none border border-slate-800" id="generate-tooltip-warn">
                  Prerequisito: Esegui prima la valutazione dei reperti
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3" id="draft-editor-active">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider flex justify-between items-center bg-slate-50 border border-slate-150 p-2 rounded">
                <span>EDITORE DI REFERTAZIONE NEURORADIOLOGICA (STILE LATEX)</span>
                <span className="text-[9px] italic font-normal text-slate-500 font-sans">Bozza conforme al layout di stampa clinica</span>
              </label>

              <div className="bg-[#fdfcfb] border border-slate-200 shadow-inner rounded p-8 md:p-12 max-w-3xl mx-auto my-2 relative overflow-hidden select-text border-t-4 border-t-slate-400">
                {/* LaTeX Header Block */}
                <div className="border-b border-slate-200 pb-3 mb-6 text-slate-455 text-slate-400 text-[10px] font-mono flex justify-between uppercase tracking-wider">
                  <span>MEDICINAI REPORTING SYSTEM</span>
                  <span>ID PAZIENTE: {patient.patient_id.substring(0, 8)}...</span>
                </div>
                
                {/* Document Title */}
                <div className="text-center mb-8 font-serif">
                  <h1 className="text-base md:text-lg font-bold text-slate-900 tracking-wide uppercase">
                    REFERTO DI ESAME TC ENCEFALO
                  </h1>
                  <div className="w-16 h-[1px] bg-slate-355 bg-slate-300 mx-auto mt-2"></div>
                </div>

                {/* Textarea mimicking the document page */}
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  rows={14}
                  className="w-full bg-transparent text-slate-800 text-[14px] md:text-[15px] focus:outline-none leading-relaxed font-serif resize-y"
                  style={{ fontFamily: '"EB Garamond", Georgia, serif', minHeight: '320px' }}
                  placeholder="Inizia a digitare il referto clinico..."
                  id="editorial-clinical-textarea"
                />

                {/* Page Footer Mock */}
                <div className="border-t border-slate-200 pt-3 mt-6 text-slate-455 text-slate-400 text-[9px] font-mono flex justify-between uppercase tracking-wider">
                  <span>DATA CARICAMENTO: {new Date(patient.created_at).toLocaleDateString('it-IT')}</span>
                  <span>PAGINA 1 DI 1</span>
                </div>
              </div>
            </div>

            {disclaimer && (
              <div className="bg-amber-500/10 border border-amber-500/25 p-2.5 rounded text-[11px] text-amber-800 flex gap-2 items-start" id="disclaimer bg">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                <p className="leading-snug">
                  <span className="font-semibold">AVVISO STRUMENTALE CLINICO:</span> {disclaimer}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-3" id="editor-actions-controls">
              <div className="flex gap-2">
                <button
                  onClick={onSaveDraftChanges}
                  disabled={isSavingReport || !reportText.trim()}
                  className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 transition disabled:opacity-50 font-mono shadow-sm uppercase tracking-wide cursor-pointer"
                  id="draft-save-btn"
                >
                  {isSavingReport ? (
                    <>
                      <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                      SALVATAGGIO BOZZA...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      SALVA MODIFICHE BOZZA
                    </>
                  )}
                </button>

                <button
                  onClick={onExportTextFile}
                  className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded flex items-center gap-1.5 transition border border-slate-200 font-mono tracking-wide uppercase shadow-sm cursor-pointer"
                  id="export-file-referto-btn"
                >
                  <Download className="h-3.5 w-3.5" />
                  ESPORTA .TXT
                </button>
              </div>

              <button
                onClick={onGenerateReportText}
                disabled={isGeneratingReport}
                className="text-xs font-mono font-bold hover:text-blue-950 text-blue-900 underline cursor-pointer"
              >
                Ripristina bozza di referto originale
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Sezione D: validazione clinica finale e firma digitale */}
      <section className="bg-white border border-slate-200 text-slate-800 rounded-lg p-4 shadow-sm overflow-hidden relative" id="final-medico-validation-panel">
        {patient.validated ? (
          <div className="bg-emerald-50 border border-emerald-250 rounded-lg p-3.5 flex gap-3 items-center text-xs text-emerald-800" id="validated-successfully-badge bg">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold text-emerald-900 font-mono text-[11px] tracking-wider uppercase mb-0.5">
                REFERTO VALIDATO CLINICAMENTE E FIRMATO
              </h4>
              <p className="text-slate-655 text-[11px] text-slate-650 leading-relaxed">
                Questo referto è stato firmato digitalmente, archiviato nel sistema RIS/PACS ospedaliero ed è idoneo all'uso clinico definitivo.
              </p>
              <p className="text-[10px] font-mono text-emerald-700 mt-1.5 uppercase font-bold">
                Firmato digitalmente da: {patient.validated_by}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 md:max-w-[70%]">
              <h4 className="font-bold text-blue-900 font-mono text-[11px] tracking-wider uppercase">
                FIRMA E VALIDAZIONE CLINICA DEFINITIVA
              </h4>
              <p className="text-slate-500 text-[11px] leading-relaxed font-sans">
                Verificare con cura il testo del referto. Una volta convalidato e firmato digitalmente dal medico strutturato, il referto sarà bloccato in sola lettura e trasmesso ai reparti clinici.
              </p>
            </div>

            {currentUser?.role === 'medico' ? (
              <button
                disabled={isValidating || !patient.has_report}
                onClick={onValidateReport}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded flex items-center justify-center gap-1.5 transition md:self-auto shadow-sm font-mono self-start uppercase tracking-wide cursor-pointer"
                id="btn-validate-medico"
              >
                {isValidating ? (
                  <>
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                    REGISTRAZIONE FIRMA DIGITALE...
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4.5 w-4.5" />
                    CONVALIDA E APPLICA FIRMA DIGITALE
                  </>
                )}
              </button>
            ) : (
              <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded text-[11px] text-slate-500 font-mono flex items-center gap-2" id="trainee-restricted-box">
                <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <div>
                  <span className="text-amber-800 font-bold block uppercase text-[10px]">Firma Riservata</span>
                  <span>La validazione richiede la firma del Medico Strutturato.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
