import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ita' | 'en';

type Translations = Record<string, { ita: string; en: string }>;

export const translations: Translations = {
  // Header & Navigation
  'header.subtitle': {
    ita: 'UniTN-SSL-BrainCT-Pathology',
    en: 'UniTN-SSL-BrainCT-Pathology',
  },
  'header.role.medico': {
    ita: 'Medico',
    en: 'Doctor',
  },
  'header.role.specializzando': {
    ita: 'Specializzando',
    en: 'Resident',
  },
  'header.logout': {
    ita: 'Sconnetti Sessione',
    en: 'Logout',
  },
  'header.profile': {
    ita: 'Gestisci Profilo Medico',
    en: 'Manage Medical Profile',
  },

  // Home Page
  'home.tagline': {
    ita: 'SISTEMA DI SUPPORTO IN NEURORADIOLOGIA',
    en: 'DECISION SUPPORT SYSTEM IN NEURORADIOLOGY',
  },
  'home.feat1.title': {
    ita: 'Classificazione IA',
    en: 'AI Classification',
  },
  'home.feat1.desc': {
    ita: 'Analisi automatica di 4 patologie: sangue, ischemia, edema, effetto massa.',
    en: 'Automatic analysis of 4 pathologies: blood, ischemia, edema, mass effect.',
  },
  'home.feat2.title': {
    ita: 'Referto Assistito',
    en: 'Assisted Reporting',
  },
  'home.feat2.desc': {
    ita: 'Bozze di referti generate automaticamente, editabili e validabili dal medico.',
    en: 'Automatically generated report drafts, editable and validatable by doctors.',
  },
  'home.feat3.title': {
    ita: 'Ruoli e Sicurezza',
    en: 'Roles & Security',
  },
  'home.feat3.desc': {
    ita: 'Accesso differenziato per medici strutturati e specializzandi con validazione.',
    en: 'Differentiated access for attending physicians and residents with validation.',
  },
  'home.portalAccess': {
    ita: 'Accesso al Portale',
    en: 'Portal Access',
  },
  'home.btnLogin': {
    ita: 'Accedi',
    en: 'Login',
  },
  'home.btnRegister': {
    ita: 'Crea Account',
    en: 'Create Account',
  },
  'home.footer': {
    ita: 'Progetto di Tesi Triennale · Università di Trento',
    en: 'Bachelor Thesis Project · University of Trento',
  },

  // Dashboard Page
  'dashboard.title': {
    ita: 'Registro Pazienti',
    en: 'Patient Registry',
  },
  'dashboard.subtitle': {
    ita: 'Seleziona un esame per visualizzare le slice TC, avviare la valutazione dei reperti e redigere il referto.',
    en: 'Select an exam to view CT slices, run findings classification, and write clinical report.',
  },
  'dashboard.btnNewPatient': {
    ita: 'REGISTRA NUOVO PAZIENTE',
    en: 'REGISTER NEW PATIENT',
  },
  'dashboard.searchPlaceholder': {
    ita: 'Cerca per Nome, CF o ID...',
    en: 'Search by Name, Fiscal Code or ID...',
  },
  'dashboard.filter.all': { ita: 'Tutti', en: 'All' },
  'dashboard.filter.toClassify': { ita: 'Da Analizzare', en: 'To Classify' },
  'dashboard.filter.classified': { ita: 'Analizzati', en: 'Classified' },
  'dashboard.filter.reported': { ita: 'Refertati', en: 'Reported' },
  'dashboard.filter.validated': { ita: 'Validati', en: 'Validated' },
  'dashboard.col.patient': { ita: 'Paziente & Codice ID', en: 'Patient & Patient ID' },
  'dashboard.col.cf': { ita: 'Codice Fiscale', en: 'Fiscal Code' },
  'dashboard.col.date': { ita: 'Data Caricamento', en: 'Upload Date' },
  'dashboard.col.slices': { ita: 'Slice', en: 'Slices' },
  'dashboard.col.status': { ita: 'Stato', en: 'Status' },
  'dashboard.col.action': { ita: 'Azione', en: 'Action' },
  'dashboard.action.viewReport': { ita: 'Visualizza Referto', en: 'View Report' },
  'dashboard.action.examine': { ita: 'Esamina Esame', en: 'Examine Study' },
  'dashboard.emptyTitle': { ita: 'Nessun esame corrisponde ai criteri impostati.', en: 'No exams match specified search criteria.' },
  'dashboard.emptyDesc': { ita: 'Prova a cambiare i filtri superiori o a cercare un codice diverso.', en: 'Try changing upper filter tabs or search query.' },
  'dashboard.validatedBy': { ita: 'Convalidato da:', en: 'Validated by:' },

  // New Patient Page
  'newPatient.title': {
    ita: 'Registrazione Nuovo Paziente',
    en: 'New Patient Registration',
  },
  'newPatient.subtitle': {
    ita: 'Inserisci i dati del paziente e carica le 8 immagini TC.',
    en: 'Enter patient details and upload 8 CT slices.',
  },
  'newPatient.back': {
    ita: 'Torna al Registro',
    en: 'Back to Registry',
  },
  'newPatient.anonymize.label': {
    ita: 'Anonimizza esame (Keep anonymized)',
    en: 'Anonymize study (Keep anonymized)',
  },
  'newPatient.anonymize.desc': {
    ita: "Disabilita i campi anagrafici e registra l'esame in modalità anonima.",
    en: 'Disables personal details and registers the study in anonymous mode.',
  },
  'newPatient.anonymize.activeBadge': {
    ita: 'MODALITÀ ANONIMA ATTIVA',
    en: 'ANONYMOUS MODE ACTIVE',
  },
  'newPatient.sec1': {
    ita: '1. Informazioni Anagrafiche',
    en: '1. Demographic Information',
  },
  'newPatient.name': {
    ita: 'Nome',
    en: 'First Name',
  },
  'newPatient.surname': {
    ita: 'Cognome',
    en: 'Last Name',
  },
  'newPatient.fiscalCode': {
    ita: 'Codice Fiscale',
    en: 'Fiscal Code / ID',
  },
  'newPatient.birthdate': {
    ita: 'Data di Nascita',
    en: 'Date of Birth',
  },
  'newPatient.gender': {
    ita: 'Sesso',
    en: 'Gender',
  },
  'newPatient.gender.select': {
    ita: 'Seleziona sesso',
    en: 'Select gender',
  },
  'newPatient.gender.male': {
    ita: 'Uomo',
    en: 'Male',
  },
  'newPatient.gender.female': {
    ita: 'Donna',
    en: 'Female',
  },
  'newPatient.sec2': {
    ita: '2. Caricamento Serie Immagini (Pacchetto Esame)',
    en: '2. Image Series Upload (Exam Package)',
  },
  'newPatient.sliceGauge': {
    ita: 'STATO CARICAMENTO SLICES:',
    en: 'SLICE UPLOAD STATUS:',
  },
  'newPatient.slicesOf8': {
    ita: 'IMMAGINI TC',
    en: 'CT IMAGES',
  },
  'newPatient.dropInstructions': {
    ita: 'Trascina qui le 8 immagini della TC, oppure clicca per selezionarle',
    en: 'Drag & drop the 8 CT images here, or click to select them',
  },
  'newPatient.dropFormat': {
    ita: 'PNG o JPG • Esattamente 8 immagini per paziente',
    en: 'PNG or JPG • Exactly 8 images per patient',
  },
  'newPatient.selectedFiles': {
    ita: 'FILE SELEZIONATI:',
    en: 'SELECTED FILES:',
  },
  'newPatient.clearList': {
    ita: 'Svuota lista',
    en: 'Clear list',
  },
  'newPatient.cancel': {
    ita: 'ANNULLA',
    en: 'CANCEL',
  },
  'newPatient.submit': {
    ita: 'REGISTRA E SALVA',
    en: 'REGISTER & SAVE',
  },
  'newPatient.submitting': {
    ita: 'CARICAMENTO IN CORSO...',
    en: 'UPLOADING...',
  },

  // Findings Panel
  'findings.title': { ita: 'ANALISI REPERTI TC — MODELLO I', en: 'CT FINDINGS ANALYSIS — MODEL I' },
  'findings.emptyTitle': { ita: 'Valutazione dei reperti non ancora eseguita', en: 'Findings classification not run yet' },
  'findings.emptyDesc': { ita: "Esegui l'analisi automatica per valutare la presenza delle 4 patologie sulle 8 slice TC.", en: 'Run automatic classification to evaluate 4 pathologies across 8 CT slices.' },
  'findings.btnExecute': { ita: 'ESEGUI VALUTAZIONE REPERTI', en: 'RUN FINDINGS CLASSIFICATION' },
  'findings.executing': { ita: 'ELABORAZIONE VALUTAZIONE IN CORSO...', en: 'PROCESSING CLASSIFICATION...' },
  'findings.thresholdNote': { ita: 'Soglia decisionale predefinita: 0.50 (50%)', en: 'Default decision threshold: 0.50 (50%)' },
  'findings.reexecute': { ita: 'Riesegui Valutazione Reperti', en: 'Re-run Findings Classification' },
  'findings.locked': { ita: 'Valutazione Bloccata', en: 'Classification Locked' },
  'findings.label.blood': { ita: 'Emorragia / Sangue', en: 'Hemorrhage / Blood' },
  'findings.label.ischemia': { ita: 'Ischemia acuta', en: 'Acute Ischemia' },
  'findings.label.chronic_ischemia': { ita: 'Ischemia cronica', en: 'Chronic Ischemia' },
  'findings.label.edema': { ita: 'Edema cerebrale', en: 'Cerebral Edema' },
  'findings.label.mass': { ita: 'Massa espansiva', en: 'Mass Effect' },
  'findings.validatedNotice': { ita: "L'esame è stato validato. Per rieseguire l'analisi, un medico strutturato deve prima riaprire il referto.", en: 'The exam has been validated. To re-run analysis, an attending physician must first reopen the report.' },

  // Coherence Alert
  'coherence.panelTitle': { ita: 'VERIFICA DI COERENZA CLINICA (REPERTI VS TESTO REFERTO)', en: 'CLINICAL COHERENCE CHECK (FINDINGS VS REPORT TEXT)' },
  'coherence.mismatchBadge': { ita: 'INCOERENZA RILEVATA', en: 'MISMATCH DETECTED' },
  'coherence.okBadge': { ita: 'ALLINEAMENTO OK', en: 'ALIGNMENT OK' },
  'coherence.mismatchTitle': { ita: 'Mancata coerenza clinica rilevata:', en: 'Clinical mismatch detected:' },
  'coherence.mismatchDesc': { ita: 'La valutazione dei reperti ha evidenziato patologie positive che non risultano esplicitamente citate o descritte nella bozza di referto salvata.', en: 'The findings classification identified positive pathologies not explicitly mentioned in the saved report draft.' },
  'coherence.missingRef': { ita: 'Manca riferimento a:', en: 'Missing reference to:' },

  // Report Editor
  'report.title': {
    ita: 'REFERTO CLINICO',
    en: 'CLINICAL REPORT',
  },
  'report.savedBadge': {
    ita: 'SALVATO NEL SISTEMA',
    en: 'SAVED IN SYSTEM',
  },
  'report.emptyTitle': {
    ita: 'Testo del referto non ancora preparato',
    en: 'Report draft not generated yet',
  },
  'report.emptyDescNoClass': {
    ita: 'È necessario eseguire prima la valutazione dei reperti per poter generare la bozza del referto.',
    en: 'Findings classification must be executed first before generating report draft.',
  },
  'report.emptyDescReady': {
    ita: 'Valutazione completata. Clicca sotto per generare la bozza del referto.',
    en: 'Classification completed. Click below to generate the report draft.',
  },
  'report.btnGenerate': {
    ita: 'GENERA BOZZA REFERTO',
    en: 'GENERATE REPORT DRAFT',
  },
  'report.btnGenerating': {
    ita: 'ELABORAZIONE BOZZA...',
    en: 'GENERATING DRAFT...',
  },
  'report.editorHeader': {
    ita: 'EDITOR REFERTO NEURORADIOLOGICO',
    en: 'NEURORADIOLOGICAL REPORT EDITOR',
  },
  'report.editableBadge': {
    ita: 'Bozza modificabile',
    en: 'Editable draft',
  },
  'report.docHeader': {
    ita: 'REFERTO DI ESAME TC ENCEFALO',
    en: 'BRAIN CT EXAM REPORT',
  },
  'report.btnSaveDraft': {
    ita: 'SALVA MODIFICHE BOZZA',
    en: 'SAVE DRAFT CHANGES',
  },
  'report.btnSaving': {
    ita: 'SALVATAGGIO BOZZA...',
    en: 'SAVING DRAFT...',
  },
  'report.btnExportMain': {
    ita: 'ESPORTA REFERTO',
    en: 'EXPORT REPORT',
  },
  'report.restoreOriginal': {
    ita: 'Ripristina bozza di referto originale',
    en: 'Reset to original generated draft',
  },
  'report.validationTitle': {
    ita: 'VALIDAZIONE E FIRMA REFERTO',
    en: 'REPORT VALIDATION & SIGNATURE',
  },
  'report.validationDesc': {
    ita: 'Verifica il testo del referto. Dopo la convalida da parte del medico strutturato, il referto sarà salvato in sola lettura.',
    en: 'Verify report text. After validation by attending physician, the report will be saved as read-only.',
  },
  'report.validatedBadge': {
    ita: 'REFERTO VALIDATO E FIRMATO',
    en: 'REPORT VALIDATED & SIGNED',
  },
  'report.validatedDesc': {
    ita: 'Questo referto è stato firmato digitalmente ed è stato archiviato.',
    en: 'This report has been digitally signed and archived.',
  },
  'report.signedBy': {
    ita: 'Firmato da:',
    en: 'Signed by:',
  },
  'report.btnValidate': {
    ita: 'CONVALIDA E FIRMA REFERTO',
    en: 'VALIDATE & SIGN REPORT',
  },
  'report.btnValidating': {
    ita: 'REGISTRAZIONE FIRMA DIGITALE...',
    en: 'SIGNING REPORT...',
  },
  'report.btnUnvalidate': {
    ita: 'RIAPRI PER RIESAME',
    en: 'REOPEN FOR REVIEW',
  },
  'report.btnUnvalidating': {
    ita: 'RIAPERTURA REFERTO...',
    en: 'REOPENING REPORT...',
  },

  // Export Modal
  'exportModal.title': { ita: 'Esporta Referto Clinico', en: 'Export Clinical Report' },
  'exportModal.formatLabel': { ita: 'Formato di Esportazione', en: 'Export Format' },
  'exportModal.filenameLabel': { ita: 'Nome del File', en: 'File Name' },
  'exportModal.cancel': { ita: 'ANNULLA', en: 'CANCEL' },
  'exportModal.download': { ita: 'SCARICA FILE', en: 'DOWNLOAD FILE' },
  'exportModal.exporting': { ita: 'PREPARAZIONE FILE...', en: 'PREPARING FILE...' },

  // PACS Viewer
  'pacs.title': { ita: 'VISUALIZZATORE TC ASSIALE', en: 'AXIAL CT VIEWER' },
  'pacs.loading': { ita: 'CARICAMENTO SLICE TC...', en: 'LOADING CT SLICE...' },
  'pacs.errorTitle': { ita: 'ERRORE CARICAMENTO IMMAGINE', en: 'IMAGE LOAD ERROR' },
  'pacs.thumbnails': { ita: 'Miniature di Navigazione', en: 'Navigation Thumbnails' },
  'pacs.prevSlice': { ita: 'Slice Precedente', en: 'Previous Slice' },
  'pacs.nextSlice': { ita: 'Slice Successiva', en: 'Next Slice' },
  'pacs.viewSlice': { ita: 'Vedi Slice', en: 'View Slice' },
  'pacs.slice': { ita: 'SLICE', en: 'SLICE' },
  'pacs.of': { ita: 'DI', en: 'OF' },
  'pacs.zoom': { ita: 'Zoom', en: 'Zoom' },
  'pacs.contrast': { ita: 'Contrasto', en: 'Contrast' },
  'pacs.reset': { ita: 'Ripristina', en: 'Reset' },

  // Loading Notice
  'loading.subtitle': { ita: 'Caricamento dei dati dal server in corso...', en: 'Loading data from server...' },

  // Patient Detail - misc
  'detail.consultationNotes': { ita: 'Note di consultazione:', en: 'Consultation notes:' },
  'detail.consultationDesc': { ita: "Le immagini mostrano le 8 slice assiali della TC. L'analisi valuta le slice per identificare le patologie.", en: 'Images show the 8 axial CT slices. Analysis evaluates slices to identify pathologies.' },
  'detail.error': { ita: 'Errore:', en: 'Error:' },
  'detail.hideError': { ita: 'Nascondi', en: 'Dismiss' },
  'detail.validatedLabel': { ita: 'Validato Clinicamente', en: 'Clinically Validated' },
  'detail.draftLabel': { ita: 'Bozza Refertata', en: 'Draft Report' },
  'detail.pendingReportLabel': { ita: 'In Attesa Referto', en: 'Pending Report' },
  'detail.toAnalyzeLabel': { ita: 'Da Analizzare', en: 'To Analyze' },
  'detail.loadingMsg': { ita: 'Caricamento dei dati clinici del paziente...', en: 'Loading patient clinical data...' },
  'detail.backTitle': { ita: 'Torna al registro', en: 'Back to registry' },

  // Login Form
  'login.portalAccess': { ita: 'Accesso al Portale', en: 'Portal Access' },
  'login.systemSubtitle': { ita: 'Sistema Eidos per la Refertazione Neuroradiologica', en: 'Eidos System for Neuroradiological Reporting' },
  'login.tabLogin': { ita: 'Accedi al Portale', en: 'Sign In' },
  'login.tabRegister': { ita: 'Crea Nuovo Account', en: 'Create Account' },
  'login.firstName': { ita: 'Nome', en: 'First Name' },
  'login.lastName': { ita: 'Cognome', en: 'Last Name' },
  'login.usernameLabel': { ita: 'Username', en: 'Username' },
  'login.usernameAutoLabel': { ita: 'Username (Generato Automaticamente)', en: 'Username (Auto-generated)' },
  'login.usernameHint': { ita: "L'username viene generato concatenando Nome e Cognome in minuscolo.", en: 'Username is generated by concatenating First and Last name in lowercase.' },
  'login.passwordLabel': { ita: 'Password', en: 'Password' },
  'login.roleLabel': { ita: 'RUOLO SANITARIO', en: 'MEDICAL ROLE' },
  'login.roleMedico': { ita: 'Medico Strutturato', en: 'Attending Physician' },
  'login.roleSpecializzando': { ita: 'Specializzando', en: 'Medical Resident' },
  'login.genderLabel': { ita: 'SESSO', en: 'GENDER' },
  'login.genderMale': { ita: 'Maschio', en: 'Male' },
  'login.genderFemale': { ita: 'Femmina', en: 'Female' },
  'login.btnLogin': { ita: 'Accedi', en: 'Sign In' },
  'login.btnRegister': { ita: 'Registra Account', en: 'Create Account' },
  'login.btnLoading': { ita: 'AUTENTICAZIONE IN CORSO...', en: 'AUTHENTICATING...' },
  'login.successMsg': { ita: 'Registrazione completata con successo! Inserisci le tue credenziali per accedere.', en: 'Account created successfully! Enter your credentials to sign in.' },
  'login.errorDefault': { ita: 'Errore di autenticazione. Verificare le credenziali.', en: 'Authentication error. Please check your credentials.' },

  // Profile Page
  'profile.backBtn': { ita: 'Annulla e Torna Indietro', en: 'Cancel and Go Back' },
  'profile.title': { ita: 'Profilo Personale Sanitario', en: 'Personal Medical Profile' },
  'profile.subtitle': { ita: 'Modifica i tuoi dati anagrafici e la foto del profilo per la firma digitale.', en: 'Edit your personal details and profile photo for digital signature.' },
  'profile.avatarLabel': { ita: 'Foto del Profilo (Avatar)', en: 'Profile Photo (Avatar)' },
  'profile.uploadPhoto': { ita: 'Carica Foto', en: 'Upload Photo' },
  'profile.removePhoto': { ita: 'Rimuovi', en: 'Remove' },
  'profile.photoHint': { ita: 'PNG o JPG. Dimensione massima 2 MB.', en: 'PNG or JPG. Maximum size 2 MB.' },
  'profile.firstName': { ita: 'Nome', en: 'First Name' },
  'profile.lastName': { ita: 'Cognome', en: 'Last Name' },
  'profile.gender': { ita: 'Genere', en: 'Gender' },
  'profile.genderMale': { ita: 'Maschio (Dr.)', en: 'Male (Dr.)' },
  'profile.genderFemale': { ita: 'Femmina (Dr.ssa)', en: 'Female (Dr.ssa)' },
  'profile.roleLabel': { ita: 'Ruolo Sanitario (Sola Lettura)', en: 'Medical Role (Read Only)' },
  'profile.roleMedico': { ita: 'Medico Strutturato', en: 'Attending Physician' },
  'profile.roleSpecializzando': { ita: 'Specializzando', en: 'Medical Resident' },
  'profile.signatureLabel': { ita: 'Firma Clinica', en: 'Clinical Signature' },
  'profile.signatureHint': { ita: 'Questa dicitura verrà usata per convalidare i referti.', en: 'This label will be used to validate clinical reports.' },
  'profile.cancelBtn': { ita: 'ANNULLA', en: 'CANCEL' },
  'profile.saveBtn': { ita: 'SALVA MODIFICHE', en: 'SAVE CHANGES' },
  'profile.savingBtn': { ita: 'SALVATAGGIO...', en: 'SAVING...' },
  'profile.errorPrefix': { ita: 'Errore:', en: 'Error:' },
  'profile.noUser': { ita: 'Nessun utente autenticato.', en: 'No authenticated user.' },
  'profile.noUserBack': { ita: 'Torna indietro', en: 'Go back' },
  'profile.successMsg': { ita: 'Profilo aggiornato!', en: 'Profile updated!' },
  'profile.errorRequired': { ita: 'Nome e cognome sono obbligatori.', en: 'First and last name are required.' },
  'profile.errorFileType': { ita: "Il file deve essere un'immagine.", en: 'The file must be an image.' },
  'profile.errorFileSize': { ita: 'Dimensione massima consentita: 2 MB.', en: 'Maximum allowed size: 2 MB.' },
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ita',
  setLang: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('eidos_lang');
    return saved === 'en' ? 'en' : 'ita';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('eidos_lang', newLang);
  };

  const t = (key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || entry.ita || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
