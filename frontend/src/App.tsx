import { useState, useEffect } from 'react';
import {
  setApiConfig, setTokenMemory,
  setCurrentUser, getCurrentUser, apiGetPatients, apiCreatePatient
} from './api';
import { Patient, User } from './types';
import Header from './components/Header';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewPatient from './pages/NewPatient';
import PatientDetail from './pages/PatientDetail';
import Profile from './pages/Profile';
import { ShieldAlert } from 'lucide-react';
import { useLocation, navigate } from './router';
import LoadingNotice from './components/LoadingNotice';

export default function App() {
  const [currentUser, setSessionUser] = useState<User | null>(getCurrentUser());
  const [patients, setPatients] = useState<Patient[]>([]);
  const currentPath = useLocation();

  // Leggo l'ID del paziente direttamente dall'URL tramite una regex. 
  // Così evito di gestire uno stato globale aggiuntivo, uso l'URL come fonte di verità.
  const match = currentPath.match(/^\/patients\/([^/]+)$/);
  const selectedPatientId = match ? match[1] : null;

  // Flag per gestire caricamenti ed errori nella dashboard principale
  const [isLoadingPatients, setIsLoadingPatients] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState<boolean>(false);

  const apiBaseUrl = 'http://localhost:8000';

  // Ricarico la lista dei pazienti ogni volta che loggo un utente o se cambia il baseUrl
  useEffect(() => {
    setApiConfig(apiBaseUrl);
    if (currentUser) {
      loadPatientsRegistry();
    }
  }, [apiBaseUrl, currentUser?.username]);

  // Auth guard di base: se non trovo il currentUser reindirizzo su /login,
  // se invece è loggato evito che torni su /login o /register
  useEffect(() => {
    if (!currentUser) {
      if (currentPath !== '/login' && currentPath !== '/register') {
        navigate('/login');
      }
    } else {
      if (currentPath === '/login' || currentPath === '/register' || currentPath === '/') {
        navigate('/dashboard');
      }
    }
  }, [currentUser, currentPath]);

  const loadPatientsRegistry = async () => {
    setIsLoadingPatients(true);
    setListError(null);
    try {
      const data = await apiGetPatients();
      setPatients(data);
    } catch (err: any) {
      setListError(err.message || 'Errore nel caricamento del registro pazienti.');
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setSessionUser(user);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    setTokenMemory(null);
    setCurrentUser(null);
    setSessionUser(null);
    setPatients([]);
    navigate('/login');
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
    loadPatientsRegistry(); // ricarichiamo per aggiornare i badge di stato
  };

  const handleCreateNewPatient = async (formData: FormData) => {
    setIsFormSubmitting(true);
    setListError(null);
    try {
      const created = await apiCreatePatient(formData);

      // Inserisco il nuovo paziente in cima all'array locale per evitare una nuova GET al backend
      setPatients((prev) => [created, ...prev]);

      navigate('/dashboard');
      return created;
    } catch (err: any) {
      throw new Error(err.message || 'Errore di sincronizzazione db durante la creazione del paziente.');
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleUpdatePatientItemState = (updatedPatient: Patient) => {
    setPatients((prev) =>
      prev.map((p) => p.patient_id === updatedPatient.patient_id ? updatedPatient : p)
    );
  };

  const handleUpdateUser = (updatedUser: User) => {
    setSessionUser(updatedUser);
    setCurrentUser(updatedUser);
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  // Recupero l'oggetto del paziente correntemente selezionato
  const activeSelectedPatient = patients.find((p) => p.patient_id === selectedPatientId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 antialiased font-sans">
      {/* Header clinico (sempre visibile) */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onProfileClick={handleProfileClick}
      />

      {/* Area principale di lavoro */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        {currentUser === null ? (
          currentPath === '/register' ? (
            <Register
              onLoginSuccess={handleLoginSuccess}
            />
          ) : (
            <Login
              onLoginSuccess={handleLoginSuccess}
            />
          )
        ) : isLoadingPatients ? (
          <LoadingNotice message="Sincronizzazione registro pazienti in corso..." />
        ) : (
          <div className="space-y-6 border-0">
            {/* Gestione delle viste tramite Router */}
            <div id="clinical-workspace-stage">
              {currentPath === '/dashboard' && (
                <div className="space-y-4">
                  {listError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded text-xs flex items-start gap-2.5 animate-in fade-in" id="dashboard-registry-error">
                      <ShieldAlert className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Errore Sincronizzazione Registry:</span> {listError}
                        <button
                          onClick={loadPatientsRegistry}
                          className="block mt-1 font-mono hover:underline font-semibold uppercase text-red-900"
                        >
                          Riprova caricamento
                        </button>
                      </div>
                    </div>
                  )}

                  <Dashboard
                    patients={patients}
                    currentUser={currentUser}
                    onSelectPatient={(id) => navigate(`/patients/${id}`)}
                    onOpenNewPatientForm={() => navigate('/new-patient')}
                  />
                </div>
              )}

              {currentPath === '/new-patient' && (() => {
                if (currentUser?.role !== 'medico') {
                  setTimeout(() => navigate('/dashboard'), 0);
                  return null;
                }
                return (
                  <NewPatient
                    onBack={handleBackToDashboard}
                    onSubmit={handleCreateNewPatient}
                    isSubmitting={isFormSubmitting}
                  />
                );
              })()}

              {currentPath === '/profile' && (
                <Profile
                  currentUser={currentUser}
                  onUpdateUser={handleUpdateUser}
                  onBack={handleBackToDashboard}
                />
              )}

              {currentPath.startsWith('/patients/') && (() => {
                if (activeSelectedPatient) {
                  return (
                    <PatientDetail
                      patient={activeSelectedPatient}
                      currentUser={currentUser}
                      onBack={handleBackToDashboard}
                      onUpdatePatientState={handleUpdatePatientItemState}
                    />
                  );
                }

                return (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-8 rounded text-center font-mono text-xs">
                    <ShieldAlert className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <span>ERRORE CONTESTO CLINICO: Selezionato referto inesistente o caricamento in corso...</span>
                    <button
                      onClick={handleBackToDashboard}
                      className="block mt-3 underline mx-auto text-slate-600 hover:text-slate-900 font-semibold uppercase"
                    >
                      Torna al registro pazienti
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* Footer della web app */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 text-center text-[10px] font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 Leonardo Silvestri - Progetto di Tesi Triennnale Università di Trento</span>
          <span>Paolo Giorgini, Selene, Merid</span>
        </div>
      </footer>
    </div>
  );
}
