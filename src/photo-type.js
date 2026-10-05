// Detect HEIC even when an iPhone upload has missing or incorrect MIME metadata.
export function isHeicHeader(bytes){
 if(bytes.length<12)return false;
 const text=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
 if(text(4,8)!=='ftyp')return false;
 const brands=new Set(['heic','heix','hevc','hevx','heim','heis','hevm','hevs','mif1','msf1']);
 if(brands.has(text(8,12)))return true;
 for(let offset=16;offset+4<=bytes.length;offset+=4)if(brands.has(text(offset,offset+4)))return true;
 return false;
}
