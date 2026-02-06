import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import '../../styles/Modal.css';
import { Bell } from 'lucide-react';
import { Award } from 'lucide-react';

const Modal = ({ isOpen, onClose, onSubmit, children, title }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={onSubmit}>
          <h2>{title}</h2>
          {children}
          <div className="modal-actions">
            <button type="button" className="action-button cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="action-button save">Kirim</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function DashboardSiswa() {
  const { currentUser, currentUserData } = useAuth();
  const navigate = useNavigate();
  const [sisaObat, setSisaObat] = useState(0);
  const [stokList, setStokList] = useState([]);
  const [poin, setPoin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasReportedToday, setHasReportedToday] = useState(false);
  
  const [isModalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    obatId: '',
    jumlah: 1,
    confirmed: false
  });

  useEffect(() => {
    if (!currentUserData) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Ambil data sisa obat dari siswa_stok (Stok Pribadi)
        const qStok = query(collection(db, "siswa_stok"), where("siswaId", "==", currentUser.uid));
        const stokSnap = await getDocs(qStok);
        const list = stokSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStokList(list);
        const totalStok = list.reduce((acc, curr) => acc + (curr.stok || 0), 0);
        setSisaObat(totalStok);

        // 2. Ambil data poin dari collection 'poin_siswa'
        const qPoin = query(collection(db, "poin_siswa"), where("siswaId", "==", currentUser.uid));
        const poinSnap = await getDocs(qPoin);
        const totalPoin = poinSnap.docs.reduce((acc, doc) => acc + (doc.data().points || 0), 0);
        setPoin(totalPoin);

        // 3. Cek apakah sudah lapor hari ini
        const today = new Date().toISOString().split('T')[0];
        const qLaporan = query(collection(db, "laporan_minum_obat"), 
          where("siswaId", "==", currentUser.uid),
          where("tanggalLapor", "==", today)
        );
        const laporanSnap = await getDocs(qLaporan);
        setHasReportedToday(!laporanSnap.empty);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, currentUserData]);

  const handleOpenModal = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      obatId: '',
      jumlah: 1,
      confirmed: false
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleNotificationClick = () => {
    if (hasReportedToday) {
      alert("Hebat! Kamu sudah minum obat hari ini.");
    } else {
      alert("Jangan lupa minum obat hari ini ya!");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.obatId) {
      alert("Silakan pilih obat.");
      return;
    }
    if (!formData.confirmed) {
      alert("Anda harus mencentang konfirmasi bahwa sudah minum obat.");
      return;
    }

    const selectedObat = stokList.find(item => item.id === formData.obatId);
    if (!selectedObat) {
      alert("Data obat tidak valid.");
      return;
    }
    if (selectedObat.stok < formData.jumlah) {
      alert(`Stok obat tidak mencukupi. Sisa: ${selectedObat.stok}`);
      return;
    }

    try {
      // Cek apakah sudah minum obat pekan ini
      const date = new Date(formData.tanggal);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Senin sebagai awal pekan
      const monday = new Date(date.setDate(diff));
      const sunday = new Date(date.setDate(diff + 6));
      
      const startOfWeek = monday.toISOString().split('T')[0];
      const endOfWeek = sunday.toISOString().split('T')[0];

      const qCheck = query(collection(db, "laporan_minum_obat"), 
        where("siswaId", "==", currentUser.uid),
        where("tanggalLapor", ">=", startOfWeek),
        where("tanggalLapor", "<=", endOfWeek)
      );
      
      const checkSnap = await getDocs(qCheck);
      if (!checkSnap.empty) {
        alert("Kamu sudah minum obat pekan ini, jangan lupa minum obat lagi pekan depan");
        return;
      }

      // 1. Simpan laporan ke firestore (untuk riwayat)
      await addDoc(collection(db, "laporan_minum_obat"), {
        siswaId: currentUser.uid,
        namaSiswa: currentUserData.nama,
        sekolahId: currentUserData.sekolahId,
        tanggalLapor: formData.tanggal,
        obatId: selectedObat.obatId,
        namaObat: selectedObat.namaObat,
        jumlah: parseInt(formData.jumlah),
        timestamp: serverTimestamp()
      });

      // 2. Catat di siswa_transaksi
      await addDoc(collection(db, "siswa_transaksi"), {
        siswaId: currentUser.uid,
        obatId: selectedObat.obatId,
        namaObat: selectedObat.namaObat,
        tipe: 'keluar',
        keterangan: 'Minum Obat Harian',
        jumlah: parseInt(formData.jumlah),
        tanggal: formData.tanggal,
        timestamp: serverTimestamp()
      });

      // 3. Kurangi stok siswa (siswa_stok)
      await updateDoc(doc(db, "siswa_stok", formData.obatId), {
        stok: (selectedObat.stok || 0) - parseInt(formData.jumlah)
      });

      // Update UI lokal
      setStokList(prev => prev.map(item => 
        item.id === formData.obatId ? { ...item, stok: item.stok - parseInt(formData.jumlah) } : item
      ));
      setSisaObat(prev => prev - parseInt(formData.jumlah));
      
      // Di sini Anda bisa menambahkan logika untuk update poin, dll.
      // Update status lapor hari ini jika tanggal yang dipilih adalah hari ini
      if (formData.tanggal === new Date().toISOString().split('T')[0]) {
        setHasReportedToday(true);
      }

      alert("Laporan berhasil dikirim! Terima kasih sudah sehat hari ini.");
      handleCloseModal();
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("Gagal mengirim laporan.");
    }
  };

  if (loading) {
    return <div className="p-4">Memuat data...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Hai, {currentUserData?.nama} 👋!</h1>
          <p className="text-gray-500">Selamat datang kembali. Tetap sehat ya!</p>
        </div>
      </div>

      {/* Kartu Informasi */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-teal-100 p-4 rounded-lg shadow text-center">
          <div className="flex justify-center items-center gap-2">
            <h3 className="font-bold text-teal-800">Sisa Obat</h3>
            <div className="relative cursor-pointer" onClick={handleNotificationClick}>
              <Bell size={24} className={`text-teal-700 ${!hasReportedToday ? 'bell-swing' : ''}`} />
              {!hasReportedToday && (
                <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full ring-2 ring-teal-100 bg-red-500"></span>
              )}
            </div>
          </div>
          <p className="text-3xl font-bold text-teal-600 mt-1 leading-tight">{sisaObat}</p>
          <span className="text-sm text-teal-700">Tablet</span>
        </div>
        <div className="bg-amber-100 p-4 rounded-lg shadow text-center">
          <div className="flex justify-center items-center gap-2">
            <h3 className="font-bold text-amber-800">Poin Reward</h3>
            <div className="relative cursor-pointer" onClick={() => navigate("/app/reward")}>
              <Award size={24} className="text-amber-700" />
            </div>
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-1 leading-tight">{poin}</p>
          <span className="text-sm text-amber-700">Poin</span>
        </div>
      </div>

      {/* Tombol Aksi Utama */}
      <div className="text-center">
        <button 
          onClick={handleOpenModal}
          className="main-action-button"
        >
          Lapor Minum Obat
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} title="Laporan Minum Obat">
        <div className="input-group">
          <label>Pilih Tanggal</label>
          <input 
            type="date" 
            value={formData.tanggal} 
            onChange={e => setFormData({...formData, tanggal: e.target.value})} 
            required 
          />
        </div>
        <div className="input-group">
          <label>Pilih Obat</label>
          <select value={formData.obatId} onChange={e => setFormData({...formData, obatId: e.target.value})} required>
            <option value="">-- Pilih Obat --</option>
            {stokList.filter(s => s.stok > 0).map(item => (
              <option key={item.id} value={item.id}>{item.namaObat} (Sisa: {item.stok})</option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label>Jumlah</label>
          <input type="number" min="1" value={formData.jumlah} onChange={e => setFormData({...formData, jumlah: e.target.value})} required />
        </div>
        <label className="confirmation-checkbox">
          <input type="checkbox" checked={formData.confirmed} onChange={e => setFormData({...formData, confirmed: e.target.checked})} />
          <span>Saya sudah minum obat</span>
        </label>
      </Modal>
    </div>
  );
}
