import { emptyBill, sortBills } from '../shared/bill.js';
const DB = 'bill2sheet-device-register-v1';
async function transaction(mode, action) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('bills', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Cannot open device storage. Allow browser storage and retry.'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('bills', mode);
      let result;
      action(tx.objectStore('bills'), value => { result = value; });
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(new Error('Could not save on this device. Free some storage and retry.'));
    });
  } finally { db.close(); }
}
export const listRecords = async () => sortBills(await transaction('readonly', (store, done) => {
  store.getAll().onsuccess = event => done(event.target.result);
}));
export const getRecord = id => transaction('readonly', (store, done) => {
  store.get(id).onsuccess = event => done(event.target.result);
});
export const addRecord = entry => transaction('readwrite', (store, done) => {
  store.get(entry.id).onsuccess = event => {
    if (event.target.result) { done(event.target.result); return; }
    const record = { ...emptyBill(), id: entry.id, filename: entry.name, original: entry.file,
      status: 'queued', reader: entry.reader || 'handwriting', reviewed: false, createdAt: new Date().toISOString() };
    store.add(record); done(record);
  };
});
export const patchRecord = (id, values) => transaction('readwrite', (store, done) => {
  store.get(id).onsuccess = event => {
    const previous = event.target.result;
    if (!previous) return;
    const record = { ...previous, ...values, id };
    delete record.photoUrl;
    store.put(record); done(record);
  };
});
export const removeRecord = id => transaction('readwrite', store => store.delete(id));
export const importRecords = records => transaction('readwrite', store => {
  for (const record of records) store.get(record.id).onsuccess = event => {
    if (!event.target.result) store.put({ ...record, status: 'saved', reviewed: false });
  };
});
