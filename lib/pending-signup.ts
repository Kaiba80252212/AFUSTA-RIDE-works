export interface PendingSignupProfile {
  name?: string;
  role: 'STUDENT' | 'DRIVER';
  phone?: string;
  matricNo?: string;
  department?: string;
  licenseNo?: string;
}

const STORAGE_PREFIX = 'afusta_pending_signup:';

export function buildPendingSignupKey(email: string): string {
  return `${STORAGE_PREFIX}${email.trim().toLowerCase()}`;
}

export function savePendingSignupProfile(
  email: string,
  profile: PendingSignupProfile
): void {
  if (typeof window === 'undefined') return;
  const key = buildPendingSignupKey(email);
  if (!email.trim()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function readPendingSignupProfile(email: string): PendingSignupProfile | null {
  if (typeof window === 'undefined') return null;
  const key = buildPendingSignupKey(email);
  if (!email.trim()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSignupProfile>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      role: parsed.role === 'DRIVER' ? 'DRIVER' : 'STUDENT',
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      matricNo: typeof parsed.matricNo === 'string' ? parsed.matricNo : undefined,
      department: typeof parsed.department === 'string' ? parsed.department : undefined,
      licenseNo: typeof parsed.licenseNo === 'string' ? parsed.licenseNo : undefined,
    };
  } catch {
    return null;
  }
}

export function clearPendingSignupProfile(email: string): void {
  if (typeof window === 'undefined') return;
  if (!email.trim()) return;
  try {
    window.localStorage.removeItem(buildPendingSignupKey(email));
  } catch {
    // Ignore storage errors
  }
}
