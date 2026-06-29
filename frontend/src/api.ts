import { Patient, ClassificationResponse, ReportResponse, CoherenceResponse, User, AuthResponse, Finding, CoherenceIssue, Role, Gender } from './types';

// Salviamo in memoria e nel localStorage il token e l'utente della sessione corrente
let tokenMemory: string | null = localStorage.getItem('tokenMemory');
let currentSessionUser: User | null = (() => {
  const stored = localStorage.getItem('currentSessionUser');
  try {
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
})();

// Configurazione di base per l'API (default locale)
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

// -------------------------------------------------------------
// FUNZIONI DI CHIAMATA ALLE API
// -------------------------------------------------------------

// Registrazione nuovo utente: POST /auth/register
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

// Aggiornamento profilo utente: PUT /users/profile
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

// Esecuzione login: POST /auth/login
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

// Lista completa dei pazienti: GET /patients
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

// Dati di un singolo paziente per ID: GET /patients/{id}
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

// Creazione nuova scheda paziente (con caricamento file): POST /patients (multipart/form-data)
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

// Caricamento dell'immagine di una specifica slice: GET /patients/{id}/slices/{index}
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

// Esecuzione classificazione dei reperti tramite modello: POST /patients/{id}/classify
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

// Creazione bozza iniziale del referto: POST /patients/{id}/report
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

// Salvataggio delle modifiche manuali alla bozza: PUT /patients/{id}/report
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

// Controllo di coerenza fra classificazione e testo referto: GET /patients/{id}/coherence
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

// Validazione del referto con firma del medico strutturato: POST /patients/{id}/validate
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

// Esportazione del referto in formato testo: GET /patients/{id}/export
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
