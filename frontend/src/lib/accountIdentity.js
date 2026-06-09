export function normalizeAccountEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isAdminGoogleAccount(email) {
  return normalizeAccountEmail(email) === 'lemaiiisk@gmail.com';
}

export function isManagerAccount(userData, googleEmail, walletAddress) {
  if (userData?.isManager === true || userData?.is_manager === 1) return true;
  if (isAdminGoogleAccount(googleEmail || userData?.email)) return true;

  return String(walletAddress || userData?.walletAddress || '').toLowerCase()
    === '0x7660bf401af0d13645f0cfed3e72b8e8b6fd7987';
}

export function isWalletOwnedByGoogleAccount(walletUser, googleEmail) {
  const walletEmail = normalizeAccountEmail(walletUser?.email);
  const authenticatedEmail = normalizeAccountEmail(googleEmail);

  return Boolean(walletEmail && authenticatedEmail && walletEmail === authenticatedEmail);
}
