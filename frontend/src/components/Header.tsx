
import { Activity, LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../types';

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


  return (
    <header className="bg-white text-slate-800 border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between" id="clinical-header-container">
        {/* Nome del software e logo */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-900 w-8 h-8 rounded-md flex items-center justify-center text-white shadow-sm shrink-0">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-blue-900 tracking-tight flex items-center gap-2">
              MedicinAI
            </h1>
            <p className="text-[9px] text-slate-400 tracking-wider font-semibold uppercase">UniTN-SSL-BrainCT-Pathology</p>
          </div>
        </div>

        {/* Dettagli dell'utente loggato */}
        <div className="flex items-center gap-4">
          {currentUser && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200" id="user-info-section">
              <button
                onClick={onProfileClick}
                className="flex items-center gap-3 text-left hover:opacity-85 transition cursor-pointer group"
                title="Gestisci Profilo Medico"
                id="header-profile-trigger-btn"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-850 text-slate-800 group-hover:text-blue-900 transition">
                    {currentUser.gender === 'M' ? 'Dr.' : 'Dr.ssa'} {currentUser.cognome}
                  </p>
                  <div className="flex justify-end gap-1.5 mt-0.5">
                    {currentUser.role === 'medico' ? (
                      <span className="bg-blue-50 text-blue-700 text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border border-blue-200">
                        Medico
                      </span>
                    ) : (
                      <span className="bg-slate-50 text-slate-600 text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border border-slate-250">
                        Specializzando
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

              {/* Logout */}
              <button
                onClick={onLogout}
                className="p-1.5 hover:bg-red-50 hover:text-red-650 rounded text-slate-400 transition cursor-pointer"
                title="Sconnetti Sessione"
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
