let sequence = 0;
// Local Wi-Fi HTTP addresses are not secure contexts: randomUUID may be absent.
// These IDs identify local records; they are not authentication credentials.
export function createId(source = globalThis.crypto) {
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  if (typeof source?.getRandomValues === 'function') {
    const bytes = source.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  return `bill-${Date.now().toString(36)}-${(sequence++).toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export const isHeic = file => /\.(heic|heif)$/i.test(file.name || '') || /image\/hei[cf]/i.test(file.type || '');
export const isImage = file => isHeic(file) || (file.type || '').startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name || '');
export function makeUploads(files, createPreview = file => URL.createObjectURL(file)) {
  return Array.from(files || []).map(file => ({
    id: createId(), file, preview: createPreview(file), name: file.name || 'Camera photo', status: 'queued',
  }));
}
