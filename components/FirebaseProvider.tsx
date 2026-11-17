'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, testConnection } from '@/lib/firebase';

interface FirebaseContextValue {
  firebaseUser: User | null;
  authReady: boolean;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  firebaseUser: null,
  authReady: false,
});

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    void testConnection();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  return (
    <FirebaseContext.Provider value={{ firebaseUser, authReady }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebaseAuth() {
  return useContext(FirebaseContext);
}
