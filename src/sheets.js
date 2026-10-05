import {createId} from './uploads.js';
const KEY='bill2sheet-sheets-v1';
export const DEFAULT_SHEET='original';
export function getSheets(){
 const raw=localStorage.getItem(KEY);
 if(!raw)return {active:DEFAULT_SHEET,sheets:[{id:DEFAULT_SHEET,name:'Original sheet'}]};
 const state=JSON.parse(raw);
 if(!Array.isArray(state.sheets)||!state.sheets.some(s=>s.id===state.active))throw new Error('Saved sheet list could not be opened. Do not clear browser storage.');
 return state;
}
export function selectSheet(id){const state=getSheets();if(!state.sheets.some(s=>s.id===id))throw new Error('Sheet not found');localStorage.setItem(KEY,JSON.stringify({...state,active:id}));}
export function createSheet(name){
 const state=getSheets(),sheet={id:createId(),name:name.trim().slice(0,80)||`Sheet ${state.sheets.length+1}`};
 localStorage.setItem(KEY,JSON.stringify({active:sheet.id,sheets:[...state.sheets,sheet]}));return sheet;
}
export const activeSheetId=()=>getSheets().active;
export const inSheet=(record,id)=> (record.sheetId||DEFAULT_SHEET)===id;
