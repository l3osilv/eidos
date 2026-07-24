import { LogOut, User as UserIcon, Globe } from 'lucide-react';
import { User } from '../types';
import eidosLogo from '../assets/eidos.svg';
import { useLanguage } from '../context/LanguageContext';

interface ClinicalHeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onProfileClick: () => void;
}

export default function Header({
  currentUser,
  onLogout,
  onProfileClick,
}: ClinicalHeaderProps) {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="bg-white text-slate-800 border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between" id="clinical-header-container">
        {/* Titolo applicazione */}
        <div className="flex items-center gap-3">
          <img src={eidosLogo} alt="Eidos Logo" className="w-8 h-8 shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-blue-900 tracking-tight flex items-center gap-2">
              Eidos
            </h1>
            <p className="text-[9px] text-slate-400 tracking-wider font-semibold uppercase">{t('header.subtitle')}</p>
          </div>
        </div>

        {/* Area utente & Selettore lingua */}
        <div className="flex items-center gap-3">
          {/* Selettore Lingua ITA / EN con bandierine */}
          <div
            id="language-switcher"
            className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs font-mono select-none"
            title="Seleziona Lingua / Select Language"
          >
            <Globe className="h-3.5 w-3.5 text-slate-400 ml-1.5 mr-1" />
            <button
              onClick={() => setLang('ita')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition cursor-pointer flex items-center gap-1 ${
                lang === 'ita'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🇮🇹</span> ITA
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition cursor-pointer flex items-center gap-1 ${
                lang === 'en'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🇬🇧</span> EN
            </button>
          </div>

          {currentUser && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200" id="user-info-section">
              <button
                onClick={onProfileClick}
                className="flex items-center gap-3 text-left hover:opacity-85 transition cursor-pointer group"
                title={t('header.profile')}
                id="header-profile-trigger-btn"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-900 transition">
                    {currentUser.gender === 'M' ? 'Dr.' : 'Dr.ssa'} {currentUser.cognome}
                  </p>
                  <div className="flex justify-end gap-1.5 mt-0.5">
                    {currentUser.role === 'medico' ? (
                      <span className="bg-blue-50 text-blue-700 text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border border-blue-200">
                        {t('header.role.medico')}
                      </span>
                    ) : (
                      <span className="bg-slate-50 text-slate-600 text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border border-slate-250">
                        {t('header.role.specializzando')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="h-4.5 w-4.5 text-slate-500" />
                  )}
                </div>
              </button>

              <button
                onClick={onLogout}
                className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-400 transition cursor-pointer"
                title={t('header.logout')}
                id="header-logout-btn"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

