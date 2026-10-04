import { mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { emptyBill, isBill, sortBills } from '../shared/bill.js';
import { createVoucherWorkbook } from '../shared/voucher-export.js';

export async function createStore(directory) {
  await mkdir(resolve(directory,'photos'),{recursive:true});
  const register=resolve(directory,'register.json');
  let records=[];
  try {records=JSON.parse(await readFile(register,'utf8'));if(!Array.isArray(records)||records.some(b=>!isBill(b)||typeof b.id!=='string'))throw new Error('The saved register is invalid. It has not been overwritten.');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  let mutations=Promise.resolve();
  const update=change=>{
    const result=mutations.then(async()=>{
      const next=change(structuredClone(records));
      const json=JSON.stringify(next,null,2);
      const XLSX=await import('xlsx');
      const workbook=XLSX.write(await createVoucherWorkbook(next),{type:'buffer',bookType:'xlsx'});
      await writeFile(`${register}.tmp`,json);
      await writeFile(resolve(directory,'Bill2Sheet.xlsx.tmp'),workbook);
      await rename(`${register}.tmp`,register);
      records=next;
      await rename(resolve(directory,'Bill2Sheet.xlsx.tmp'),resolve(directory,'Bill2Sheet.xlsx'));
      return structuredClone(records);
    });
    mutations=result.catch(()=>{});return result;
  };
  return {
    directory, workbook:resolve(directory,'Bill2Sheet.xlsx'),
    list:()=>sortBills(structuredClone(records)),
    get:id=>structuredClone(records.find(b=>b.id===id) || null),
    photoPath:id=>resolve(directory,'photos',`${id}.source`),
    previewPath:id=>resolve(directory,'photos',`${id}.jpg`),
    async add(id,buffer,filename,type){
      // A retried phone upload uses the same ID, so an interrupted response
      // cannot create a second Excel row.
      if(records.some(b=>b.id===id))return this.get(id);
      await writeFile(this.photoPath(id),buffer,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
      await update(current=>current.some(b=>b.id===id)?current:[...current,{...emptyBill(),id,filename,type,particulars:null,payment_method:null,debit_account:null,credit_account:null,amount_words:null,notes:null,status:'queued',reviewed:false,createdAt:new Date().toISOString()}]);
      return this.get(id);
    },
    async patch(id,changes){await update(current=>current.map(b=>b.id===id?{...b,...changes,id}:b));return this.get(id);},
    async remove(id){await update(current=>current.filter(b=>b.id!==id));},
    async importLegacy(bills){await update(current=>[...current,...bills.filter(b=>!current.some(c=>c.id===b.id)).map(b=>({...b,status:'saved',reviewed:false,filename:'Previous register'}))]);},
    async recover(){if(records.some(b=>b.status==='reading'))await update(current=>current.map(b=>b.status==='reading'?{...b,status:'queued'}:b));},
    async ensureWorkbook(){try{await stat(this.workbook);}catch{await update(current=>current);}},
  };
}
