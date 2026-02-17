import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, documentId, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Stethoscope } from 'lucide-react';
import '../../styles/Siswa.css';
import '../../styles/Modal.css';

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
            <button type="submit" className="action-button save">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function PemeriksaanHB() {
  const { currentUserData } = useAuth();
  const [siswaList, setSiswaList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [masterHBList, setMasterHBList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [formData, setFormData] = useState({
    hbId: '',
    tanggal: new Date().toISOString().split('T')[0]
  });

  // Filter State
  const [filterPuskesmas, setFilterPuskesmas] = useState('');
  const [filterSekolah, setFilterSekolah] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [searchNama, setSearchNama] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    if (!currentUserData) return;

    try {
      const { role, relatedId } = currentUserData;
      let siswaPromise;
      let sekolahPromise;
      let kelasPromise;
      let puskesmasPromise = getDocs(collection(db, "puskesmas"));
      let masterHBPromise = getDocs(collection(db, "master_hb"));

      const siswaCollectionRef = collection(db, "siswa");
      const sekolahCollectionRef = collection(db, "sekolah");
      const kelasCollectionRef = collection(db, "kelas");

      if (role === 'Super Admin') {
        siswaPromise = getDocs(siswaCollectionRef);
        sekolahPromise = getDocs(sekolahCollectionRef);
        kelasPromise = getDocs(kelasCollectionRef);
      } else if (role === 'Admin Sekolah') {
        siswaPromise = getDocs(query(siswaCollectionRef, where("sekolahId", "==", relatedId)));
        sekolahPromise = getDocs(query(sekolahCollectionRef, where(documentId(), "==", relatedId)));
        kelasPromise = getDocs(query(kelasCollectionRef, where("sekolahId", "==", relatedId)));
      } else if (role === 'Admin Puskesmas') {
        const schoolsQuery = query(collection(db, "sekolah"), where("puskesmasId", "==", relatedId));
        const schoolsSnap = await getDocs(schoolsQuery);
        const schoolIds = schoolsSnap.docs.map(doc => doc.id);

        if (schoolIds.length > 0) {
          siswaPromise = getDocs(query(siswaCollectionRef, where("sekolahId", "in", schoolIds)));
          kelasPromise = getDocs(query(kelasCollectionRef, where("sekolahId", "in", schoolIds)));
          setSekolahList(schoolsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
          sekolahPromise = Promise.resolve(null);
        } else {
          setSiswaList([]);
          setSekolahList([]);
          setKelasList([]);
          setMasterHBList([]);
          setLoading(false);
          return;
        }
      } else {
        setLoading(false);
        return;
      }

      const [siswaSnap, sekolahSnap, puskesmasSnap, kelasSnap, masterHBSnap] = await Promise.all([
        siswaPromise, sekolahPromise, puskesmasPromise, kelasPromise, masterHBPromise
      ]);

      if (siswaSnap) setSiswaList(siswaSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      if (sekolahSnap) setSekolahList(sekolahSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      if (puskesmasSnap) setPuskesmasList(puskesmasSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      if (kelasSnap) setKelasList(kelasSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      if (masterHBSnap) {
        const items = masterHBSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        const order = ['anemia berat', 'anemia sedang', 'anemia ringan', 'normal'];
        items.sort((a, b) => {
          const statusA = (a.status || '').toLowerCase();
          const statusB = (b.status || '').toLowerCase();
          let indexA = order.findIndex(key => statusA.includes(key));
          let indexB = order.findIndex(key => statusB.includes(key));
          if (indexA === -1) indexA = 99;
          if (indexB === -1) indexB = 99;
          return indexA - indexB;
        });
        setMasterHBList(items);
      }

    } catch (err) {
      console.error("Error fetching data:", err);
      alert("Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserData) {
      fetchData();
    }
  }, [currentUserData]);

  // Set default filter based on role
  useEffect(() => {
    if (currentUserData) {
      if (currentUserData.role === 'Admin Puskesmas') {
        setFilterPuskesmas(currentUserData.relatedId);
      } else if (currentUserData.role === 'Admin Sekolah') {
        setFilterSekolah(currentUserData.relatedId);
      }
    }
  }, [currentUserData]);

  useEffect(() => {
    if (currentUserData?.role === 'Admin Sekolah' && sekolahList.length > 0) {
      const mySchool = sekolahList.find(s => s.id === currentUserData.relatedId);
      if (mySchool) {
        setFilterPuskesmas(mySchool.puskesmasId);
      }
    }
  }, [currentUserData, sekolahList]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterPuskesmas, filterSekolah, filterKelas, searchNama]);

  const filteredSiswa = useMemo(() => {
    return siswaList.filter(item => {
      const matchPuskesmas = filterPuskesmas ? (() => {
        const school = sekolahList.find(s => s.id === item.sekolahId);
        return school && school.puskesmasId === filterPuskesmas;
      })() : true;

      const matchSekolah = filterSekolah ? item.sekolahId === filterSekolah : true;
      const matchKelas = filterKelas ? item.kelasId === filterKelas : true;
      const matchNama = searchNama ? item.nama.toLowerCase().includes(searchNama.toLowerCase()) : true;

      return matchPuskesmas && matchSekolah && matchKelas && matchNama;
    });
  }, [siswaList, filterPuskesmas, filterSekolah, filterKelas, searchNama, sekolahList]);

  const getSekolahName = (id) => {
    const s = sekolahList.find(item => item.id === id);
    return s ? s.nama : '-';
  };

  const getKelasName = (item) => {
    if (item.kelasId) {
      const k = kelasList.find(k => k.id === item.kelasId);
      return k ? k.namaKelas : item.kelas;
    }
    return item.kelas;
  };

  const handlePeriksa = (siswa) => {
    setSelectedSiswa(siswa);
    setFormData({
      hbId: '',
      tanggal: new Date().toISOString().split('T')[0]
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedSiswa(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSiswa || !formData.hbId || !formData.tanggal) {
      alert("Mohon lengkapi data pemeriksaan.");
      return;
    }

    const selectedHB = masterHBList.find(hb => hb.id === formData.hbId);
    if (!selectedHB) {
      alert("Data HB tidak valid.");
      return;
    }

    try {
      // 1. Simpan ke collection pemeriksaan_hb (History)
      await addDoc(collection(db, "pemeriksaan_hb"), {
        siswaId: selectedSiswa.id,
        namaSiswa: selectedSiswa.nama,
        sekolahId: selectedSiswa.sekolahId,
        hbId: selectedHB.id,
        kadarHB: selectedHB.kadarHB,
        status: selectedHB.status,
        warna: selectedHB.warna,
        tanggalPemeriksaan: formData.tanggal,
        createdAt: serverTimestamp()
      });

      // 2. Update dokumen siswa (Denormalisasi untuk tampilan tabel)
      const updateData = {
        lastPemeriksaan: {
          hbId: selectedHB.id,
          kadarHB: selectedHB.kadarHB,
          status: selectedHB.status,
          warna: selectedHB.warna,
          tanggal: formData.tanggal
        }
      };
      
      await updateDoc(doc(db, "siswa", selectedSiswa.id), updateData);

      // 3. Update local state agar tabel langsung berubah
      setSiswaList(prev => prev.map(s => 
        s.id === selectedSiswa.id ? { ...s, ...updateData } : s
      ));

      handleCloseModal();
      alert("Data pemeriksaan berhasil disimpan.");
    } catch (err) {
      console.error("Error saving pemeriksaan:", err);
      alert("Gagal menyimpan data.");
    }
  };

  // Helper untuk menampilkan status di modal saat dropdown dipilih
  const getSelectedHBDetails = () => {
    if (!formData.hbId) return null;
    return masterHBList.find(hb => hb.id === formData.hbId);
  };

  const selectedHBDetails = getSelectedHBDetails();

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSiswa.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSiswa.length / itemsPerPage);

  return (
    <div className="siswa-container">
      <div className="page-header">
        <h1>Pemeriksaan HB</h1>
      </div>

      {/* Filter Section */}
      <div className="filters" style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select 
          value={filterPuskesmas} 
          onChange={e => { setFilterPuskesmas(e.target.value); setFilterSekolah(''); setFilterKelas(''); }} 
          disabled={currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah'}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '200px', backgroundColor: (currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah') ? '#f3f4f6' : 'white' }}
        >
          <option value="">Semua Puskesmas</option>
          {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>

        <select 
          value={filterSekolah} 
          onChange={e => { setFilterSekolah(e.target.value); setFilterKelas(''); }} 
          disabled={currentUserData?.role === 'Admin Sekolah'}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '200px', backgroundColor: currentUserData?.role === 'Admin Sekolah' ? '#f3f4f6' : 'white' }}
        >
          <option value="">Semua Sekolah</option>
          {sekolahList
            .filter(s => !filterPuskesmas || s.puskesmasId === filterPuskesmas)
            .map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>

        <select 
          value={filterKelas} 
          onChange={e => setFilterKelas(e.target.value)} 
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '120px' }}
          disabled={!filterSekolah}
        >
          <option value="">Semua Kelas</option>
          {kelasList
            .filter(k => k.sekolahId === filterSekolah)
            .sort((a, b) => a.namaKelas.localeCompare(b.namaKelas))
            .map(k => <option key={k.id} value={k.id}>{k.namaKelas}</option>)}
        </select>

        <input 
          type="text" 
          placeholder="Cari Nama Siswa..." 
          value={searchNama} 
          onChange={e => setSearchNama(e.target.value)}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', flex: 1, minWidth: '200px' }}
        />
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Sekolah</th>
              <th>Nama Siswa</th>
              <th>Kelas</th>
              <th>HB</th>
              <th>Status</th>
              <th>Tanggal Pemeriksaan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, index) => (
              <tr key={item.id}>
                <td>{indexOfFirstItem + index + 1}</td>
                <td>{getSekolahName(item.sekolahId)}</td>
                <td>{item.nama}</td>
                <td>{getKelasName(item)}</td>
                <td>{item.lastPemeriksaan?.kadarHB || '-'}</td>
                <td>
                  {item.lastPemeriksaan ? (
                    <span 
                      className="status-badge" 
                      style={{ 
                        backgroundColor: item.lastPemeriksaan.warna, 
                        color: '#000'
                      }}
                    >
                      {item.lastPemeriksaan.status}
                    </span>
                  ) : '-'}
                </td>
                <td>{item.lastPemeriksaan?.tanggal || '-'}</td>
                <td>
                  <button 
                    className="action-button" 
                    onClick={() => handlePeriksa(item)}
                    style={{ backgroundColor: '#0d9488', color: 'white', borderColor: '#0f766e', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Stethoscope size={14} /> Periksa
                  </button>
                </td>
              </tr>
            ))}
            {filteredSiswa.length === 0 && !loading && (
              <tr><td colSpan="8" style={{ textAlign: 'center' }}>Tidak ada data siswa.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Prev</button>
        <span style={{ fontSize: '0.9rem' }}>Halaman {currentPage} dari {totalPages || 1}</span>
        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Next</button>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} title={`Periksa HB: ${selectedSiswa?.nama || ''}`}>
        <div className="input-group">
          <label>Tanggal Pemeriksaan</label>
          <input 
            type="date" 
            value={formData.tanggal} 
            onChange={e => setFormData({...formData, tanggal: e.target.value})} 
            required 
          />
        </div>
        <div className="input-group">
          <label>Kadar HB</label>
          <select 
            value={formData.hbId} 
            onChange={e => setFormData({...formData, hbId: e.target.value})} 
            required
          >
            <option value="">-- Pilih Kadar HB --</option>
            {masterHBList.map(hb => (
              <option key={hb.id} value={hb.id}>{hb.kadarHB}</option>
            ))}
          </select>
        </div>

        {selectedHBDetails && (
          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600', color: '#555' }}>Status:</span>
              <span style={{ fontWeight: 'bold' }}>{selectedHBDetails.status}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', color: '#555' }}>Warna Indikator:</span>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: selectedHBDetails.warna, border: '2px solid #fff', boxShadow: '0 0 0 1px #ddd' }}></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
