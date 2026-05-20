import { db } from './firebase';
import { collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs, onSnapshot, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './error';

export type UserRole = 'admin' | 'picker' | 'driver';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  createdAt: any;
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  createdAt: any;
}

export interface Order {
  id: string;
  companyId: string;
  clientName: string;
  originalText: string;
  status: 'pending' | 'picking' | 'ready' | 'delivered';
  nfNumber?: string;
  createdAt: any;
  createdBy: string;
  driverId?: string;
  deliveryNotes?: string;
  deliveryPhotos?: string[];
  deliveryStartedAt?: any;
  deliveryCompletedAt?: any;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: string; // e.g. "40Un", "5Kg"
  isPicked: boolean;
}

export interface OrderBlock {
  id: string;
  companyId: string;
  orderId: string;
  supplierName: string;
  status: 'pending' | 'picking' | 'completed';
  items: OrderItem[];
  pickerId?: string;
  arrivedAt?: any;
  completedAt?: any;
  photos?: string[];
}

export const createUserProfile = async (userId: string, data: Partial<UserProfile>) => {
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, {
      email: data.email,
      name: data.name,
      role: data.role || 'picker',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'users');
  }
};

export const createCompany = async (ownerId: string, companyName: string): Promise<string> => {
  try {
    const companyRef = doc(collection(db, 'companies'));
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await setDoc(companyRef, {
      name: companyName,
      ownerId,
      inviteCode,
      createdAt: serverTimestamp(),
    });
    
    // update user 
    await updateDoc(doc(db, 'users', ownerId), {
      companyId: companyRef.id,
      role: 'admin'
    });
    return companyRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'companies');
    throw error;
  }
};

export interface Invite {
  id: string;
  companyId: string;
  name: string;
  role: 'picker' | 'driver';
  code: string;
  used: boolean;
  createdAt: any;
}

export const createInvite = async (companyId: string, name: string, role: 'picker' | 'driver'): Promise<string> => {
  try {
    const inviteRef = doc(collection(db, 'invites'));
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await setDoc(inviteRef, {
      companyId,
      name,
      role,
      code,
      used: false,
      createdAt: serverTimestamp(),
    });
    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'invites');
    throw error;
  }
};

export const joinCompany = async (userId: string, inviteCode: string, predefinedRole?: UserRole): Promise<string | null> => {
  try {
    // Check old style company invite code first
    const qCompany = query(collection(db, 'companies'), where('inviteCode', '==', inviteCode.toUpperCase()));
    const snapCompany = await getDocs(qCompany);
    if (!snapCompany.empty) {
      const company = snapCompany.docs[0];
      await updateDoc(doc(db, 'users', userId), {
        companyId: company.id,
        role: predefinedRole || 'picker'
      });
      return company.id;
    }

    // Check specific invite
    const qInvite = query(collection(db, 'invites'), where('code', '==', inviteCode.toUpperCase()), where('used', '==', false));
    const snapInvite = await getDocs(qInvite);
    if (snapInvite.empty) return null;

    const inviteDoc = snapInvite.docs[0];
    const invite = inviteDoc.data() as Invite;
    
    await updateDoc(doc(db, 'users', userId), {
      companyId: invite.companyId,
      role: invite.role,
      name: invite.name
    });

    await updateDoc(doc(db, 'invites', inviteDoc.id), {
      used: true
    });

    return invite.companyId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users/invites');
    throw error;
  }
};

export const getCompany = async (companyId: string): Promise<Company | null> => {
  try {
    const docRef = doc(db, 'companies', companyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Company;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'companies');
    return null;
  }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users');
    return null;
  }
};

export const clearCompanyData = async (companyId: string) => {
  try {
    const ordersQ = query(collection(db, 'orders'), where('companyId', '==', companyId));
    const ordersSnap = await getDocs(ordersQ);
    for (const d of ordersSnap.docs) {
      await deleteDoc(d.ref);
    }
    
    const blocksQ = query(collection(db, 'order_blocks'), where('companyId', '==', companyId));
    const blocksSnap = await getDocs(blocksQ);
    for (const d of blocksSnap.docs) {
      await deleteDoc(d.ref);
    }

    const purchasesQ = query(collection(db, 'purchases'), where('companyId', '==', companyId));
    const purchasesSnap = await getDocs(purchasesQ);
    for (const d of purchasesSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'orders/order_blocks');
    throw error;
  }
};

export interface PurchaseDestination {
  name: string;
  items: { supplier: string; name: string; quantity: string; received?: boolean }[];
}

export interface Purchase {
  id: string;
  companyId: string;
  status: 'receiving' | 'arrived' | 'separated' | 'completed';
  originalText: string;
  destinations: PurchaseDestination[];
  createdAt: any;
  createdBy: string;
}

export const createOrder = async (orderData: Partial<Order>, blocksData: Partial<OrderBlock>[]) => {
  try {
    const batch = writeBatch(db);
    const orderRef = doc(collection(db, 'orders'));
    
    const orderPayload = {
      ...orderData,
      status: 'pending',
      createdAt: serverTimestamp(),
    };
    batch.set(orderRef, orderPayload);

    for (const block of blocksData) {
      const blockRef = doc(collection(db, 'order_blocks'));
      batch.set(blockRef, {
        ...block,
        companyId: orderData.companyId,
        orderId: orderRef.id,
        status: 'pending',
      });
    }

    await batch.commit();
    return orderRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'orders/order_blocks');
    throw error;
  }
};

export const createPurchase = async (purchaseData: Partial<Purchase>) => {
  try {
    const purchaseRef = doc(collection(db, 'purchases'));
    const payload = {
      ...purchaseData,
      status: 'receiving',
      createdAt: serverTimestamp(),
    };
    await setDoc(purchaseRef, payload);
    return purchaseRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'purchases');
    throw error;
  }
};
