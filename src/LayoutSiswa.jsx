import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Calendar, Award, User, Pill, HeartPulse } from 'lucide-react';
import './styles/LayoutSiswa.css';

export default function LayoutSiswa() {
  return (
    <div className="mobile-view-container">
      <main className="mobile-content">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        <NavLink to="/app" end>
          <Home size={24} />
          <span>Beranda</span>
        </NavLink>
        <NavLink to="/app/riwayat-minum-obat">
          <HeartPulse size={24} />
          <span>Riwayat</span>
        </NavLink>
        <NavLink to="/app/reward">
          <Award size={24} />
          <span>Reward</span>
        </NavLink>
        <NavLink to="/app/profil">
          <User size={24} />
          <span>Profil</span>
        </NavLink>
      </nav>
    </div>
  );
}
