export const saveIdCardLocally = (userId, blob) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AiSManagerDB', 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('idCards');
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('idCards')) {
        db.close();
        const req2 = indexedDB.open('AiSManagerDB', db.version + 1);
        req2.onupgradeneeded = (e2) => e2.target.result.createObjectStore('idCards');
        req2.onsuccess = (e2) => {
          const db2 = e2.target.result;
          const tx = db2.transaction('idCards', 'readwrite');
          tx.objectStore('idCards').put(blob, userId);
          tx.oncomplete = () => { db2.close(); resolve(); };
          tx.onerror = () => { db2.close(); reject(tx.error); };
        };
        return;
      }
      const tx = db.transaction('idCards', 'readwrite');
      tx.objectStore('idCards').put(blob, userId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    request.onerror = () => reject(request.error);
  });
};

export const getIdCardLocally = (userId) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AiSManagerDB', 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('idCards');
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('idCards')) {
        db.close();
        return resolve(null);
      }
      const tx = db.transaction('idCards', 'readonly');
      const getReq = tx.objectStore('idCards').get(userId);
      getReq.onsuccess = () => { db.close(); resolve(getReq.result || null); };
      getReq.onerror = () => { db.close(); reject(getReq.error); };
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteIdCardLocally = (userId) => {
  return new Promise((resolve) => {
    const request = indexedDB.open('AiSManagerDB', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('idCards')) {
        db.close();
        return resolve();
      }
      const tx = db.transaction('idCards', 'readwrite');
      tx.objectStore('idCards').delete(userId);
      tx.oncomplete = () => { db.close(); resolve(); };
    };
    request.onerror = () => resolve();
  });
};
