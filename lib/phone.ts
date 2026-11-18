export function normalizePhoneToE164(
  raw: string,
  defaultCountryDialCode = '+234'
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strip spaces, hyphens, parentheses, and dots
  let cleaned = trimmed.replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith('+')) {
    return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : null;
  }

  // Local Nigerian / leading-zero format (e.g. 08031234567 -> +2348031234567)
  if (/^0\d{9,10}$/.test(cleaned)) {
    const candidate = `${defaultCountryDialCode}${cleaned.slice(1)}`;
    return /^\+[1-9]\d{6,14}$/.test(candidate) ? candidate : null;
  }

  // 10-digit Nigerian mobile without leading 0 (e.g. 8031234567 -> +2348031234567)
  if (/^[789]\d{9}$/.test(cleaned)) {
    const candidate = `${defaultCountryDialCode}${cleaned}`;
    return /^\+[1-9]\d{6,14}$/.test(candidate) ? candidate : null;
  }

  // Country code without '+' (e.g. 2348031234567 or international 8..15 digits)
  if (/^[1-9]\d{7,14}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

export function phonesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const normA = normalizePhoneToE164(a);
  const normB = normalizePhoneToE164(b);
  if (normA && normB) return normA === normB;
  return a.replace(/\D/g, '') !== '' && a.replace(/\D/g, '') === b.replace(/\D/g, '');
}

export function validateOtpCode(raw: string): string | null {
  const digits = raw.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(digits)) {
    return 'Enter the 6-digit SMS verification code.';
  }
  return null;
}
