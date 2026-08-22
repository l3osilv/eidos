import { useState, useEffect } from 'react';
import { ArrowLeft, Download, AlertCircle, CheckCheck } from 'lucide-react';
import { Patient, Finding, User, CoherenceIssue } from '../types';
import {
  apiClassifyPatient, apiGenerateReport, apiUpdateReport,
  apiValidateReport, apiExportReport, apiUnvalidateReport
} from '../api';
import PacsViewer from '../components/PacsViewer';
import FindingsPanel from '../components/FindingsPanel';
import CoherenceAlert from '../components/CoherenceAlert';
import ReportEditor from '../components/ReportEditor';
import LoadingNotice from '../components/LoadingNotice';
import ExportModal from '../components/ExportModal';
import { useLanguage } from '../context/LanguageContext';

interface PatientDetailProps {
  patient: Patient;
  currentUser: User | null;
  onBack: () => void;
  onUpdatePatientState: (updatedPatient: Patient) => void;
}

export default function PatientDetail({
  patient,
  currentUser,
  onBack,
  onUpdatePatientState,
}: PatientDetailProps) {
  const { t } = useLanguage();
  const [activeSlice, setActiveSlice] = useState<number>(0);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reportText, setReportText] = useState<string>('');
  const [disclaimer, setDisclaimer] = useState<string>('');
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [isSavingReport, setIsSavingReport] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [coherenceIssues, setCoherenceIssues] = useState<CoherenceIssue[]>([]);
  const [hasMismatch, setHasMismatch] = useState<boolean>(false);

  useEffect(() => {
    setActiveSlice(0);
    setFindings([]);
    setReportText('');
    setDisclaimer('');
    setCoherenceIssues([]);
    setHasMismatch(false);
    setErrorText(null);

    if (patient.has_classification) {
      loadClassificationResults();
    }
  }, [patient.patient_id]);

  // calcolo coerenza lato client
  useEffect(() => {
    if (patient.has_classification && patient.has_report && findings.length > 0 && reportText) {
      const reportLower = reportText.toLowerCase();
      const issues = findings.map((f) => {
        const term = f.label.toLowerCase().replace(/_/g, ' ');
        const mentioned = reportLower.includes(term);
        return {
          label: f.label,
          in_findings: f.positive,
          mentioned_in_report: mentioned,
        };
      });
      setCoherenceIssues(issues);
      setHasMismatch(issues.some((i) => i.in_findings !== i.mentioned_in_report));
    } else {
      setCoherenceIssues([]);
      setHasMismatch(false);
    }
  }, [patient.has_classification, patient.has_report, findings, reportText]);

  const loadClassificationResults = async () => {
    setIsLoadingDetail(true);
    setErrorText(null);
    try {
      const classifyPromise = apiClassifyPatient(patient.patient_id, false);
      const reportPromise = patient.has_report 
        ? apiGenerateReport(patient.patient_id, false) 
        : Promise.resolve(null);
      
      const [classRes, repRes] = await Promise.all([classifyPromise, reportPromise]);
      
      setFindings(classRes.findings);
      if (repRes) {
        setReportText(repRes.report_text);
        setDisclaimer(repRes.disclaimer || 'Bozza di referto strutturata.');
      }
    } catch (err: any) {
      setErrorText(err.message || 'Errore di caricamento dei dati clinici.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleExecuteClassification = async () => {
    setIsClassifying(true);
    setErrorText(null);
    try {
      const res = await apiClassifyPatient(patient.patient_id, true);
      setFindings(res.findings);

      const updatedPat = { ...patient, has_classification: true };
      onUpdatePatientState(updatedPat);
    } catch (err: any) {
      setErrorText(err.message || 'Errore durante la classificazione.');
    } finally {
      setIsClassifying(false);
    }
  };

  const handleGenerateReportText = async () => {
    setIsGeneratingReport(true);
    setErrorText(null);
    try {
      const res = await apiGenerateReport(patient.patient_id, true);
      setReportText(res.report_text);
      setDisclaimer(res.disclaimer || 'Bozza di referto strutturata.');

      const updatedPat = { ...patient, has_report: true };
      onUpdatePatientState(updatedPat);
    } catch (err: any) {
      setErrorText(err.message || 'Errore di generazione del referto.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleSaveDraftChanges = async () => {
    if (!reportText.trim()) return;
    setIsSavingReport(true);
    setErrorText(null);
    try {
      await apiUpdateReport(patient.patient_id, reportText);
      const saveNotification = document.getElementById('save-alert-badge');
      if (saveNotification) {
        saveNotification.classList.remove('opacity-0');
        setTimeout(() => {
          saveNotification.classList.add('opacity-0');
        }, 2000);
      }
    } catch (err: any) {
      setErrorText(err.message || 'Errore durante il salvataggio.');
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleValidateReport = async () => {
    if (currentUser?.role !== 'medico') {
      setErrorText('Validazione riservata al personale medico strutturato.');
      return;
    }

    setIsValidating(true);
    setErrorText(null);
    try {
      const res = await apiValidateReport(patient.patient_id);
      const updatedPat = {
        ...patient,
        validated: true,
        validated_by: res.validated_by
      };
      onUpdatePatientState(updatedPat);
    } catch (err: any) {
      setErrorText(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleUnvalidateReport = async () => {
    if (currentUser?.role !== 'medico') {
      setErrorText('Riapertura riservata al personale medico strutturato.');
      return;
    }

    setIsValidating(true);
    setErrorText(null);
    try {
      await apiUnvalidateReport(patient.patient_id);
      const updatedPat = {
        ...patient,
        validated: false,
        validated_by: null
      };
      onUpdatePatientState(updatedPat);
    } catch (err: any) {
      setErrorText(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExportTextFile = async () => {
    try {
      const text = await apiExportReport(patient.patient_id);
      const element = document.createElement('a');
      const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = `REFERTO_NEURORAD_${patient.cognome.toUpperCase()}_CF_${patient.codice_fiscale}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err: any) {
      setErrorText(err.message || 'Impossibile esportare il file.');
    }
  };

  if (isLoadingDetail) {
    return (
      <div className="space-y-4" id="clinical-workspace-container">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition mr-1 cursor-pointer"
              title={t('detail.backTitle')}
              id="back-to-registry-detail"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 font-mono tracking-wide uppercase">
                Scheda Paziente · {patient.cognome.toUpperCase()} {patient.nome}
              </h2>
            </div>
          </div>
        </div>
        <LoadingNotice />
      </div>
    );
  }

  return (
    <div className="space-y-4" id="clinical-workspace-container">
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        patient={patient}
        reportText={reportText}
        disclaimer={disclaimer}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition mr-1 cursor-pointer"
            title={t('newPatient.back')}
            id="back-to-registry-detail"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800 font-mono tracking-wide uppercase">
                Scheda Paziente: {patient.cognome.toUpperCase()} {patient.nome}
              </h2>
              {patient.validated ? (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 uppercase tracking-wide">
                  <CheckCheck className="h-3 w-3" /> {t('detail.validatedLabel')}
                </span>
              ) : (
                <span className="bg-slate-200 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-300 uppercase tracking-wide">
                  {patient.has_report ? t('detail.draftLabel') : patient.has_classification ? t('detail.pendingReportLabel') : t('detail.toAnalyzeLabel')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              CF: <span className="font-mono font-medium text-slate-700">{patient.codice_fiscale}</span> • Data Nascita: <span className="font-mono text-slate-700">{patient.data_nascita}</span> • ID: <span className="font-mono text-slate-700">{patient.patient_id}</span>
            </p>
          </div>
        </div>

        {patient.has_report && (
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-3.5 py-1.5 rounded flex items-center justify-center gap-1.5 transition shadow-sm font-mono self-start md:self-auto tracking-wide uppercase cursor-pointer"
            id="quick-export-detail-btn"
          >
            <Download className="h-3.5 w-3.5" />
            {t('report.btnExportMain')}
          </button>
        )}
      </div>

      {errorText && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded text-xs flex items-start gap-2.5 animate-in fade-in" id="detail-workspace-error">
          <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">{t('detail.error')}</span> {errorText}
          </div>
          <button
            onClick={() => setErrorText(null)}
            className="text-[10px] font-mono text-red-400 hover:text-red-700 underline cursor-pointer"
          >
            {t('detail.hideError')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="clinical-panels-grid">
        <div className="lg:col-span-5 space-y-4" id="left-column-viewer">
          <PacsViewer
            patient={patient}
            selectedIndex={activeSlice}
            onSliceChange={(idx) => setActiveSlice(idx)}
          />

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-[11px] text-slate-500 font-sans leading-relaxed">
            <span className="font-semibold text-slate-700 block mb-1 uppercase font-mono tracking-wider">{t('detail.consultationNotes')}</span>
            {t('detail.consultationDesc')}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4" id="right-column-workflow">
          <FindingsPanel
            patient={patient}
            findings={findings}
            isClassifying={isClassifying}
            onExecute={handleExecuteClassification}
          />

          {patient.has_classification && patient.has_report && (
            <CoherenceAlert
              coherenceIssues={coherenceIssues}
              hasMismatch={hasMismatch}
            />
          )}

          <ReportEditor
            patient={patient}
            currentUser={currentUser}
            reportText={reportText}
            setReportText={setReportText}
            disclaimer={disclaimer}
            isGeneratingReport={isGeneratingReport}
            isSavingReport={isSavingReport}
            isValidating={isValidating}
            onGenerateReportText={handleGenerateReportText}
            onSaveDraftChanges={handleSaveDraftChanges}
            onExportTextFile={handleExportTextFile}
            onValidateReport={handleValidateReport}
            onUnvalidateReport={handleUnvalidateReport}
          />
        </div>
      </div>
    </div>
  );
}
