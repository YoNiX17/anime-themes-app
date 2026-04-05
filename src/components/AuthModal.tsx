import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  signInWithRedirect
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { X, Mail, Lock, User as UserIcon } from 'lucide-react';
import './AuthModal.css';

const FIREBASE_ERROR_FR: Record<string, string> = {
  'auth/invalid-email': 'Adresse email invalide.',
  'auth/user-disabled': 'Ce compte a \u00e9t\u00e9 d\u00e9sactiv\u00e9.',
  'auth/user-not-found': 'Aucun compte trouv\u00e9 avec cet email.',
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/email-already-in-use': 'Un compte existe d\u00e9j\u00e0 avec cet email.',
  'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caract\u00e8res.',
  'auth/too-many-requests': 'Trop de tentatives. R\u00e9essaie dans quelques minutes.',
  'auth/network-request-failed': 'Erreur r\u00e9seau. V\u00e9rifie ta connexion.',
  'auth/popup-closed-by-user': 'Connexion annul\u00e9e.',
  'auth/invalid-credential': 'Identifiants invalides. V\u00e9rifie ton email et mot de passe.',
};

const getAuthErrorMessage = (err: unknown): string => {
  const code = (err as { code?: string })?.code || '';
  return FIREBASE_ERROR_FR[code] || 'Une erreur est survenue. R\u00e9essaie.';
};

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
      }
      onClose();
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          <X size={18} />
        </button>
        
        <h2 className="auth-title">
          {isLogin ? 'Bon retour !' : 'Créer un compte'}
        </h2>
        <p className="auth-subtitle">
          {isLogin ? 'Connecte-toi pour noter les anime et rejoindre des parties.' : 'Inscris-toi pour noter et suivre tes anime préférés.'}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <button 
          onClick={handleGoogleSignIn} 
          disabled={loading}
          className="google-btn"
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>ou continuer par email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-group">
              <UserIcon className="input-icon" size={18} />
              <input 
                type="text" 
                placeholder="Pseudo" 
                required 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="username"
              />
            </div>
          )}
          
          <div className="input-group">
            <Mail className="input-icon" size={18} />
            <input 
              type="email" 
              placeholder="Email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input 
              type="password" 
              placeholder="Mot de passe" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : 'S\'inscrire')}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? "Pas encore de compte ? " : "Déjà un compte ? "}
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'S\'inscrire' : 'Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
};
