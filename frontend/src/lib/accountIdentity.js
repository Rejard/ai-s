export function normalizeAccountEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isWalletOwnedByGoogleAccount(walletUser, googleEmail) {
  const walletEmail = normalizeAccountEmail(walletUser?.email);
  const authenticatedEmail = normalizeAccountEmail(googleEmail);

  return Boolean(walletEmail && authenticatedEmail && walletEmail === authenticatedEmail);
}
