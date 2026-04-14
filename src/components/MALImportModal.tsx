import { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { parseMALXml, importMALToProfile } from '../services/malImport';
import type { MALEntry, ImportProgress } from '../services/malImport';
import './MALImportModal.css';

interface MALImportModalProps {
  onClose: () => void;
}

export const MALImportModal: React.FC<MALImportModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [entries, setEntries] = useState<MALEntry[]>([]);
  const [malUsername, setMalUsername] = useState('');
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      showToast("Le fichier doit être un .xml exporté depuis MAL.", "error");
      return;
    }

    if (file.size > 5_000_000) {
      showToast("Fichier trop volumineux (max 5 Mo).", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseMALXml(text);

      if (parsed.length === 0) {
        showToast("Aucun anime trouvé dans ce fichier.", "error");
        return;
      }

      // Extract username from XML
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      const username = doc.querySelector('user_name')?.textContent || '';
      setMalUsername(username);

      setEntries(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!user) {
      showToast("Connecte-toi pour importer.", "info");
      return;
    }

    setStep('importing');
    const result = await importMALToProfile(user.uid, entries, setProgress);
    setProgress(result);
    setStep('done');
  };

  const completed = entries.filter(e => e.status === 'Completed').length;
  const watching = entries.filter(e => e.status === 'Watching').length;
  const dropped = entries.filter(e => e.status === 'Dropped').length;
  const planToWatch = entries.filter(e => e.status === 'Plan to Watch').length;
  const toImport = entries.filter(e => e.status !== 'Plan to Watch').length;

  return (
    <div className="mal-backdrop" onClick={onClose}>
      <div className="mal-modal glass-panel" onClick={e => e.stopPropagation()}>
        <button className="mal-close" onClick={onClose}><X size={20} /></button>

        {step === 'upload' && (
          <div className="mal-upload-step">
            <Upload size={40} className="mal-upload-icon" />
            <h2 className="mal-title">Importer depuis MyAnimeList</h2>
            <p className="mal-desc">
              Exporte ta liste depuis <strong>MAL → Profil → Liste → Export</strong>, puis importe le fichier XML ici.
            </p>
            <button className="mal-upload-btn" onClick={() => fileRef.current?.click()}>
              <FileText size={16} /> Choisir le fichier XML
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xml"
              className="mal-hidden-input"
              onChange={handleFile}
            />
          </div>
        )}

        {step === 'preview' && (
          <div className="mal-preview-step">
            <h2 className="mal-title">
              Liste de {malUsername || 'MAL'}
            </h2>
            <div className="mal-stats-grid">
              <div className="mal-stat">
                <span className="mal-stat-val">{entries.length}</span>
                <span className="mal-stat-lbl">Total</span>
              </div>
              <div className="mal-stat">
                <span className="mal-stat-val" style={{ color: '#06d6a0' }}>{completed}</span>
                <span className="mal-stat-lbl">Completed</span>
              </div>
              <div className="mal-stat">
                <span className="mal-stat-val" style={{ color: '#3a86ff' }}>{watching}</span>
                <span className="mal-stat-lbl">Watching</span>
              </div>
              <div className="mal-stat">
                <span className="mal-stat-val" style={{ color: '#f72585' }}>{dropped}</span>
                <span className="mal-stat-lbl">Dropped</span>
              </div>
              <div className="mal-stat">
                <span className="mal-stat-val" style={{ color: 'var(--text-muted)' }}>{planToWatch}</span>
                <span className="mal-stat-lbl">Plan to Watch</span>
              </div>
            </div>
            <p className="mal-info">
              <strong>{toImport}</strong> anime seront importés (Plan to Watch ignorés).
              <br />
              Chaque anime sera ajouté avec <strong>toutes ses saisons</strong>.
              <br />
              Les scores MAL (1-10) seront convertis en notes /100.
            </p>
            <div className="mal-preview-list">
              {entries.filter(e => e.status !== 'Plan to Watch').slice(0, 20).map(e => (
                <div key={e.malId} className="mal-preview-item">
                  <span className="mal-preview-name">{e.title}</span>
                  <span className={`mal-preview-status ${e.status.toLowerCase().replace(/\s/g, '-')}`}>
                    {e.status}
                  </span>
                  {e.score > 0 && (
                    <span className="mal-preview-score">{e.score}/10</span>
                  )}
                </div>
              ))}
              {toImport > 20 && (
                <p className="mal-preview-more">... et {toImport - 20} de plus</p>
              )}
            </div>
            <button className="mal-import-btn" onClick={handleImport}>
              <Upload size={16} /> Importer {toImport} anime
            </button>
          </div>
        )}

        {step === 'importing' && progress && (
          <div className="mal-importing-step">
            <Loader2 size={40} className="mal-spinner" />
            <h2 className="mal-title">Import en cours...</h2>
            <div className="mal-progress-bar">
              <div
                className="mal-progress-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="mal-progress-text">
              {progress.current}/{progress.total} — {progress.currentTitle}
            </p>
            <div className="mal-progress-stats">
              <span><CheckCircle size={14} style={{ color: '#06d6a0' }} /> {progress.added} ajoutés</span>
              <span>⏭ {progress.skipped} existants</span>
              {progress.errors.length > 0 && (
                <span><AlertTriangle size={14} style={{ color: '#fbbf24' }} /> {progress.errors.length} erreurs</span>
              )}
            </div>
          </div>
        )}

        {step === 'done' && progress && (
          <div className="mal-done-step">
            <CheckCircle size={48} className="mal-done-icon" />
            <h2 className="mal-title">Import terminé !</h2>
            <div className="mal-done-stats">
              <div className="mal-stat">
                <span className="mal-stat-val" style={{ color: '#06d6a0' }}>{progress.added}</span>
                <span className="mal-stat-lbl">Saisons ajoutées</span>
              </div>
              <div className="mal-stat">
                <span className="mal-stat-val">{progress.skipped}</span>
                <span className="mal-stat-lbl">Déjà existants</span>
              </div>
              <div className="mal-stat">
                <span className="mal-stat-val" style={{ color: '#fbbf24' }}>{progress.errors.length}</span>
                <span className="mal-stat-lbl">Non trouvés</span>
              </div>
            </div>
            {progress.errors.length > 0 && (
              <div className="mal-errors">
                <p className="mal-errors-title">Anime non trouvés :</p>
                <div className="mal-errors-list">
                  {progress.errors.map(e => <span key={e}>{e}</span>)}
                </div>
              </div>
            )}
            <button className="mal-import-btn" onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
};
