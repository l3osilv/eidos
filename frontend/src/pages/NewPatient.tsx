import React, { useState, useRef, ChangeEvent, DragEvent, FormEvent } from 'react';
import { ArrowLeft, Upload, FileImage, Trash2, AlertCircle, Check, CheckCircle, ShieldCheck } from 'lucide-react';
import { Patient } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface NewPatientProps {
  onBack: () => void;
  onSubmit: (formData: FormData) => Promise<Patient>;
  isSubmitting: boolean;
}

export default function NewPatient({
  onBack,
  onSubmit,
  isSubmitting,
}: NewPatientProps) {
  const { t } = useLanguage();
  const [isAnonymized, setIsAnonymized] = useState(false);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [cf, setCf] = useState('');
  const [dataNascita, setDataNascita] = useState('');
  const [sesso, setSesso] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMessage(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files) as File[];
      addFiles(filesArray);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      addFiles(filesArray);
    }
  };

  const addFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length !== files.length) {
      setErrorMessage("Attenzione: Vengono accettati esclusivamente file immagine (es. PNG, JPG).");
    }

    setSelectedFiles((prev) => {
      const combined = [...prev, ...imageFiles];
      const unique = combined.filter((v, i, a) => a.findIndex(t => t.name === v.name && t.size === v.size) === i);
      return unique;
    });
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
  };

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isAnonymized) {
      if (!nome.trim() || !cognome.trim() || !cf.trim() || !dataNascita) {
        setErrorMessage("Tutti i dati anagrafici del paziente sono obbligatori (oppure attiva l'opzione Anonimizza).");
        return;
      }

      if (cf.trim().length !== 16) {
        setErrorMessage("Il Codice Fiscale deve contenere esattamente 16 caratteri.");
        return;
      }
    }

    if (selectedFiles.length !== 8) {
      setErrorMessage(`È necessario selezionare esattamente 8 immagini TC. Attualmente ne hai selezionate ${selectedFiles.length}.`);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('nome', isAnonymized ? 'ANONIMO' : nome.trim());
      formData.append('cognome', isAnonymized ? 'ANONIMO' : cognome.trim());
      formData.append('codice_fiscale', isAnonymized ? 'ANONIMO000000000' : cf.toUpperCase().trim());
      formData.append('data_nascita', isAnonymized ? (dataNascita || '1900-01-01') : dataNascita);
      formData.append('gender', sesso || 'M');

      const sortedFiles = [...selectedFiles].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      sortedFiles.forEach((file) => {
        formData.append('files', file);
      });

      await onSubmit(formData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante la registrazione del paziente.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto" id="new-patient-registry-form">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold mb-4 transition uppercase font-mono cursor-pointer"
        id="btn-annulla-form"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('newPatient.back')}
      </button>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-semibold text-slate-800 tracking-tight font-mono uppercase">
            {t('newPatient.title')}
          </h2>
          <p className="text-xs text-slate-500">
            {t('newPatient.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmitForm} className="p-6 space-y-6">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded text-xs flex items-start gap-2.5 animate-in fade-in duration-200" id="form-error-alert">
              <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Errore di Registrazione:</span> {errorMessage}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider">
                {t('newPatient.sec1')}
              </h3>

              {/* Toggle Anonimizza */}
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded border border-slate-200 transition">
                <input
                  type="checkbox"
                  id="anonymize-toggle"
                  checked={isAnonymized}
                  onChange={(e) => setIsAnonymized(e.target.checked)}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-slate-700 select-none">
                  {t('newPatient.anonymize.label')}
                </span>
              </label>
            </div>

            {isAnonymized && (
              <div className="bg-blue-50/60 border border-blue-200 text-blue-800 p-2.5 rounded text-xs mb-4 flex items-center gap-2 animate-in fade-in">
                <ShieldCheck className="h-4 w-4 text-blue-700 shrink-0" />
                <span className="font-mono text-[11px] font-semibold">
                  {t('newPatient.anonymize.activeBadge')}: {t('newPatient.anonymize.desc')}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('newPatient.name')}</label>
                <input
                  type="text"
                  required={!isAnonymized}
                  disabled={isAnonymized}
                  value={isAnonymized ? 'ANONIMO' : nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="E.g. Lorenzo"
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  id="patient-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('newPatient.surname')}</label>
                <input
                  type="text"
                  required={!isAnonymized}
                  disabled={isAnonymized}
                  value={isAnonymized ? 'ANONIMO' : cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  placeholder="E.g. Martini"
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  id="patient-surname-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                  <span>{t('newPatient.fiscalCode')}</span>
                  <span className="text-[10px] text-slate-400 font-mono">16 caratteri</span>
                </label>
                <input
                  type="text"
                  required={!isAnonymized}
                  disabled={isAnonymized}
                  maxLength={16}
                  value={isAnonymized ? 'ANONIMO000000000' : cf}
                  onChange={(e) => setCf(e.target.value)}
                  placeholder="MRTLNZ55M12L219H"
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono tracking-wider text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 uppercase disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  id="patient-cf-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('newPatient.birthdate')}</label>
                <input
                  type="date"
                  required={!isAnonymized}
                  disabled={isAnonymized}
                  value={isAnonymized ? '' : dataNascita}
                  onChange={(e) => setDataNascita(e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  id="patient-birthdate-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('newPatient.gender')}</label>
                <select
                  value={sesso}
                  onChange={(e) => setSesso(e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  id="patient-gender-input"
                >
                  <option value="">{t('newPatient.gender.select')}</option>
                  <option value="M">{t('newPatient.gender.male')}</option>
                  <option value="F">{t('newPatient.gender.female')}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>{t('newPatient.sec2')}</span>
            </h3>

            <div className={`mb-4 p-2.5 rounded text-xs flex items-center justify-between font-mono ${selectedFiles.length === 8
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`} id="slice-counter-gauge font-mono">
              <div className="flex items-center gap-2">
                {selectedFiles.length === 8 ? (
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4.5 w-4.5 text-slate-400" />
                )}
                <span>{t('newPatient.sliceGauge')}</span>
              </div>
              <div className="font-semibold">
                {selectedFiles.length} / 8 {t('newPatient.slicesOf8')}
              </div>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-7 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${dragActive
                  ? 'border-blue-900 bg-blue-50/15'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
                }`}
              id="file-drop-zone"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="files-input-uploader"
              />
              <Upload className="h-7 w-7 text-slate-400" />
              <div>
                <p className="text-xs font-semibold text-slate-700">{t('newPatient.dropInstructions')}</p>
                <p className="text-[10px] text-slate-400 mt-1">{t('newPatient.dropFormat')}</p>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4 bg-slate-50 border border-slate-150 rounded" id="uploaded-files-list-panel">
                <div className="p-2 border-b border-slate-150 text-[10px] font-mono text-slate-550 flex justify-between items-center bg-slate-100">
                  <span>{t('newPatient.selectedFiles')}</span>
                  <button
                    type="button"
                    onClick={clearAllFiles}
                    className="text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" /> {t('newPatient.clearList')}
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="p-2 flex items-center justify-between text-xs text-slate-600 bg-white hover:bg-slate-50/40">
                      <div className="flex items-center gap-2 truncate">
                        <FileImage className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-[11px] font-medium text-slate-800 truncate" title={file.name}>{file.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1 hover:bg-red-50 text-red-500 rounded transition cursor-pointer"
                        title="Rimuovi questo file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-5 flex items-center justify-between" id="form-action-footer">
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition disabled:opacity-50 cursor-pointer"
              id="form-btn-annulla"
            >
              {t('newPatient.cancel')}
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-5 py-2 rounded flex items-center gap-1.5 transition disabled:opacity-50 font-mono tracking-wide shadow-sm cursor-pointer"
              id="form-btn-submit"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                  {t('newPatient.submitting')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t('newPatient.submit')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
