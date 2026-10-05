import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
// SheetJS CE writes cell values; apply alignment to its generated XLSX styles.
export function centerWorkbook(bytes){
 const files=unzipSync(new Uint8Array(bytes));
 const path='xl/styles.xml';
 const xml=strFromU8(files[path]);
 files[path]=strToU8(xml.replace(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/,section=>section.replace(/<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g,(_match,attrs,body='')=>`<xf${attrs.replace(/\sapplyAlignment="[^"]*"/g,'')} applyAlignment="1">${body.replace(/<alignment\b[^>]*(?:\/>|>[\s\S]*?<\/alignment>)/g,'')}<alignment horizontal="center" vertical="center" wrapText="1"/></xf>`)));
 return zipSync(files);
}
