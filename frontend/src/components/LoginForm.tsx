import React, { useState } from 'react';
import { Lock, User as UserIcon, ShieldAlert, ShieldCheck } from 'lucide-react';
import { apiLogin, apiRegister, setTokenMemory, setCurrentUser } from '../api';
import { Role, User } from '../types';
import { navigate } from '../router';
import eidosLogo from '../assets/eidos.svg';

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
  isRegister?: boolean;
}

export default function LoginForm({
  onLoginSuccess,
  isRegister = false,
}: LoginFormProps) {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('medico');
  const [gender, setGender] = useState<'M' | 'F'>('M');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regSuccessMessage, setRegSuccessMessage] = useState<string | null>(null);

  const generateUsername = (n: string, c: string) => `${n.trim()}${c.trim()}`.toLowerCase().replace(/\s+/g, '');

  const handleNomeChange = (val: string) => {
    setNome(val);
    setUsername(generateUsername(val, cognome));
  };

  const handleCognomeChange = (val: string) => {
    setCognome(val);
    setUsername(generateUsername(nome, val));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRegSuccessMessage(null);
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('username', username.trim());
      params.append('password', password);

      const res = await apiLogin(params);

      setTokenMemory(res.access_token);

      const loggedUser: User = {
        username: res.username,
        nome: res.nome,
        cognome: res.cognome,
        role: res.role,
        gender: res.gender,
        avatar: res.avatar,
      };

      setCurrentUser(loggedUser);
      onLoginSuccess(loggedUser);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore di autenticazione. Verificare le credenziali.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRegSuccessMessage(null);
    setLoading(true);

    try {
      const payload = {
        username,
        password,
        nome: nome.trim(),
        cognome: cognome.trim(),
        role,
        gender,
      };

      await apiRegister(payload);
      navigate('/login?registered=true');
      setPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || "Impossibile registrare l'account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12" id="clinical-login-screen">
      <div className="text-center mb-6">
        <img src={eidosLogo} alt="Eidos Logo" className="h-12 w-12 mx-auto mb-3" />
        <h2 className="text-sm font-extrabold text-blue-900 tracking-wider font-mono uppercase">
          Portale NeuroReport Clinico
        </h2>
        <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono tracking-widest font-semibold">
          Clinica Neuroradiologica • Accesso RIS / PACS
        </p>
      </div>

      <div className="bg-white border border-slate-205 rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-150 bg-slate-50">
          <button
            onClick={() => {
              navigate('/login');
              setErrorMessage(null);
              setRegSuccessMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-bold font-mono uppercase border-r border-slate-150 transition ${!isRegister
              ? 'bg-white text-blue-950 border-t-2 border-t-blue-900'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Accedi al Portale
          </button>
          <button
            onClick={() => {
              navigate('/register');
              setErrorMessage(null);
              setRegSuccessMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-bold font-mono uppercase transition ${isRegister
              ? 'bg-white text-blue-950 border-t-2 border-t-blue-900'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Crea Nuovo Account
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-xs flex gap-2 items-start" id="login-error-alert">
              <ShieldAlert className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
              <p className="font-semibold text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {(regSuccessMessage || window.location.search.includes('registered=true')) && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded text-xs flex gap-2 items-start animate-fade-in" id="login-reg-success">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-semibold text-[11px] leading-relaxed">
                {regSuccessMessage || "Registrazione completata con successo! Inserisci le tue credenziali per accedere."}
              </p>
            </div>
          )}

          <form onSubmit={isRegister ? handleRegisterSubmit : handleLoginSubmit} className="space-y-4 outline-none">
            {isRegister && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nome</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <UserIcon className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => handleNomeChange(e.target.value)}
                      placeholder="Mario"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      id="register-nome-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cognome</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <UserIcon className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={cognome}
                      onChange={(e) => handleCognomeChange(e.target.value)}
                      placeholder="Rossi"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      id="register-cognome-input"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 font-mono uppercase tracking-wide">
                {isRegister ? 'Username (Generato Automaticamente)' : 'Username'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-mono">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => !isRegister && setUsername(e.target.value)}
                  readOnly={isRegister}
                  placeholder={isRegister ? "mariorossi (automatico)" : "E.g. mariorossi"}
                  className={`w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded text-slate-800 focus:outline-none font-mono ${
                    isRegister ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-dashed' : 'bg-white focus:ring-1 focus:ring-blue-500'
                  }`}
                  id="login-username-input"
                />
              </div>
              {isRegister && (
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  L'username viene generato concatenando Nome e Cognome in minuscolo.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 font-mono uppercase tracking-wide">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  id="login-password-input"
                />
              </div>
            </div>

            {isRegister && (
              <>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 font-mono">RUOLO SANITARIO</label>
                  <div className="flex gap-2.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="role-radio"
                        checked={role === 'medico'}
                        onChange={() => setRole('medico')}
                        className="text-blue-900 focus:ring-blue-800"
                      />
                      <span className="font-medium">Medico Strutturato</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="role-radio"
                        checked={role === 'specializzando'}
                        onChange={() => setRole('specializzando')}
                        className="text-blue-900 focus:ring-blue-800"
                      />
                      <span className="font-medium">Specializzando</span>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 font-mono">SESSO</label>
                  <div className="flex gap-2.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="gender-radio"
                        checked={gender === 'M'}
                        onChange={() => setGender('M')}
                        className="text-blue-900 focus:ring-blue-800"
                      />
                      <span className="font-medium">Maschio</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="gender-radio"
                        checked={gender === 'F'}
                        onChange={() => setGender('F')}
                        className="text-blue-900 focus:ring-blue-800"
                      />
                      <span className="font-medium">Femmina</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-900 hover:bg-blue-950 text-white font-mono text-xs font-bold py-2.5 px-4 rounded transition flex justify-center items-center shadow-sm uppercase tracking-wider"
              id="btn-submit-credentials"
            >
              {loading ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                  AUTENTICAZIONE IN CORSO...
                </>
              ) : (
                isRegister ? 'Registra Account' : 'Accedi'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
