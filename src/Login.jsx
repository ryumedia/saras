import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import './styles/Modal.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Cek role user untuk redirection
      let userDoc = await getDoc(doc(db, 'admins', user.uid));
      if (userDoc.exists()) {
        // Ini adalah Admin/Super Admin
        navigate('/');
      } else {
        userDoc = await getDoc(doc(db, 'siswa', user.uid));
        if (userDoc.exists()) {
          // Ini adalah Siswa
          navigate('/app');
        } else {
          throw new Error("Profil pengguna tidak ditemukan.");
        }
      }
    } catch (err) {
      setError('Gagal login. Periksa kembali email dan password Anda.');
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');

    if (!resetEmail) {
      setResetError('Mohon masukkan email.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Link reset password telah dikirim ke email Anda.');
      setResetEmail('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setResetError('Email tidak terdaftar.');
      } else {
        setResetError('Gagal mengirim email reset. Silakan coba lagi.');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src="public/logo.png" alt="Logo Saras" className="login-logo" />
        <h2>Login CMS SARAS</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error-message">{error}</p>}
          
          <div style={{ textAlign: 'right', marginBottom: '1rem', marginTop: '-0.5rem' }}>
            <button 
              type="button" 
              onClick={() => setShowResetModal(true)}
              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
            >
              Lupa Password?
            </button>
          </div>

          <button type="submit" className="login-button" disabled={isLoggingIn}>
            {isLoggingIn ? 'Memproses...' : 'Login'}
          </button>
        </form>
      </div>

      {/* Modal Lupa Password */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0 }}>Reset Password</h2>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Masukkan email Anda untuk menerima link reset password.
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="input-group">
                <label htmlFor="resetEmail">Email</label>
                <input 
                  type="email" 
                  id="resetEmail" 
                  value={resetEmail} 
                  onChange={(e) => setResetEmail(e.target.value)} 
                  required 
                  placeholder="nama@email.com"
                />
              </div>
              {resetMessage && <p style={{ color: 'green', fontSize: '0.9rem', marginBottom: '10px' }}>{resetMessage}</p>}
              {resetError && <p className="error-message" style={{ marginBottom: '10px' }}>{resetError}</p>}
              
              <div className="modal-actions">
                <button type="button" className="action-button cancel" onClick={() => setShowResetModal(false)}>Tutup</button>
                <button type="submit" className="action-button save">Kirim Link</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}