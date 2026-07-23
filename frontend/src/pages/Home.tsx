import { ArrowRight, BrainCircuit, FileText, ShieldCheck, UserRound } from 'lucide-react';
import { navigate } from '../router';
import eidosLogo from '../assets/eidos.svg';

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto my-12 px-4" id="home-entrypoint">

      {/* Header / Logo */}
      <div className="text-center mb-10">
        <img src={eidosLogo} alt="Eidos Logo" className="w-16 h-16 mx-auto mb-4" />
        <h1 className="text-2xl font-extrabold text-blue-900 tracking-tight">Eidos</h1>
        <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono tracking-widest font-semibold">
          Sistema di Supporto alla Refertazione Neuroradiologica
        </p>
      </div>

      {/* Intro Card */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
        <p className="text-sm text-slate-600 leading-relaxed">
          Eidos è un sistema di supporto clinico progettato per assistere radiologi e specializzandi
          nell'analisi delle <strong className="text-slate-800">TC dell'encefalo</strong>.
          Integra modelli di deep learning per la classificazione delle patologie e la generazione
          automatica di bozze di referto.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="bg-blue-50 border border-blue-100 p-2 rounded inline-flex mb-3">
            <BrainCircuit className="h-4.5 w-4.5 text-blue-700" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono mb-1">Classificazione IA</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Analisi automatica di 4 patologie: sangue, ischemia, edema, effetto massa.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="bg-blue-50 border border-blue-100 p-2 rounded inline-flex mb-3">
            <FileText className="h-4.5 w-4.5 text-blue-700" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono mb-1">Referto Assistito</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Bozze di referti generate automaticamente, editabili e validabili dal medico.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="bg-blue-50 border border-blue-100 p-2 rounded inline-flex mb-3">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-700" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono mb-1">Ruoli e Sicurezza</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Accesso differenziato per medici strutturati e specializzandi con validazione.
          </p>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50 px-4 py-3 items-center gap-2">
          <UserRound className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">
            Accesso al Portale
          </span>
        </div>
        <div className="p-5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/login')}
            className="flex-1 bg-blue-900 hover:bg-blue-950 text-white font-mono text-xs font-bold py-2.5 px-4 rounded transition flex justify-center items-center gap-2 shadow-sm uppercase tracking-wider"
            id="home-btn-login"
          >
            Accedi
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => navigate('/register')}
            className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-mono text-xs font-bold py-2.5 px-4 rounded transition flex justify-center items-center gap-2 uppercase tracking-wider"
            id="home-btn-register"
          >
            Crea Account
          </button>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-[10px] font-mono text-slate-400 tracking-wide mt-8">
        Progetto di Tesi Triennale · Università di Trento · {new Date().getFullYear()}
      </p>
    </div>
  );
}
