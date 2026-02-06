import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Cek di koleksi 'admins'
          let userDoc = await getDoc(doc(db, 'admins', user.uid));
          if (userDoc.exists()) {
            setCurrentUserData({ ...userDoc.data(), type: 'admin' });
          } else {
            // Jika tidak ada, cek di koleksi 'siswa'
            userDoc = await getDoc(doc(db, 'siswa', user.uid));
            if (userDoc.exists()) {
              setCurrentUserData({ ...userDoc.data(), type: 'siswa' });
            } else {
              setCurrentUserData(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setCurrentUserData(null);
        }
      } else {
        setCurrentUserData(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = { currentUser, currentUserData, loading };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}