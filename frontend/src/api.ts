import { Patient, ClassificationResponse, ReportResponse, CoherenceResponse, User, AuthResponse } from './types';

// Salvo il token e l'utente corrente sia in RAM che nel localStorage.
// Il localStorage mi serve per non perdere la sessione se l'utente ricarica la pagina,
// ma leggere dalle variabili in memoria è più veloce durante il render di React.
let tokenMemory: string | null = localStorage.getItem('tokenMemory');
let currentSessionUser: User | null = (() => {
  try {
    const stored = localStorage.getItem('currentSessionUser');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
})();

// URL base del backend: imposto localhost di default per i test locali
let baseApiUrl = 'http://localhost:8000';

export function setApiConfig(baseUrl: string) {
  baseApiUrl = baseUrl || 'http://localhost:8000';
}

export function setTokenMemory(token: string | null) {
  tokenMemory = token;
  if (token) {
    localStorage.setItem('tokenMemory', token);
  } else {
    localStorage.removeItem('tokenMemory');
  }
}

export function getTokenMemory(): string | null {
  return tokenMemory;
}

export function setCurrentUser(user: User | null) {
  currentSessionUser = user;
  if (user) {
    localStorage.setItem('currentSessionUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('currentSessionUser');
  }
}

export function getCurrentUser(): User | null {
  return currentSessionUser;
}

// ---------------------------------------------------------------------------
// Helper custom per non dover ripetere in ogni fetch l'header auth e il controllo degli errori
// ---------------------------------------------------------------------------

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${baseApiUrl}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(tokenMemory ? { Authorization: `Bearer ${tokenMemory}` } : {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Sessione scaduta o non autorizzata. Effettuare nuovamente il login.');
    if (response.status === 403) throw new Error('Accesso negato: Solo il personale Medico strutturato possiede la firma digitale per validare il referto.');
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Errore ${response.status}`);
  }

  return response;
}

// --- Funzioni di chiamata API ---

// POST /auth/register
export async function apiRegister(body: any): Promise<AuthResponse> {
  const response = await fetch(`${baseApiUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Network error during registration: ${response.status}`);
  }
  return response.json();
}

// POST /auth/login
export async function apiLogin(body: URLSearchParams): Promise<AuthResponse> {
  const response = await fetch(`${baseApiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Autenticazione fallita: verificare le credenziali.`);
  }
  return response.json();
}

// PUT /users/profile — aggiorna i dati del profilo dell'utente loggato
export async function apiUpdateProfile(nome: string, cognome: string, gender: string, avatar?: string): Promise<AuthResponse> {
  const res = await authFetch('/users/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, cognome, gender, avatar }),
  });
  return res.json();
}

// GET /patients — lista completa dei pazienti nel registro
export async function apiGetPatients(): Promise<Patient[]> {
  const res = await authFetch('/patients');
  return res.json();
}

// GET /patients/{id}
export async function apiGetPatientById(id: string): Promise<Patient> {
  const res = await authFetch(`/patients/${id}`);
  return res.json();
}

// POST /patients — multipart/form-data con anagrafica + 8 slice
export async function apiCreatePatient(formData: FormData): Promise<Patient> {
  const res = await authFetch('/patients', { method: 'POST', body: formData });
  return res.json();
}

// GET /patients/{id}/slices/{index} — ritorna un blob URL dell'immagine
export async function apiGetSliceImage(id: string, index: number): Promise<string> {
  const res = await authFetch(`/patients/${id}/slices/${index}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// POST /patients/{id}/classify — lancia l'inferenza del Modello I
export async function apiClassifyPatient(id: string, force = false): Promise<ClassificationResponse> {
  const res = await authFetch(`/patients/${id}/classify?force=${force}`, { method: 'POST' });
  return res.json();
}

// POST /patients/{id}/report — genera la bozza di referto dal Modello II
export async function apiGenerateReport(id: string, force = false): Promise<ReportResponse> {
  const res = await authFetch(`/patients/${id}/report?force=${force}`, { method: 'POST' });
  return res.json();
}

// PUT /patients/{id}/report — salva le modifiche manuali al testo
export async function apiUpdateReport(id: string, reportText: string): Promise<ReportResponse> {
  const res = await authFetch(`/patients/${id}/report`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report_text: reportText }),
  });
  return res.json();
}

// GET /patients/{id}/coherence — controlla se il testo del referto cita i findings positivi
export async function apiGetCoherence(id: string): Promise<CoherenceResponse> {
  const res = await authFetch(`/patients/${id}/coherence`);
  return res.json();
}

// POST /patients/{id}/validate — solo ruolo "medico", aggiunge la firma digitale
export async function apiValidateReport(id: string): Promise<{ patient_id: string; validated: boolean; validated_by: string }> {
  const res = await authFetch(`/patients/${id}/validate`, { method: 'POST' });
  return res.json();
}

// POST /patients/{id}/unvalidate — solo ruolo "medico", riapre il referto
export async function apiUnvalidateReport(id: string): Promise<{ patient_id: string; validated: boolean; validated_by: null }> {
  const res = await authFetch(`/patients/${id}/unvalidate`, { method: 'POST' });
  return res.json();
}

// GET /patients/{id}/export — ritorna testo plain del referto formattato per la stampa
export async function apiExportReport(id: string): Promise<string> {
  const res = await authFetch(`/patients/${id}/export`);
  return res.text();
}
