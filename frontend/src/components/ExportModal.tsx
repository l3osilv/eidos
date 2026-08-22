import React, { useState, useEffect } from 'react';
import { X, Download, FileType, FileText } from 'lucide-react';
import { Patient } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { jsPDF } from 'jspdf';
import { apiExportReport } from '../api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  reportText: string;
  disclaimer: string;
}

export default function ExportModal({
  isOpen,
  onClose,
  patient,
  reportText,
  disclaimer,
}: ExportModalProps) {
  const { t } = useLanguage();
  const [format, setFormat] = useState<'pdf' | 'txt'>('pdf');
  const [filename, setFilename] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (patient) {
      const defaultName = `REFERTO_NEURORAD_${(patient.cognome || 'ANONIMO').toUpperCase()}_CF_${patient.codice_fiscale || 'ANONIMO'}`;
      setFilename(defaultName);
    }
  }, [patient]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const cleanName = filename.trim() || 'REFERTO_NEURORAD';

      if (format === 'txt') {
        const textContent = await apiExportReport(patient.patient_id).catch(() => reportText);
        const element = document.createElement('a');
        const file = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        element.href = URL.createObjectURL(file);
        element.download = cleanName.endsWith('.txt') ? cleanName : `${cleanName}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      } else {
        const doc = new jsPDF();

        // intestazione
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("EIDOS — SISTEMA DI SUPPORTO IN NEURORADIOLOGIA", 14, 20);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`ID PAZIENTE: ${patient.patient_id}`, 14, 28);
        doc.text(`PAZIENTE: ${(patient.cognome || '').toUpperCase()} ${patient.nome} (CF: ${patient.codice_fiscale})`, 14, 34);
        doc.text(`DATA NASCITA: ${patient.data_nascita}  |  SESSO: ${patient.gender}`, 14, 40);
        doc.text(`DATA CARICAMENTO: ${new Date(patient.created_at).toLocaleDateString('it-IT')}`, 14, 46);

        doc.setLineWidth(0.5);
        doc.line(14, 50, 196, 50);

        // titolo
        doc.setFont("times", "bold");
        doc.setFontSize(13);
        doc.text("REFERTO DI ESAME TC ENCEFALO", 105, 60, { align: "center" });

        // corpo del testo
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        const splitText = doc.splitTextToSize(reportText, 180);
        doc.text(splitText, 14, 72);

        let currentY = 72 + (splitText.length * 6) + 10;

        // avvertenza clinica
        if (disclaimer) {
          if (currentY > 250) {
            doc.addPage();
            currentY = 20;
          }
          doc.setFont("helvetica", "italic");
          doc.setFontSize(9);
          const splitDisc = doc.splitTextToSize(`NOTA / DISCLAIMER: ${disclaimer}`, 180);
          doc.text(splitDisc, 14, currentY);
          currentY += (splitDisc.length * 5) + 10;
        }

        // firma di validazione
        if (patient.validated) {
          if (currentY > 250) {
            doc.addPage();
            currentY = 20;
          }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("REFERTO VALIDATO E FIRMATO DIGITALMENTE", 14, currentY);
          doc.setFont("helvetica", "normal");
          doc.text(`Firmato da: ${patient.validated_by || 'Medico Strutturato'}`, 14, currentY + 6);
        }

        // numerazione pagina
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(`Pagina ${i} di ${pageCount}`, 196, 285, { align: "right" });
        }

        const pdfName = cleanName.endsWith('.pdf') ? cleanName : `${cleanName}.pdf`;
        doc.save(pdfName);
      }

      onClose();
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in" id="export-modal-backdrop">
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full overflow-hidden" id="export-modal-dialog">
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="h-4.5 w-4.5 text-blue-900" />
            <h3 className="text-sm font-bold text-slate-800 font-mono uppercase tracking-wide">
              {t('exportModal.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition cursor-pointer"
            id="btn-close-export-modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Formato Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider mb-2">
              {t('exportModal.formatLabel')}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3 rounded-lg border text-left flex items-center gap-3 transition cursor-pointer ${
                  format === 'pdf'
                    ? 'border-blue-900 bg-blue-50/30 text-blue-950 ring-1 ring-blue-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
                id="export-format-pdf"
              >
                <FileType className={`h-6 w-6 ${format === 'pdf' ? 'text-red-700' : 'text-slate-400'}`} />
                <div>
                  <div className="text-xs font-bold font-mono">Documento PDF</div>
                  <div className="text-[10px] text-slate-400 font-sans">Formattato con intestazione e firma</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('txt')}
                className={`p-3 rounded-lg border text-left flex items-center gap-3 transition cursor-pointer ${
                  format === 'txt'
                    ? 'border-blue-900 bg-blue-50/30 text-blue-950 ring-1 ring-blue-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
                id="export-format-txt"
              >
                <FileText className={`h-6 w-6 ${format === 'txt' ? 'text-blue-800' : 'text-slate-400'}`} />
                <div>
                  <div className="text-xs font-bold font-mono">Testo TXT</div>
                  <div className="text-[10px] text-slate-400 font-sans">Testo semplice .txt</div>
                </div>
              </button>
            </div>
          </div>

          {/* Nome File Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider mb-1.5 flex justify-between items-center">
              <span>{t('exportModal.filenameLabel')}</span>
              <span className="text-[10px] text-slate-400 font-mono">.{format}</span>
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Inserisci il nome del file..."
              className="w-full border border-slate-200 rounded px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="export-filename-input"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer uppercase font-mono"
            id="export-cancel-btn"
          >
            {t('exportModal.cancel')}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-4 py-1.5 rounded flex items-center gap-1.5 transition shadow-sm uppercase font-mono tracking-wide cursor-pointer disabled:opacity-50"
            id="export-download-btn"
          >
            {isExporting ? (
              <>
                <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                {t('exportModal.exporting')}
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                {t('exportModal.download')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
