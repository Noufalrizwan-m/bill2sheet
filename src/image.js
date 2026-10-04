import { isHeic, isImage } from './uploads.js';
const MAX_BYTES = 1_800_000;
async function withTimeout(task, milliseconds, message) {
  let timer;
  try { return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function decodePhoto(blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await withTimeout(image.decode(), 20_000, 'Opening this photo took too long. Try uploading a smaller JPEG from Photos.');
    return { image, url };
  } catch (error) { image.src = ''; URL.revokeObjectURL(url); throw error; }
}
export async function compressImage(file) {
  const heic = isHeic(file);
  if (!isImage(file)) throw new Error('Choose an image file (HEIC, JPEG, PNG, or WebP).');
  if (file.size > 35_000_000) throw new Error('This photo exceeds 35 MB. Choose a smaller image.');
  let decoded;
  try { decoded = await decodePhoto(file); }
  catch (error) {
    if (!heic) throw new Error('This photo could not be opened. Try uploading a JPEG from Photos.');
    try {
      const { heicTo } = await import('heic-to');
      const source = await withTimeout(heicTo({ blob: file, type: 'image/jpeg', quality: 0.95 }), 60_000, 'HEIC conversion took too long. Try uploading a JPEG from Photos.');
      decoded = await decodePhoto(source);
    } catch { throw new Error('This HEIC photo could not be converted. Try exporting it as JPEG, then retry.'); }
  }
  const { image, url } = decoded;
  try {
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob;
    for (const quality of [0.86, 0.75, 0.6, 0.45]) {
      blob = await withTimeout(new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality)), 15_000, 'Photo preparation took too long. Try a smaller photo.');
      if (blob && blob.size <= MAX_BYTES) break;
    }
    if (!blob || blob.size > MAX_BYTES) throw new Error('This image is still too large. Crop around the bill and retry.');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read the image.')); reader.readAsDataURL(blob);
    });
  } finally { image.src = ''; URL.revokeObjectURL(url); }
}
