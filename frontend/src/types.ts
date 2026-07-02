
export type Role = 'medico' | 'specializzando';
export type Gender = 'M' | 'F';

export interface User {
  username: string;
  nome: string;
  cognome: string;
  role: Role;
  gender: Gender;
  avatar?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: Role;
  gender: Gender;
  nome: string;
  cognome: string;
  username: string;
  avatar?: string;
}

export interface Patient {
  patient_id: string;
  nome: string;
  cognome: string;
  codice_fiscale: string;
  gender: Gender;
  data_nascita: string; // Formato YYYY-MM-DD
  created_at: string;
  num_slices: number; // Sono sempre 8 slice
  has_classification: boolean;
  has_report: boolean;
  validated: boolean;
  validated_by?: string | null;
}

export interface Finding {
  label: 'Blood' | 'Ischemia' | 'Chronic_Ischemia' | 'Edema' | 'Mass';
  probability: number; // Valore tra 0.0 e 1.0
  threshold: number; // Soglia impostata a 0.5
  positive: boolean;
}

export interface ClassificationResponse {
  patient_id: string;
  findings: Finding[];
  no_finding: boolean;
  model_name: string;
  generated_at: string;
}

export interface ReportResponse {
  patient_id: string;
  report_text: string;
  model_name: string;
  generated_at: string;
  disclaimer: string;
}

export interface CoherenceIssue {
  label: string;
  in_findings: boolean;
  mentioned_in_report: boolean;
}

export interface CoherenceResponse {
  patient_id: string;
  issues: CoherenceIssue[];
  has_mismatch: boolean;
}


