import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Activity } from 'lucide-react';
import { Patient } from '../types';
import { apiGetSliceImage } from '../api';

interface PacsViewerProps {
  patient: Patient;
  selectedIndex: number;
  onSliceChange: (index: number) => void;
}

export default function PacsViewer({
  patient,
  selectedIndex,
  onSliceChange,
}: PacsViewerProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Rifaccio la fetch quando cambia la slice o il paziente.
  // Uso il flag 'active' per evitare aggiornamenti di stato se il componente viene smontato prima della fine.
  useEffect(() => {
    let active = true;
    let oldUrl = imageUrl;

    setLoading(true);
    setErrorStatus(null);

    async function loadSlice() {
      try {
        const src = await apiGetSliceImage(patient.patient_id, selectedIndex);
        if (active) {
          setImageUrl(src);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setErrorStatus(err.message || 'Errore di caricamento binario PACS slice.');
          setLoading(false);
        }
      }
    }

    loadSlice();

    return () => {
      active = false;
      // Rilascio il blob URL precedente per prevenire memory leak nel browser
      if (oldUrl.startsWith('blob:')) {
        URL.revokeObjectURL(oldUrl);
      }
    };
  }, [patient.patient_id, selectedIndex]);

  const handlePrev = () => {
    onSliceChange(selectedIndex === 0 ? 7 : selectedIndex - 1);
  };

  const handleNext = () => {
    onSliceChange((selectedIndex + 1) % 8);
  };

  // Carico in parallelo tutte le miniature in basso.
  // Aggiungo has_classification alle dipendenze così ricarico i file aggiornati se il backend calcola nuovi risultati.
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);
  useEffect(() => {
    Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        apiGetSliceImage(patient.patient_id, i).catch(() => '')
      )
    ).then(setThumbUrls);
  }, [patient.patient_id, patient.has_classification]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col p-4 shadow-xl" id="clinical-pacs-viewer">
      {/* Controlli dell'header del visualizzatore PACS */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400 text-xs mb-3 font-mono">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-200">RIS/PACS AXIAL SLICE VIEWER</span>
        </div>
      </div>

      {/* Schermata principale dell'immagine */}
      <div className="relative aspect-square w-full max-w-sm mx-auto bg-slate-900 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center group" id="pacs-main-stage">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950" id="pacs-skeleton-screen">
            <RefreshCw className="h-8 w-8 text-sky-550 animate-spin text-sky-400" />
            <span className="text-xs font-mono text-slate-400 tracking-wider">CARICAMENTO SLICE TC DA ARCHIVIO...</span>
          </div>
        ) : errorStatus ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-2 bg-slate-950" id="pacs-error-screen">
            <AlertTriangle className="h-10 w-10 text-red-500" />
            <span className="text-xs font-mono text-slate-300 font-semibold">ERRORE CARICAMENTO IMMAGINE</span>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">{errorStatus}</p>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={`Slice ${selectedIndex + 1}`}
            className="w-full h-full object-contain select-none"
            referrerPolicy="no-referrer"
            id={`pacs-active-ct-image-${selectedIndex}`}
          />
        )}

        {/* Indicatori grafici in sovrimpressione */}
        {!loading && !errorStatus && (
          <>
            {/* Pulsante per andare indietro di una slice */}
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 opacity-0 group-hover:opacity-100 transition duration-150"
              title="Slice Precedente (Assiale)"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Pulsante per andare avanti di una slice */}
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 opacity-0 group-hover:opacity-100 transition duration-150"
              title="Slice Successiva (Assiale)"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Badge centrale con l'indice della slice */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>SLICE {selectedIndex + 1} / 8</span>
            </div>
          </>
        )}
      </div>

      {/* Barra delle miniature in basso */}
      <div className="mt-4" id="pacs-thumbnails-strip">
        <label className="block text-[10px] font-semibold font-mono text-slate-500 uppercase tracking-wider mb-2">
          FILMSTRIP DI NAVIGAZIONE ASSIALE (CORRIERI TC):
        </label>

        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: 8 }).map((_, idx) => {
            const isCurrent = idx === selectedIndex;
            const thumbSrc = thumbUrls[idx];
            return (
              <button
                key={idx}
                onClick={() => {
                  onSliceChange(idx);
                }}
                className={`relative aspect-square bg-slate-900 border rounded overflow-hidden select-none transition ${isCurrent
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-slate-800 hover:border-slate-600'
                  }`}
                title={`Vedi Slice ${idx + 1}`}
                id={`thumb-slice-picker-${idx}`}
              >
                {thumbSrc ? (
                  <img src={thumbSrc} alt={`Thumb ${idx}`} className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[9px] font-mono text-slate-600">
                    S{idx + 1}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 bg-slate-950/75 border-l border-t border-slate-800 text-[8px] font-mono px-1 py-0 text-slate-400">
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
