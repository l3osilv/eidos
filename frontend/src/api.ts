import { Patient, ClassificationResponse, ReportResponse, CoherenceResponse, User, AuthResponse, Finding, CoherenceIssue, Role, Gender } from './types';

// Token e utente della sessione attiva tenuti in memoria e nel localStorage.
// Due storage perché il localStorage sopravvive ai refresh, la variabile in memoria
// è più veloce da leggere durante il render.
let tokenMemory: string | null = localStorage.getItem('tokenMemory');
let currentSessionUser: User | null = (() => {
  const stored = localStorage.getItem('currentSessionUser');
  try {
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
})();

// URL base del backend — default localhost per sviluppo locale
let baseApiUrl = 'http://localhost:8000';

export function getApiConfig() {
  return {
    baseUrl: baseApiUrl,
  };
}

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

// PUT /users/profile — aggiorna i dati del profilo dell'utente loggato
export async function apiUpdateProfile(nome: string, cognome: string, gender: Gender, avatar?: string): Promise<AuthResponse> {
  const response = await fetch(`${baseApiUrl}/users/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenMemory}`,
    },
    body: JSON.stringify({ nome, cognome, gender, avatar }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Errore salvataggio profilo: ${response.status}`);
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

// GET /patients — lista completa dei pazienti nel registro
export async function apiGetPatients(): Promise<Patient[]> {
  const response = await fetch(`${baseApiUrl}/patients`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenMemory}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Sessione scaduta o non autorizzata. Effettuare nuovamente il login.');
    throw new Error(`Errore caricamento pazienti: ${response.status}`);
  }
  return response.json();
}

// GET /patients/{id}
export async function apiGetPatientById(id: string): Promise<Patient> {
  const response = await fetch(`${baseApiUrl}/patients/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenMemory}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Errore caricamento paziente ${id}: ${response.status}`);
  }
  return response.json();
}

// POST /patients — multipart/form-data con anagrafica + 8 slice
export async function apiCreatePatient(formData: FormData): Promise<Patient> {
  const response = await fetch(`${baseApiUrl}/patients`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenMemory}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Errore inserimento paziente: ${response.status}`);
  }
  return response.json();
}

// GET /patients/{id}/slices/{index} — ritorna un blob URL dell'immagine
export async function apiGetSliceImage(id: string, index: number, patientObj?: Patient): Promise<string> {
  const response = await fetch(`${baseApiUrl}/patients/${id}/slices/${index}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenMemory}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Errore caricamento slice ${index}: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// POST /patients/{id}/classify — lancia l'inferenza del Modello I
export async function apiClassifyPatient(id: string, force: boolean = false): Promise<ClassificationResponse> {
  const response = await fetch(`${baseApiUrl}/patients/${id}/classify?force=${force}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenMemory}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Errore valutazione clinica reperti: ${response.status}`);
  }
  return response.json();
}

// POST /patients/{id}/report — genera la bozza di referto dal Modello II
export async function apiGenerateReport(id: string, force: boolean = false): Promise<ReportResponse> {
  const response = await fetch(`${baseApiUrl}/patients/${id}/report?force=${force}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenMemory}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 400) {
      throw new Error(errorData.detail || 'Attenzione: È necessario eseguire prima la valutazione strumentale dei reperti.');
    }
    throw new Error(errorData.detail || `Errore preparazione bozza referto: ${response.status}`);
  }
  return response.json();
}

// PUT /patients/{id}/report — salva le modifiche manuali al testo
export async function apiUpdateReport(id: string, reportText: string): Promise<ReportResponse> {
  const response = await fetch(`${baseApiUrl}/patients/${id}/report`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenMemory}`,
    },
    body: JSON.stringify({ report_text: reportText }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Errore salvataggio modifiche referto: ${response.status}`);
  }
  return response.json();
}

// GET /patients/{id}/coherence — controlla se il testo del referto cita i findings positivi
export async function apiGetCoherence(id: string): Promise<CoherenceResponse> {
  const response = await fetch(`${baseApiUrl}/patients/${id}/coherence`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenMemory}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Errore rilevazione coerenza: ${response.status}`);
  }
  return response.json();
}

// POST /patients/{id}/validate — solo ruolo "medico", aggiunge la firma digitale
export async function apiValidateReport(id: string): Promise<{ patient_id: string; validated: boolean; validated_by: string }> {
  const response = await fetch(`${baseApiUrl}/patients/${id}/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenMemory}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 403) {
      throw new Error('Accesso negato: Solo il personale Medico strutturato possiede la firma digitale per validare il referto.');
    }
    throw new Error(errorData.detail || `Errore validazione: ${response.status}`);
  }
  return response.json();
}

// GET /patients/{id}/export — ritorna testo plain del referto formattato per la stampa
export async function apiExportReport(id: string): Promise<string> {
  const response = await fetch(`${baseApiUrl}/patients/${id}/export`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenMemory}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Errore esportazione referto: ${response.status}`);
  }
  return response.text();
}
