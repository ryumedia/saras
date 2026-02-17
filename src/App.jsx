import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import Puskesmas from './pages/Puskesmas';
import Sekolah from './pages/Sekolah';
import Admin from './pages/Admin';
import Siswa from './pages/Siswa';
import Layout from './Layout';
import LayoutSiswa from './LayoutSiswa';
import DataObat from './pages/stok/DataObat';
import StokDinas from './pages/stok/StokDinas';
import StokPuskesmas from './pages/stok/StokPuskesmas';
import StokSekolah from './pages/stok/StokSekolah';
import Kadaluarsa from './pages/stok/Kadaluarsa';
import Profil from './pages/Profil';
import DashboardSiswa from './pages/siswa/DashboardSiswa';
import RiwayatMinumObat from './pages/siswa/RiwayatMinumObat';
import RewardSiswa from './pages/siswa/RewardSiswa';
import ProfilSiswa from './pages/siswa/ProfilSiswa';
import Pemantauan from './pages/Pemantauan';
import Pengingat from './pages/Pengingat';
import PengaturanPesan from './pages/pengaturan/PengaturanPesan';
import ProtectedRoute from './components/ProtectedRoute';
import DataKelas from './pages/DataKelas';
import DataHB from './pages/hbsiswa/DataHB';
import PemeriksaanHB from './pages/hbsiswa/PemeriksaanHB';

// Import styles
import './App.css';
import './styles/Layout.css';
import './styles/Login.css';
import './styles/LayoutSiswa.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
          <Route index element={<Dashboard />} />
          <Route path="puskesmas" element={<Puskesmas />} />
          <Route path="sekolah" element={<Sekolah />} />
          <Route path="admin" element={<Admin />} />
          <Route path="siswa" element={<Siswa />} />
          <Route path="profil" element={<Profil />} />
          <Route path="pengingat" element={<Pengingat />} />
          <Route path="pemantauan" element={<Pemantauan />} />
          <Route path="pengaturan/pesan" element={<PengaturanPesan />} />
          <Route path="kelas" element={<DataKelas />} />
          <Route path="hb/data" element={<DataHB />} />
          <Route path="hb/pemeriksaan" element={<PemeriksaanHB />} />

          
          {/* Route Stok Obat */}
          <Route path="stok" element={<DataObat />} />
          <Route path="stok/dinas" element={<StokDinas />} />
          <Route path="stok/puskesmas" element={<StokPuskesmas />} />
          <Route path="stok/sekolah" element={<StokSekolah />} />
          <Route path="stok/kadaluarsa" element={<Kadaluarsa />} />
        </Route>

        {/* Rute Khusus Siswa */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <LayoutSiswa />
            </ProtectedRoute>
          }>
          <Route index element={<DashboardSiswa />} />
          <Route path="riwayat-minum-obat" element={<RiwayatMinumObat />} />
          <Route path="reward" element={<RewardSiswa />} />
          <Route path="profil" element={<ProfilSiswa />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
