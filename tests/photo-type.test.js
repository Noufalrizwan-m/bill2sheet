import test from 'node:test';
import assert from 'node:assert/strict';
import {isHeicHeader} from '../src/photo-type.js';
test('recognizes HEIC container independently of extension and MIME',()=>{
 const bytes=new Uint8Array(24);bytes.set(new TextEncoder().encode('ftypheic'),4);
 assert.equal(isHeicHeader(bytes),true);
 bytes.set(new TextEncoder().encode('avif'),8);assert.equal(isHeicHeader(bytes),false);
 bytes.set(new TextEncoder().encode('heic'),16);assert.equal(isHeicHeader(bytes),true);
 assert.equal(isHeicHeader(new Uint8Array([255,216,255])),false);
});
