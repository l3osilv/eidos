import React, { useState, useRef, ChangeEvent, DragEvent, FormEvent } from 'react';
import { ArrowLeft, Upload, FileImage, Trash2, AlertCircle, Check, CheckCircle } from 'lucide-react';
import { Patient } from '../types';

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
    // Controlliamo che siano effettivamente immagini
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length !== files.length) {
      setErrorMessage("Attenzione: Vengono accettati esclusivamente file immagine (es. PNG, JPG).");
    }

    // Aggiungiamo i nuovi file in coda a quelli già presenti
    setSelectedFiles((prev) => {
      const combined = [...prev, ...imageFiles];
      // Evitiamo duplicati controllando nome e dimensione
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

    // Validazione dei campi
    if (!nome.trim() || !cognome.trim() || !cf.trim() || !dataNascita) {
      setErrorMessage("Tutti i dati anagrafici del paziente sono obbligatori.");
      return;
    }

    if (cf.trim().length !== 16) {
      setErrorMessage("Errore validazione Codice Fiscale: l'identificativo deve contenere esattamente 16 caratteri alfanumerici.");
      return;
    }

    // Dobbiamo avere esattamente 8 slice per procedere
    if (selectedFiles.length !== 8) {
      setErrorMessage(`Requisito Neuroradiologico Mancante: Il sistema richiede il caricamento di esattamente 8 slice assiali consecutive in formato immagine per procedere. Al momento hai selezionato ${selectedFiles.length} file.`);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('nome', nome.trim());
      formData.append('cognome', cognome.trim());
      formData.append('codice_fiscale', cf.toUpperCase().trim());
      formData.append('data_nascita', dataNascita);
      formData.append('sesso', sesso);
      // Aggiungiamo i file al payload
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      await onSubmit(formData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore inconsueto durante la registrazione del paziente sul database.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto" id="new-patient-registry-form">
      {/* Pulsante per tornare al registro */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold mb-4 transition uppercase font-mono"
        id="btn-annulla-form"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna al Registro
      </button>

      {/* Contenitore principale del form */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-semibold text-slate-800 tracking-tight font-mono uppercase">
            Registrazione Esame TC {`&`} Anagrafica Paziente
          </h2>
          <p className="text-xs text-slate-500">
            Inserisci i dati demografici richiesti per la codifica RIS/PACS ed effettua il caricamento di esattamente 8 immagini assiali.
          </p>
        </div>

        <form onSubmit={handleSubmitForm} className="p-6 space-y-6">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded text-xs flex items-start gap-2.5 animate-in fade-in duration-205" id="form-error-alert">
              <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Errore di Registrazione:</span> {errorMessage}
              </div>
            </div>
          )}

          {/* SEZIONE 1: ANAGRAFICA */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider mb-3">
              1. Informazioni Anagrafiche (Codice Paziente)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="E.g. Lorenzo"
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  id="patient-name-input"
                />
              </div>

              {/* Cognome */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cognome</label>
                <input
                  type="text"
                  required
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  placeholder="E.g. Martini"
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  id="patient-surname-input"
                />
              </div>

              {/* Codice Fiscale */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                  <span>Codice Fiscale</span>
                  <span className="text-[10px] text-slate-400 font-mono">16 caratteri</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={cf}
                  onChange={(e) => setCf(e.target.value)}
                  placeholder="MRTLNZ55M12L219H"
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs font-mono tracking-wider text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  id="patient-cf-input"
                />
              </div>

              {/* Data di Nascita */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data di Nascita</label>
                <input
                  type="date"
                  required
                  value={dataNascita}
                  onChange={(e) => setDataNascita(e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  id="patient-birthdate-input"
                />
              </div>

              {/* Sesso */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sesso</label>
                <select
                  required
                  value={sesso}
                  onChange={(e) => setSesso(e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  id="patient-gender-input"
                >
                  <option value="">Seleziona sesso</option>
                  <option value="M">Uomo</option>
                  <option value="F">Donna</option>
                </select>
              </div>
            </div>
          </div>

          {/* SEZIONE 2: ALLEGATI (SLICE TC) */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>2. Caricamento Serie Immagini (Pacchetto Esame)</span>
            </h3>

            {/* Contatore dei file inseriti */}
            <div className={`mb-4 p-2.5 rounded text-xs flex items-center justify-between font-mono ${selectedFiles.length === 8
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-50 text-slate-500 border border-slate-250'
              }`} id="slice-counter-gauge font-mono">
              <div className="flex items-center gap-2">
                {selectedFiles.length === 8 ? (
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4.5 w-4.5 text-slate-400" />
                )}
                <span>STATO CARICAMENTO SLICES DI DIAGNOSI:</span>
              </div>
              <div className="font-semibold">
                {selectedFiles.length} / 8 FILE IMMAGINE CHE COMPONGONO IL VOLUME
              </div>
            </div>

            {/* Area drag and drop per il caricamento */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-7 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${dragActive
                  ? 'border-blue-900 bg-blue-50/15'
                  : 'border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
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
                <p className="text-xs font-semibold text-slate-700">Trascina qui le 8 immagini della TC, oppure clicca per sfogliare</p>
                <p className="text-[10px] text-slate-400 mt-1">PNG o JPG • Esattamente 8 immagini per paziente rappresentative del volume encefalico</p>
              </div>
            </div>

            {/* Elenco dei file pronti per l'invio */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 bg-slate-50 border border-slate-150 rounded" id="uploaded-files-list-panel">
                <div className="p-2 border-b border-slate-150 text-[10px] font-mono text-slate-500 flex justify-between items-center bg-slate-100">
                  <span>FILE SELEZIONATI PER COMPILARE L'ENTRY:</span>
                  <button
                    type="button"
                    onClick={clearAllFiles}
                    className="text-red-650 hover:text-red-700 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="h-3 w-3" /> Svuota lista
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
                        className="p-1 hover:bg-red-55 text-red-500 rounded transition"
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

          {/* Pulsanti di azione a fondo pagina */}
          <div className="border-t border-slate-100 pt-5 flex items-center justify-between" id="form-action-footer">
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition disabled:opacity-50"
              id="form-btn-annulla"
            >
              ANNULLA
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-5 py-2 rounded flex items-center gap-1.5 transition disabled:opacity-50 font-mono tracking-wide shadow-sm`}
              id="form-btn-submit"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                  CARICAMENTO IN CORSO...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  REGISTRA E ARCHIVIA IN PATIENTS DB
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
