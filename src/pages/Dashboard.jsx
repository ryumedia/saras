import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { currentUserData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUserData) {
      // Cek apakah user memiliki role admin. Jika tidak (berarti siswa), redirect ke /app
      const isAdmin = currentUserData.role && ['Super Admin', 'Admin Puskesmas', 'Admin Sekolah'].includes(currentUserData.role);
      if (!isAdmin) {
        navigate('/app', { replace: true });
      }
    }
  }, [currentUserData, navigate]);

  return (
    <div className="dashboard-container">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>Dashboard</h1>
      </div>

      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ marginTop: 0, color: 'var(--primary-color, #0d9488)' }}>
          Selamat Datang, {currentUserData?.nama}!
        </h2>
        <p style={{ color: '#666', fontSize: '1.1em', marginTop: '8px' }}>
          Anda login sebagai: <strong style={{ color: '#333' }}>{currentUserData?.role}</strong>
        </p>
        
        <div style={{ marginTop: '24px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <p style={{ lineHeight: '1.6', color: '#444' }}>
            Selamat datang di Sistem Informasi SARAS (Sahabat Remaja Sehat).<br/>
            Silakan gunakan menu navigasi di sebelah kiri untuk mengelola data:
          </p>
          
          <ul style={{ marginTop: '12px', color: '#555', paddingLeft: '20px' }}>
            {currentUserData?.role === 'Super Admin' && <li>Mengelola seluruh data master (Puskesmas, Sekolah, Admin, Obat).</li>}
            {currentUserData?.role === 'Admin Puskesmas' && <li>Mengelola data Sekolah binaan dan Stok Obat Puskesmas.</li>}
            {currentUserData?.role === 'Admin Sekolah' && <li>Mengelola data Siswa dan Stok Obat Sekolah.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}