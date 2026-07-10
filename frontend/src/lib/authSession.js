const AUTH_TOKEN_KEY = 'auth_token';

export function getAuthToken(storage = localStorage) {
  try {
    return storage.getItem(AUTH_TOKEN_KEY) || '';
  } catch (e) {
    console.warn("getAuthToken storage is blocked:", e.message);
    return '';
  }
}

export function saveAuthSession(token, profile, storage = localStorage) {
  try {
    storage.setItem(AUTH_TOKEN_KEY, token);
    storage.setItem('google_email', profile.email);
    storage.setItem('google_name', profile.name || profile.email);
  } catch (e) {
    console.warn("saveAuthSession storage is blocked:", e.message);
  }
}

export function clearAuthSession(storage = localStorage) {
  try {
    storage.removeItem(AUTH_TOKEN_KEY);
    storage.removeItem('google_email');
    storage.removeItem('google_name');
  } catch (e) {
    console.warn("clearAuthSession storage is blocked:", e.message);
  }
}

export function buildAuthHeaders(storage = localStorage) {
  const token = getAuthToken(storage);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function downloadAuthenticatedFile(url, filename, storage = localStorage) {
  const response = await fetch(url, { headers: buildAuthHeaders(storage) });
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
