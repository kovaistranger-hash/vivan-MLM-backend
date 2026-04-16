export type ReferralMeProfile = {
  referral_code?: string;
  referralCode?: string;
  code?: string;
  sponsor_user_id?: number | null;
  sponsor_name?: string | null;
  sponsor_email?: string | null;
};

function stringFromReferralField(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  return String(v).trim();
}

/** Reads referralCode / referral_code / code from a plain object (API profile or user). */
export function pickReferralCodeFromObject(obj: Record<string, unknown> | null | undefined): string {
  if (!obj) return '';
  for (const k of ['referral_code', 'referralCode', 'code'] as const) {
    const s = stringFromReferralField(obj[k]);
    if (s) return s;
  }
  return '';
}

export type AuthMeSnippet = { referral_code?: string; referralCode?: string; code?: string } | null;

export function registrationReferralCode(
  profile: ReferralMeProfile | null,
  authUser: { referral_code?: string; referralCode?: string; code?: string } | null
): string {
  const fromProfile = pickReferralCodeFromObject(profile as Record<string, unknown> | null);
  if (fromProfile) return fromProfile;
  return pickReferralCodeFromObject(authUser as Record<string, unknown> | null);
}
