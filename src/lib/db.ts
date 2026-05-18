import { db } from './firebase';
import { collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './error';

export type UserRole = 'admin' | 'picker' | 'driver';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: any;
}

export interface Order {
  id: string;
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

export const createOrder = async (orderData: Partial<Order>, blocksData: Partial<OrderBlock>[]) => {
  try {
    const orderRef = doc(collection(db, 'orders'));
    const orderPayload = {
      ...orderData,
      status: 'pending',
      createdAt: serverTimestamp(),
    };
    await setDoc(orderRef, orderPayload);

    for (const block of blocksData) {
      const blockRef = doc(collection(db, 'order_blocks'));
      await setDoc(blockRef, {
        ...block,
        orderId: orderRef.id,
        status: 'pending',
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'orders/order_blocks');
  }
};
