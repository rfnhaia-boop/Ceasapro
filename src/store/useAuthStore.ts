import { create } from 'zustand';
import { User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { UserProfile, getUserProfile, createUserProfile } from '../lib/db';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  initializeAuthListener: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  initializeAuthListener: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      set({ user: firebaseUser });
      if (firebaseUser) {
        let userProfile = await getUserProfile(firebaseUser.uid);
        if (!userProfile) {
          // Attempt to create profile on first login (defaulting to admin so the app creator can test it)
          await createUserProfile(firebaseUser.uid, {
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'Novo Usuário',
            role: 'admin', 
          });
          userProfile = await getUserProfile(firebaseUser.uid);
        } else if (userProfile.role !== 'admin' && firebaseUser.email === 'rfnhaia@gmail.com') {
          // Auto-upgrade the main user if they logged in previously and got stuck as 'picker'
          await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
          userProfile.role = 'admin';
        }
        set({ profile: userProfile });
      } else {
        set({ profile: null });
      }
      set({ loading: false });
    });
  }
}));
