'use client';

import { useEffect } from 'react';
import { useAuth, useUser, initiateAnonymousSignIn, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Automatically signs the user in anonymously if they aren't authenticated.
 * Also initializes the Admin role for the first user session.
 */
export function AuthInitializer() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  useEffect(() => {
    if (user && firestore) {
      // Auto-initialize Admin role for the first user in the prototype
      const adminRef = doc(firestore, 'adminUsers', user.uid);
      getDoc(adminRef).then(snap => {
        if (!snap.exists()) {
          setDoc(adminRef, { 
            id: user.uid, 
            username: user.displayName || 'Admin', 
            email: user.email,
            roleId: 'Admin',
            isActive: true,
            createdAt: new Date().toISOString() 
          });
          // Also create the user profile
          setDoc(doc(firestore, 'users', user.uid), {
            id: user.uid,
            username: user.displayName || 'Admin',
            email: user.email,
            firstName: 'System',
            lastName: 'Admin',
            roleId: 'Admin',
            isActive: true,
            createdAt: new Date().toISOString()
          });
        }
      });
    }
  }, [user, firestore]);

  return null;
}