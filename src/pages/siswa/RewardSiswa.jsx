import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { CheckCircle, Gift, Lock } from 'lucide-react';
import '../../styles/RewardSiswa.css';

export default function RewardSiswa() {
  const { currentUser } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyReports, setMonthlyReports] = useState({});
  const [monthlyClaims, setMonthlyClaims] = useState({});
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Ambil Laporan Minum Obat untuk tahun yang dipilih
        // Format tanggalLapor di database adalah "YYYY-MM-DD"
        const startOfYear = `${selectedYear}-01-01`;
        const endOfYear = `${selectedYear}-12-31`;
        
        const qReports = query(
          collection(db, "laporan_minum_obat"),
          where("siswaId", "==", currentUser.uid),
          where("tanggalLapor", ">=", startOfYear),
          where("tanggalLapor", "<=", endOfYear)
        );
        
        const reportsSnap = await getDocs(qReports);
        const reportsData = {};
        
        reportsSnap.forEach(doc => {
          const data = doc.data();
          // Parsing manual string YYYY-MM-DD untuk menghindari masalah timezone
          const monthIndex = parseInt(data.tanggalLapor.split('-')[1]) - 1; // 0-11
          
          if (!reportsData[monthIndex]) reportsData[monthIndex] = 0;
          reportsData[monthIndex]++;
        });
        setMonthlyReports(reportsData);

        // 2. Ambil Data Klaim (Poin Siswa) untuk tahun yang dipilih
        const qClaims = query(
          collection(db, "poin_siswa"),
          where("siswaId", "==", currentUser.uid),
          where("year", "==", parseInt(selectedYear))
        );
        
        const claimsSnap = await getDocs(qClaims);
        const claimsData = {};
        claimsSnap.forEach(doc => {
          const data = doc.data();
          claimsData[data.month] = true; // data.month disimpan sebagai 0-11
        });
        setMonthlyClaims(claimsData);

      } catch (error) {
        console.error("Error fetching reward data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, selectedYear]);

  const handleClaim = async (monthIndex) => {
    if (claiming) return;
    setClaiming(true);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Ambil Dokumen Siswa untuk update poin
        const userRef = doc(db, "siswa", currentUser.uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");

        const currentPoin = userDoc.data().poin || 0;

        // 2. Buat Dokumen Klaim Baru di 'poin_siswa'
        const claimRef = doc(collection(db, "poin_siswa"));
        transaction.set(claimRef, {
          siswaId: currentUser.uid,
          year: parseInt(selectedYear),
          month: monthIndex,
          points: 1,
          timestamp: serverTimestamp()
        });

        // 3. Update Poin di Profil Siswa
        transaction.update(userRef, {
          poin: currentPoin + 1
        });
      });

      // Update State Lokal agar UI berubah langsung
      setMonthlyClaims(prev => ({ ...prev, [monthIndex]: true }));
      alert("Selamat! Poin berhasil diklaim.");

    } catch (error) {
      console.error("Error claiming points:", error);
      alert("Gagal mengklaim poin.");
    } finally {
      setClaiming(false);
    }
  };

  // Generate Opsi Tahun (Tahun ini dan 2 tahun ke belakang)
  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear; i >= currentYear - 2; i--) {
    yearOptions.push(i);
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Memuat data poin...</div>;
  }

  return (
    <div className="reward-page">
      <div className="reward-header">
        <h1>Pengumpulan Poin</h1>
        <p>Kumpulkan poin dengan rutin minum obat setiap minggu.</p>
      </div>

      <div className="filter-container">
        <label>Tahun:</label>
        <select 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="year-select"
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="months-grid">
        {months.map((monthName, index) => {
          const reportCount = monthlyReports[index] || 0;
          const isClaimed = monthlyClaims[index];
          // Syarat klaim: minimal 4 laporan dan belum pernah diklaim
          const canClaim = reportCount >= 4 && !isClaimed;
          
          return (
            <div key={index} className={`month-card ${isClaimed ? 'claimed' : ''}`}>
              <div className="month-header">
                <h3>{monthName}</h3>
                {isClaimed && <span className="badge-claimed">Diklaim</span>}
              </div>
              
              <div className="checkmarks-container">
                {[1, 2, 3, 4, 5].map(step => (
                  <div key={step} className={`checkmark-item ${reportCount >= step ? 'active' : ''}`}>
                    <CheckCircle size={20} />
                  </div>
                ))}
              </div>

              <div className="card-footer">
                <p className="progress-text">
                  {Math.min(reportCount, 5)}/4 Minggu Terpenuhi
                </p>
                
                {canClaim ? (
                  <button 
                    className="claim-button" 
                    onClick={() => handleClaim(index)}
                    disabled={claiming}
                  >
                    <Gift size={16} />
                    {claiming ? '...' : 'Klaim Poin'}
                  </button>
                ) : isClaimed ? (
                   <button className="claim-button disabled" disabled>
                    <CheckCircle size={16} />
                    Selesai
                  </button>
                ) : (
                  <button className="claim-button disabled" disabled>
                    <Lock size={16} />
                    Belum Cukup
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
