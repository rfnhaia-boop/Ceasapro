import { create } from 'zustand';
import { User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { UserProfile, getUserProfile, createUserProfile, createCompany } from '../lib/db';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  refreshProfile: () => Promise<void>;
  initializeAuthListener: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const p = await getUserProfile(user.uid);
      set({ profile: p });
    }
  },
  initializeAuthListener: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      set({ user: firebaseUser });
      if (firebaseUser) {
        let userProfile = await getUserProfile(firebaseUser.uid);
        if (!userProfile) {
          // Primeiro login: cria perfil como admin
          await createUserProfile(firebaseUser.uid, {
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'Novo Usuário',
            role: 'admin',
          });
          userProfile = await getUserProfile(firebaseUser.uid);
        }

        // Se admin sem empresa, cria empresa automaticamente
        if (userProfile && !userProfile.companyId) {
          try {
            const companyName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Minha Empresa';
            await createCompany(firebaseUser.uid, companyName);
            userProfile = await getUserProfile(firebaseUser.uid);
          } catch (e) {
            console.warn('Auto-create company failed (Firestore rules may need deploying):', e);
          }
        }

        if (userProfile && userProfile.role !== 'admin' && firebaseUser.email === 'rfnhaia@gmail.com') {
          try {
            await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
            userProfile!.role = 'admin';
          } catch (e) {
            console.warn('Role upgrade failed:', e);
          }
        }
        set({ profile: userProfile });
      } else {
        set({ profile: null });
      }
      set({ loading: false });
    });
  }
}));
