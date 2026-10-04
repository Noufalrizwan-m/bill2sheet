import React from 'react';
import {test,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import 'fake-indexeddb/auto';
import {emptyBill} from '../shared/bill.js';
const state=vi.hoisted(()=>({rows:[],outbox:[]}));
vi.mock('../src/outbox.js',()=>({listOutbox:async()=>state.outbox,queuePhotos:async entries=>{state.outbox.push(...entries);},removeOutbox:async id=>{state.outbox=state.outbox.filter(e=>e.id!==id);}}));
vi.mock('../src/api.js',()=>({
 getReaderStatus:async()=>true,getRegister:async()=>({bills:[...state.rows],readerAvailable:true}),importLegacy:async()=>{},
 uploadPhoto:async entry=>{if(!state.rows.some(b=>b.id===entry.id))state.rows.push({...emptyBill(),id:entry.id,filename:entry.name,vendor:'Gas Both Camp',date:'27-06-2026',total:1725,status:'saved'});},
 updateBill:async(id,bill)=>{state.rows=state.rows.map(b=>b.id===id?{...bill}:b);},deleteBill:async id=>{state.rows=state.rows.filter(b=>b.id!==id);},retryBill:async()=>{}
}));
import App from '../src/App.jsx';
beforeEach(()=>{state.rows=[];state.outbox=[];localStorage.clear();Element.prototype.scrollIntoView=()=>{};});
afterEach(cleanup);
test('camera return appends automatically once; next photo adds another; reopening retains both; all fields optional',async()=>{
 const view=render(<App/>);
 const camera=screen.getByLabelText('Take a voucher photo');
 const file=new File(['image'],'first.HEIC',{type:'image/heic'});
 fireEvent.change(camera,{target:{files:[file]}});fireEvent.input(camera,{target:{files:[file]}});
 await waitFor(()=>expect(state.rows).toHaveLength(1));
 fireEvent.click(camera);fireEvent.change(camera,{target:{files:[new File(['two'],'second.jpg',{type:'image/jpeg'})]}});
 await waitFor(()=>expect(state.rows).toHaveLength(2));
 view.unmount();render(<App/>);
 await waitFor(()=>expect(screen.getAllByText('Gas Both Camp')).toHaveLength(2));
 expect(screen.getByText('Export Excel')).toBeTruthy();expect(screen.getByText('Export PDF')).toBeTruthy();
 fireEvent.click(screen.getByLabelText('Edit first.HEIC'));
 fireEvent.change(screen.getByLabelText('Paid to / Vendor'),{target:{value:''}});
 fireEvent.change(screen.getByLabelText('Amount'),{target:{value:''}});
 fireEvent.click(screen.getByText('Save changes'));
 await waitFor(()=>expect(state.rows[0].total).toBe(null));
 expect(state.rows[0].vendor).toBe(null);
});
