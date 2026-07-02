import { Patient, ClassificationResponse, ReportResponse, CoherenceResponse, User, AuthResponse } from './types';

let tokenMemory: string | null = localStorage.getItem('tokenMemory');
let currentSessionUser: User | null = (() => {
  try {
    const stored = localStorage.getItem('currentSessionUser');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
})();

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

// Wrapper per iniettare l'Authorization header ed intercettare errori comuni
async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${baseApiUrl}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(tokenMemory ? { Authorization: `Bearer ${tokenMemory}` } : {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Sessione scaduta. Effettuare nuovamente il login.');
    if (response.status === 403) throw new Error('Accesso negato: firma digitale consentita solo ai medici strutturati.');
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Errore ${response.status}`);
  }

  return response;
}

export async function apiRegister(body: any): Promise<AuthResponse> {
  const response = await fetch(`${baseApiUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Errore di registrazione: ${response.status}`);
  }
  return response.json();
}

export async function apiLogin(body: URLSearchParams): Promise<AuthResponse> {
  const response = await fetch(`${baseApiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Autenticazione fallita.');
  }
  return response.json();
}

export async function apiUpdateProfile(nome: string, cognome: string, gender: string, avatar?: string): Promise<AuthResponse> {
  const res = await authFetch('/users/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, cognome, gender, avatar }),
  });
  return res.json();
}

export async function apiGetPatients(): Promise<Patient[]> {
  const res = await authFetch('/patients');
  return res.json();
}

export async function apiGetPatientById(id: string): Promise<Patient> {
  const res = await authFetch(`/patients/${id}`);
  return res.json();
}

export async function apiCreatePatient(formData: FormData): Promise<Patient> {
  const res = await authFetch('/patients', { method: 'POST', body: formData });
  return res.json();
}

export async function apiGetSliceImage(id: string, index: number): Promise<string> {
  const res = await authFetch(`/patients/${id}/slices/${index}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function apiClassifyPatient(id: string, force = false): Promise<ClassificationResponse> {
  const res = await authFetch(`/patients/${id}/classify?force=${force}`, { method: 'POST' });
  return res.json();
}

export async function apiGenerateReport(id: string, force = false): Promise<ReportResponse> {
  const res = await authFetch(`/patients/${id}/report?force=${force}`, { method: 'POST' });
  return res.json();
}

export async function apiUpdateReport(id: string, reportText: string): Promise<ReportResponse> {
  const res = await authFetch(`/patients/${id}/report`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report_text: reportText }),
  });
  return res.json();
}

export async function apiGetCoherence(id: string): Promise<CoherenceResponse> {
  const res = await authFetch(`/patients/${id}/coherence`);
  return res.json();
}

export async function apiValidateReport(id: string): Promise<{ patient_id: string; validated: boolean; validated_by: string }> {
  const res = await authFetch(`/patients/${id}/validate`, { method: 'POST' });
  return res.json();
}

export async function apiUnvalidateReport(id: string): Promise<{ patient_id: string; validated: boolean; validated_by: null }> {
  const res = await authFetch(`/patients/${id}/unvalidate`, { method: 'POST' });
  return res.json();
}

export async function apiExportReport(id: string): Promise<string> {
  const res = await authFetch(`/patients/${id}/export`);
  return res.text();
}
