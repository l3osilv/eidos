import { Loader2, Activity } from 'lucide-react';

interface LoadingNoticeProps {
  message?: string;
}

export default function LoadingNotice({ message = 'Caricamento in corso...' }: LoadingNoticeProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-white border border-slate-200 rounded-xl shadow-sm text-center animate-in fade-in duration-300">
      {/* Container dell'animazione scanner TC */}
      <div className="relative flex items-center justify-center w-24 h-24 mb-6">
        {/* Cerchio rotante esterno dello scanner TC */}
        <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-blue-900 border-r-blue-900/30 animate-spin duration-1000"></div>
        
        {/* Cerchio interno pulsante */}
        <div className="absolute w-16 h-16 rounded-full bg-blue-50/60 border border-blue-100 flex items-center justify-center animate-pulse">
          <Activity className="h-7 w-7 text-blue-900 animate-pulse" />
        </div>

        {/* Effetto raggio di scansione orizzontale */}
        <div className="absolute w-20 h-0.5 bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.8)] rounded-full animate-bounce mt-1"></div>
      </div>

      {/* Messaggio e dettagli */}
      <h3 className="text-sm font-semibold text-slate-800 tracking-wide uppercase font-mono mb-2 flex items-center gap-2 justify-center">
        <Loader2 className="h-4 w-4 text-blue-950 animate-spin" />
        {message}
      </h3>
      
      <p className="text-xs text-slate-450 text-slate-500 max-w-sm leading-relaxed">
        Sincronizzazione in corso con il server e la rete PACS. L'interazione con le sezioni cliniche è momentaneamente sospesa.
      </p>

      {/* Barra di progresso simulata a puntini */}
      <div className="flex items-center gap-1.5 mt-5">
        <span className="w-2 h-2 rounded-full bg-blue-900 animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-2 h-2 rounded-full bg-blue-900/70 animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-2 h-2 rounded-full bg-blue-900/40 animate-bounce"></span>
      </div>
    </div>
  );
}
