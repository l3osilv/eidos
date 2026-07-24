import React, { useState, useRef, ChangeEvent } from 'react';
import { ArrowLeft, Upload, Trash2, Check, User as UserIcon, Shield } from 'lucide-react';
import { User, Gender } from '../types';
import { apiUpdateProfile } from '../api';
import { useLanguage } from '../context/LanguageContext';

interface ProfileProps {
  currentUser: User | null;
  onUpdateUser: (updatedUser: User) => void;
  onBack: () => void;
}

export default function Profile({
  currentUser,
  onUpdateUser,
  onBack,
}: ProfileProps) {
  const { t } = useLanguage();
  const [nome, setNome] = useState(currentUser?.nome || '');
  const [cognome, setCognome] = useState(currentUser?.cognome || '');
  const [gender, setGender] = useState<Gender>(currentUser?.gender || 'M');
  const [avatar, setAvatar] = useState<string | undefined>(currentUser?.avatar);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) {
    return (
      <div className="text-center p-8 bg-white border border-slate-200 rounded-lg shadow-sm">
        <p className="text-sm font-semibold text-slate-700">{t('profile.noUser')}</p>
        <button onClick={onBack} className="mt-4 text-xs font-bold text-blue-900 underline uppercase cursor-pointer">
          {t('profile.noUserBack')}
        </button>
      </div>
    );
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setErrorMessage(t('profile.errorFileType'));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setErrorMessage(t('profile.errorFileSize'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
        }
      };
      reader.onerror = () => {
        setErrorMessage(t('profile.errorFileType'));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setAvatar(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!nome.trim() || !cognome.trim()) {
      setErrorMessage(t('profile.errorRequired'));
      return;
    }

    setLoading(true);
    try {
      const res = await apiUpdateProfile(nome.trim(), cognome.trim(), gender, avatar);
      const updatedUser: User = {
        username: res.username,
        nome: res.nome,
        cognome: res.cognome,
        gender: res.gender,
        role: res.role,
        avatar: res.avatar,
      };

      onUpdateUser(updatedUser);
      setSuccessMessage(t('profile.successMsg'));
      setTimeout(() => {
        onBack();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Impossibile salvare il profilo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto" id="profile-management-screen">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold mb-4 transition uppercase font-mono cursor-pointer"
        id="btn-indietro-profilo"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('profile.backBtn')}
      </button>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 tracking-tight font-mono uppercase">
              {t('profile.title')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('profile.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            <Shield className="h-3 w-3 text-slate-500" />
            <span>ID: {currentUser.username}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-xs" id="profile-error-alert">
              <span className="font-semibold">{t('profile.errorPrefix')}</span> {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded text-xs flex items-center gap-2" id="profile-success-alert">
              <Check className="h-4.5 w-4.5 text-emerald-600" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="h-10 w-10 text-slate-400" />
                )}
              </div>
            </div>

            <div className="space-y-2 text-center sm:text-left flex-1">
              <label className="block text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                {t('profile.avatarLabel')}
              </label>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-900 hover:bg-blue-950 text-white text-[11px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition font-mono uppercase tracking-wide cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t('profile.uploadPhoto')}
                </button>
                {avatar && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="bg-white hover:bg-slate-50 text-red-600 hover:text-red-700 text-[11px] font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition border border-slate-200 font-mono uppercase tracking-wide cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('profile.removePhoto')}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {t('profile.photoHint')}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{t('profile.firstName')}</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Mario"
                  className="w-full border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                  id="profile-nome-input"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{t('profile.lastName')}</label>
                <input
                  type="text"
                  required
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  placeholder="Rossi"
                  className="w-full border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                  id="profile-cognome-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{t('profile.gender')}</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  id="profile-gender-input"
                >
                  <option value="M">{t('profile.genderMale')}</option>
                  <option value="F">{t('profile.genderFemale')}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">{t('profile.roleLabel')}</label>
                <input
                  type="text"
                  disabled
                  value={currentUser.role === 'medico' ? t('profile.roleMedico') : t('profile.roleSpecializzando')}
                  className="w-full border border-slate-200 bg-slate-50 text-slate-500 rounded px-3 py-2 text-xs font-semibold cursor-not-allowed"
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded">
              <span className="block text-[10px] font-semibold text-slate-500 font-mono uppercase">{t('profile.signatureLabel')}</span>
              <p className="text-sm font-bold text-blue-900 mt-1 font-mono">
                {gender === 'M' ? 'Dr.' : 'Dr.ssa'} {cognome || 'Cognome'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {t('profile.signatureHint')}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              {t('profile.cancelBtn')}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-5 py-2.5 rounded flex items-center gap-1.5 transition font-mono tracking-wide shadow-sm uppercase disabled:opacity-50 cursor-pointer"
              id="profile-save-btn"
            >
              {loading ? (
                <>
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                  {t('profile.savingBtn')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t('profile.saveBtn')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
