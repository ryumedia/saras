import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, firebaseConfig } from '../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc, setDoc, query, where, documentId, writeBatch } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import '../styles/Siswa.css';
import '../styles/Modal.css';

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

const ImportGuideModal = ({ isOpen, onClose, onFileSelect }) => {
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleChooseFile = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Panduan Import Data Siswa</h2>
        <p style={{ lineHeight: 1.6, fontSize: '0.95em' }}>
          Pastikan file Excel Anda memiliki 7 kolom dengan Header (baris pertama) sebagai berikut (huruf besar/kecil berpengaruh):
        </p>
        <ul className="import-guide-list" style={{ paddingLeft: '20px', lineHeight: 1.7 }}>
          <li><strong>Nama:</strong> Nama lengkap siswa.</li>
          <li><strong>Email:</strong> Email unik untuk login.</li>
          <li><strong>Password:</strong> Password untuk login (minimal 6 karakter).</li>
          <li><strong>WA:</strong> Nomor WhatsApp (diawali 08... atau 628...).</li>
          <li><strong>Kelas:</strong> Angka kelas (contoh: 7, 8, 9).</li>
          <li><strong>Sekolah:</strong> Nama sekolah (harus persis sama dengan yang ada di sistem).</li>
          <li><strong>Status:</strong> (Opsional) Isi 'Aktif'.</li>
        </ul>
        <p style={{ marginTop: '15px' }}>
          Atau Anda bisa <a href="https://docs.google.com/spreadsheets/d/1pBx0AGX4xMdjhAUXliuUWkXsEcfflt3I/export?format=xlsx" target="_blank" rel="noopener noreferrer" className="template-link" style={{ color: '#2563eb', fontWeight: 'bold' }}>download file template di sini</a>.
        </p>
        <input type="file" ref={fileInputRef} onChange={onFileSelect} style={{ display: 'none' }} accept=".xlsx, .xls" />
        <div className="modal-actions">
          <button type="button" className="action-button cancel" onClick={onClose}>Batal</button>
          <button type="button" className="action-button save" onClick={handleChooseFile}>Pilih File & Import</button>
        </div>
      </div>
    </div>
  );
};

export default function Siswa() {
  const { currentUserData } = useAuth();
  const [siswaList, setSiswaList] = useState([]);
  const [sekolahList, setSekolahList] = useState([]);
  const [puskesmasList, setPuskesmasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // null, 'form', 'import'
  const [editId, setEditId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State Filter
  const [filterPuskesmas, setFilterPuskesmas] = useState('');
  const [filterSekolah, setFilterSekolah] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [searchNama, setSearchNama] = useState('');

  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    wa: '',
    kelas: '7',
    sekolahId: '',
    status: 'Aktif',
    password: ''
  });

  const siswaCollectionRef = collection(db, "siswa");
  const sekolahCollectionRef = collection(db, "sekolah");

  const fetchData = async () => {
    setLoading(true);
    if (!currentUserData) return; // Tunggu data user

    try {
      const { role, relatedId } = currentUserData;
      let siswaPromise;
      let sekolahPromise;
      let puskesmasPromise = getDocs(collection(db, "puskesmas")); // Selalu ambil untuk filter

      if (role === 'Super Admin') {
        siswaPromise = getDocs(siswaCollectionRef);
        sekolahPromise = getDocs(sekolahCollectionRef);
        // puskesmasPromise sudah didefinisikan
      } else if (role === 'Admin Sekolah') {
        siswaPromise = getDocs(query(siswaCollectionRef, where("sekolahId", "==", relatedId)));
        sekolahPromise = getDocs(query(sekolahCollectionRef, where(documentId(), "==", relatedId)));
      } else if (role === 'Admin Puskesmas') {
        const schoolsQuery = query(collection(db, "sekolah"), where("puskesmasId", "==", relatedId));
        const schoolsSnap = await getDocs(schoolsQuery);
        const schoolIds = schoolsSnap.docs.map(doc => doc.id);

        if (schoolIds.length > 0) {
          siswaPromise = getDocs(query(siswaCollectionRef, where("sekolahId", "in", schoolIds)));
          // Gunakan data sekolah yang sudah di-fetch
          setSekolahList(schoolsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
          sekolahPromise = Promise.resolve(null); // Tidak perlu fetch lagi
        } else {
          // Tidak ada sekolah binaan, berarti tidak ada siswa
          setSiswaList([]);
          setSekolahList([]);
          setLoading(false);
          return;
        }
      } else {
        // Role tidak dikenali atau tidak punya akses
        setSiswaList([]);
        setSekolahList([]);
        setLoading(false);
        return;
      }

      const [siswaSnap, sekolahSnap, puskesmasSnap] = await Promise.all([siswaPromise, sekolahPromise, puskesmasPromise]);

      if (siswaSnap) {
        setSiswaList(siswaSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      }
      if (sekolahSnap) {
        setSekolahList(sekolahSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      }
      if (puskesmasSnap) {
        setPuskesmasList(puskesmasSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
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

  // Set default filter berdasarkan role
  useEffect(() => {
    if (currentUserData) {
      if (currentUserData.role === 'Admin Puskesmas') {
        setFilterPuskesmas(currentUserData.relatedId);
      } else if (currentUserData.role === 'Admin Sekolah') {
        setFilterSekolah(currentUserData.relatedId);
      }
    }
  }, [currentUserData]);

  // Set Puskesmas filter untuk Admin Sekolah setelah data sekolah termuat
  useEffect(() => {
    if (currentUserData?.role === 'Admin Sekolah' && sekolahList.length > 0) {
      const mySchool = sekolahList.find(s => s.id === currentUserData.relatedId);
      if (mySchool) {
        setFilterPuskesmas(mySchool.puskesmasId);
      }
    }
  }, [currentUserData, sekolahList]);

  // Reset halaman saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [filterPuskesmas, filterSekolah, filterKelas, searchNama]);

  // Logic Filter
  const filteredSiswa = useMemo(() => {
    return siswaList.filter(item => {
      const matchPuskesmas = filterPuskesmas ? (() => {
        const school = sekolahList.find(s => s.id === item.sekolahId);
        return school && school.puskesmasId === filterPuskesmas;
      })() : true;

      const matchSekolah = filterSekolah ? item.sekolahId === filterSekolah : true;
      const matchKelas = filterKelas ? item.kelas === filterKelas : true;
      const matchNama = searchNama ? item.nama.toLowerCase().includes(searchNama.toLowerCase()) : true;

      return matchPuskesmas && matchSekolah && matchKelas && matchNama;
    });
  }, [siswaList, filterPuskesmas, filterSekolah, filterKelas, searchNama, sekolahList]);


  const handleOpenModal = () => {
    setEditId(null);
    const initialData = { nama: '', email: '', wa: '', kelas: '7', sekolahId: '', status: 'Aktif', password: '' };
    // Otomatis isi sekolah jika yang login adalah Admin Sekolah
    if (currentUserData?.role === 'Admin Sekolah') {
      initialData.sekolahId = currentUserData.relatedId;
    }
    setFormData(initialData);
    setActiveModal('form');
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setFormData({
      nama: item.nama,
      email: item.email,
      wa: item.wa,
      kelas: item.kelas,
      sekolahId: item.sekolahId,
      status: item.status,
      password: '' // Password tidak diedit di sini
    });
    setActiveModal('form');
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setEditId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.wa.startsWith('62')) {
      alert("Nomor WA harus diawali dengan 62");
      return;
    }
    if (!formData.sekolahId) {
      alert("Silakan pilih Sekolah");
      return;
    }

    try {
      if (editId) {
        // Update data siswa (tanpa password)
        const { password, ...updateData } = formData;
        await updateDoc(doc(db, "siswa", editId), updateData);
      } else {
        if (!formData.password) {
          alert("Password wajib diisi untuk siswa baru");
          return;
        }

        // Buat User di Firebase Auth menggunakan Secondary App
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const uid = userCredential.user.uid;

        // Simpan data ke Firestore dengan ID = UID
        await setDoc(doc(db, "siswa", uid), {
          nama: formData.nama,
          email: formData.email,
          wa: formData.wa,
          kelas: formData.kelas,
          sekolahId: formData.sekolahId,
          status: formData.status,
          createdAt: new Date()
        });

        await signOut(secondaryAuth);
        deleteApp(secondaryApp);
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      console.error("Error saving siswa:", err);
      alert("Gagal menyimpan data siswa: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin ingin menghapus data siswa ini?")) {
      try {
        await deleteDoc(doc(db, "siswa", id));
        fetchData();
      } catch (err) {
        console.error("Error deleting:", err);
        alert("Gagal menghapus data.");
      }
    }
  };

  // Fungsi Import Excel
  const handleImportClick = () => {
    setActiveModal('import');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setActiveModal(null); // Tutup modal panduan setelah file dipilih
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let secondaryApp;
      try {
        secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let successCount = 0;
        let failCount = 0;

        for (const row of data) {
          const email = row.Email;
          const password = row.Password;
          const nama = row.Nama;

          if (!email || !password) {
            console.warn("Skip baris: Email atau Password kosong", row);
            failCount++;
            continue;
          }

          try {
            // 1. Buat User di Authentication
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, String(password));
            const uid = userCredential.user.uid;

            // 2. Siapkan Data Firestore
            const sekolahObj = sekolahList.find(s => s.nama.toLowerCase() === (row.Sekolah || '').toLowerCase());
            
            // Handle WA (Pastikan string dan format 62)
            let wa = row.WA ? String(row.WA) : '';
            if (wa.startsWith('0')) {
              wa = '62' + wa.slice(1);
            }

            // 3. Simpan ke Firestore dengan ID = UID
            await setDoc(doc(db, "siswa", uid), {
              nama: nama || '',
              email: email,
              wa: wa,
              kelas: row.Kelas ? String(row.Kelas) : '7',
              sekolahId: sekolahObj ? sekolahObj.id : '',
              status: row.Status || 'Aktif',
              createdAt: new Date()
            });

            successCount++;
          } catch (err) {
            console.error(`Gagal import ${nama} (${email}):`, err);
            failCount++;
          }
        }

        alert(`Import selesai!\nBerhasil: ${successCount}\nGagal: ${failCount}`);
        fetchData();
      } catch (err) {
        console.error("Error importing:", err);
        alert("Gagal mengimpor file Excel.");
      } finally {
        if (secondaryApp) {
          try {
            await deleteApp(secondaryApp);
          } catch (e) {
            console.error("Error deleting secondary app", e);
          }
        }
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  const getSekolahName = (id) => {
    const s = sekolahList.find(item => item.id === id);
    return s ? s.nama : '-';
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSiswa.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSiswa.length / itemsPerPage);

  return (
    <div className="siswa-container">
      <div className="page-header">
        <h1>Data Siswa</h1>
        <div className="header-actions">
          <button className="import-button" onClick={handleImportClick}>Import Excel</button>
          <button className="add-button" onClick={handleOpenModal}>Tambah Siswa</button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="filters" style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select 
          value={filterPuskesmas} 
          onChange={e => { setFilterPuskesmas(e.target.value); setFilterSekolah(''); }} 
          disabled={currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah'}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '200px', backgroundColor: (currentUserData?.role === 'Admin Puskesmas' || currentUserData?.role === 'Admin Sekolah') ? '#f3f4f6' : 'white' }}
        >
          <option value="">Semua Puskesmas</option>
          {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>

        <select 
          value={filterSekolah} 
          onChange={e => setFilterSekolah(e.target.value)} 
          disabled={currentUserData?.role === 'Admin Sekolah'}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '200px', backgroundColor: currentUserData?.role === 'Admin Sekolah' ? '#f3f4f6' : 'white' }}
        >
          <option value="">Semua Sekolah</option>
          {sekolahList
            .filter(s => !filterPuskesmas || s.puskesmasId === filterPuskesmas)
            .map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>

        <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '120px' }}>
          <option value="">Semua Kelas</option>
          {[7, 8, 9, 10, 11, 12].map(k => <option key={k} value={String(k)}>{k}</option>)}
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
              <th>Nama</th>
              <th>Email</th>
              <th>No. WA</th>
              <th>Kelas</th>
              <th>Sekolah</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, index) => (
              <tr key={item.id}>
                <td>{indexOfFirstItem + index + 1}</td>
                <td>{item.nama}</td>
                <td>{item.email}</td>
                <td>{item.wa}</td>
                <td>{item.kelas}</td>
                <td>{getSekolahName(item.sekolahId)}</td>
                <td>
                  <span className={`status-badge ${item.status.toLowerCase().replace(/\s/g, '-')}`}>
                    {item.status}
                  </span>
                </td>
                <td>
                  <button className="action-button edit" onClick={() => handleEdit(item)}>Edit</button>
                  <button className="action-button delete" onClick={() => handleDelete(item.id)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Prev</button>
        <span style={{ fontSize: '0.9rem' }}>Halaman {currentPage} dari {totalPages || 1}</span>
        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>Next</button>
      </div>

      <ImportGuideModal 
        isOpen={activeModal === 'import'}
        onClose={handleCloseModal}
        onFileSelect={handleFileChange}
      />

      <Modal isOpen={activeModal === 'form'} onClose={handleCloseModal} onSubmit={handleSubmit} title={editId ? "Edit Siswa" : "Tambah Siswa Baru"}>
        <div className="input-group">
          <label>Nama</label>
          <input type="text" name="nama" value={formData.nama} onChange={handleInputChange} required />
        </div>
        <div className="input-group">
          <label>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
        </div>
        {!editId && (
          <div className="input-group">
            <label>Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleInputChange} required />
          </div>
        )}
        <div className="input-group">
          <label>No. WA (Format: 628...)</label>
          <input type="text" name="wa" value={formData.wa} onChange={handleInputChange} required placeholder="628..." />
        </div>
        <div className="input-group">
          <label>Kelas</label>
          <select name="kelas" value={formData.kelas} onChange={handleInputChange}>
            {[7, 8, 9, 10, 11, 12].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>Sekolah</label>
          <select name="sekolahId" value={formData.sekolahId} onChange={handleInputChange} required disabled={currentUserData?.role === 'Admin Sekolah'}>
            <option value="">-- Pilih Sekolah --</option>
            {sekolahList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>Status</label>
          <select name="status" value={formData.status} onChange={handleInputChange}>
            <option value="Aktif">Aktif</option>
            <option value="Tidak Aktif">Tidak Aktif</option>
            <option value="Lulus">Lulus</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}