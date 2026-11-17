import test from 'node:test';
import assert from 'node:assert/strict';
import { createId, isImage, isHeic, makeUploads } from '../src/uploads.js';
import { webcrypto } from 'node:crypto';
test('camera records get a UUID on Wi-Fi HTTP when randomUUID is unavailable', () => {
  const source = {getRandomValues: bytes => webcrypto.getRandomValues(bytes)};
  const ids = Array.from({length:100}, () => createId(source));
  assert.ok(ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
  assert.equal(new Set(ids).size, 100);
  assert.notEqual(createId(null), createId(null));
});
test('camera and gallery photos with missing MIME metadata are recognized', () => {
  assert.equal(isImage({name:'IMG_0001.JPG',type:''}), true);
  assert.equal(isHeic({name:'IMG_0002.HEIC',type:''}), true);
  assert.equal(isImage({name:'bill.pdf',type:'application/pdf'}), false);
});
test('returned camera file becomes a visible queued photo and can be selected twice', () => {
  const photo = {name:'IMG_0001.JPG',type:'image/jpeg'};
  const first = makeUploads([photo], () => 'blob:test')[0];
  const second = makeUploads([photo], () => 'blob:test')[0];
  assert.equal(first.file, photo); assert.equal(first.status, 'queued');
  assert.equal(first.preview, 'blob:test'); assert.notEqual(first.id, second.id);
  assert.deepEqual(makeUploads([], () => 'blob:test'), []);
});

test('exact duplicate photo bytes are skipped within a selection and against saved photos',async()=>{
 const {uniquePhotos}=await import('../src/uploads.js');
 const saved=new Blob(['same']);
 const duplicate=new Blob(['same']);
 const first=new Blob(['new!']);
 const repeated=new Blob(['new!']);
 const sameSizeDifferent=new Blob(['else']);
 const result=await uniquePhotos([duplicate,first,repeated,sameSizeDifferent],[saved]);
 assert.deepEqual(result.unique,[first,sameSizeDifferent]);
 assert.deepEqual(result.duplicates,[duplicate,repeated]);
});
