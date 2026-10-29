import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('both hand poses referenced by the refresh intro ship as valid PNG assets',async()=>{
 const component=await readFile(new URL('../src/PaperToss.jsx',import.meta.url),'utf8');
 const images=[...component.matchAll(/src="(\/images\/[^\"]+\.png)"/g)].map(match=>match[1]);
 assert.equal(images.length,2,'The intro needs a gripping and an open hand');
 for(const path of images){
  const bytes=await readFile(new URL(`../public${path}`,import.meta.url));
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10],`${path} must be a PNG`);
  assert.ok(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0);
 }
});
