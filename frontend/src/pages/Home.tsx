import { ArrowRight, BrainCircuit, FileText, ShieldCheck, UserRound } from 'lucide-react';
import { navigate } from '../router';
import eidosLogo from '../assets/eidos.svg';
import { useLanguage } from '../context/LanguageContext';

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="max-w-2xl mx-auto my-12 px-4" id="home-entrypoint">

      {/* Header / Logo */}
      <div className="text-center mb-10">
        <img src={eidosLogo} alt="Eidos Logo" className="w-16 h-16 mx-auto mb-4" />
        <h1 className="text-2xl font-extrabold text-blue-900 tracking-tight">Eidos</h1>
        <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono tracking-widest font-semibold">
          {t('home.tagline')}
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="bg-blue-50 border border-blue-100 p-2 rounded inline-flex mb-3">
            <BrainCircuit className="h-4.5 w-4.5 text-blue-700" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono mb-1">{t('home.feat1.title')}</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {t('home.feat1.desc')}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="bg-blue-50 border border-blue-100 p-2 rounded inline-flex mb-3">
            <FileText className="h-4.5 w-4.5 text-blue-700" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono mb-1">{t('home.feat2.title')}</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {t('home.feat2.desc')}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="bg-blue-50 border border-blue-100 p-2 rounded inline-flex mb-3">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-700" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono mb-1">{t('home.feat3.title')}</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {t('home.feat3.desc')}
          </p>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50 px-4 py-3 items-center gap-2">
          <UserRound className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">
            {t('home.portalAccess')}
          </span>
        </div>
        <div className="p-5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/login')}
            className="flex-1 bg-blue-900 hover:bg-blue-950 text-white font-mono text-xs font-bold py-2.5 px-4 rounded transition flex justify-center items-center gap-2 shadow-sm uppercase tracking-wider cursor-pointer"
            id="home-btn-login"
          >
            {t('home.btnLogin')}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => navigate('/register')}
            className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-mono text-xs font-bold py-2.5 px-4 rounded transition flex justify-center items-center gap-2 uppercase tracking-wider cursor-pointer"
            id="home-btn-register"
          >
            {t('home.btnRegister')}
          </button>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-[10px] font-mono text-slate-400 tracking-wide mt-8">
        {t('home.footer')} · {new Date().getFullYear()}
      </p>
    </div>
  );
}

