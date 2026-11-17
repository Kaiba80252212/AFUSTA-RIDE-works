'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
  verifyPasswordResetCode,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export function createGoogleAuthProvider(options?: {
  loginHint?: string;
  prompt?: 'select_account' | 'select_account consent';
}) {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  const params: Record<string, string> = {
    prompt: options?.prompt || 'select_account',
  };
  const hint = options?.loginHint?.trim().toLowerCase();
  if (hint && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint)) {
    params.login_hint = hint;
  }
  provider.setCustomParameters(params);
  return provider;
}

export async function sendFirebaseVerificationEmailSafe(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function sendFirebasePasswordResetEmailSafe(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  await sendPasswordResetEmail(auth, cleanEmail);
}

export function mapFirebaseEmailError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code || '');
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Sign in or reset your password.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be stronger (at least 8 characters with uppercase, lowercase, and a number).';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact the Campus Transport Office.';
      case 'auth/too-many-requests':
        return 'Too many attempts detected. Please wait a few minutes before trying again.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in must be enabled in Firebase Console (Authentication → Sign-in method → Email/Password).';
      case 'auth/expired-action-code':
        return 'This email verification or reset link has expired. Please request a new one.';
      case 'auth/invalid-action-code':
        return 'This email action link is invalid or has already been used.';
      case 'auth/network-request-failed':
        return 'Network error connecting to Firebase Authentication. Please check your internet connection.';
      default:
        break;
    }
  }
  return err instanceof Error ? err.message : 'Firebase email authentication error.';
}

export function validateFirebasePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number';
  }
  return null;
}

export {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  verifyPasswordResetCode,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export async function syncFirebaseProfileToFirestore(params: {
  uid: string;
  displayName: string;
  email: string;
  role: 'STUDENT' | 'DRIVER';
  phone?: string;
  matricNo?: string;
  department?: string;
  licenseNo?: string;
  plateNumber?: string;
  available?: boolean;
  walletBalance?: number;
}): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== params.uid || !auth.currentUser.emailVerified) {
    return;
  }
  if (!VALID_ID_REGEX.test(params.uid)) {
    return;
  }

  const cleanName = params.displayName.trim().slice(0, 120) || 'AFUSTA User';
  const cleanEmail = params.email.trim().toLowerCase().slice(0, 180);
  const cleanPhone = (params.phone || '').trim().slice(0, 32);
  const cleanMatric = (params.matricNo || '').trim().slice(0, 48);
  const cleanDept = (params.department || '').trim().slice(0, 120);
  const cleanLicense = (params.licenseNo || '').trim().slice(0, 48);
  const cleanPlate = (params.plateNumber || '').trim().slice(0, 32);

  const userDocPath = `users/${params.uid}`;
  const userRef = doc(db, 'users', params.uid);

  try {
    const existingPublic = await getDoc(userRef);
    if (!existingPublic.exists()) {
      await setDoc(userRef, {
        uid: params.uid,
        displayName: cleanName,
        role: params.role,
        rating: 5,
        available: Boolean(params.available),
        ...(cleanPlate ? { tricyclePlate: cleanPlate } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: cleanName,
        available: Boolean(params.available),
        ...(cleanPlate ? { tricyclePlate: cleanPlate } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userDocPath);
  }

  const privateDocPath = `users/${params.uid}/private/info`;
  const privateRef = doc(db, 'users', params.uid, 'private', 'info');

  try {
    const existingPrivate = await getDoc(privateRef);
    if (!existingPrivate.exists()) {
      await setDoc(privateRef, {
        uid: params.uid,
        email: cleanEmail,
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(cleanMatric ? { matricNo: cleanMatric } : {}),
        ...(cleanDept ? { department: cleanDept } : {}),
        ...(cleanLicense ? { licenseNo: cleanLicense } : {}),
        walletBalance: 0,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(cleanMatric ? { matricNo: cleanMatric } : {}),
        ...(cleanDept ? { department: cleanDept } : {}),
        ...(cleanLicense ? { licenseNo: cleanLicense } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privateDocPath);
  }
}
