import React from 'react';
import {test,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import 'fake-indexeddb/auto';
import {emptyBill} from '../shared/bill.js';
const state=vi.hoisted(()=>({rows:[],outbox:[]}));
vi.mock('../src/outbox.js',()=>({listOutbox:async()=>state.outbox,queuePhotos:async entries=>{state.outbox.push(...entries);},removeOutbox:async id=>{state.outbox=state.outbox.filter(e=>e.id!==id);}}));
vi.mock('../src/api.js',()=>({
 getReaderStatus:async()=>true,getGeminiStatus:async()=>({configured:false}),getRegister:async()=>({bills:[...state.rows],readerAvailable:true}),importLegacy:async()=>{},
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

test('register filters separate checked, unreviewed and queued vouchers',async()=>{
 state.rows=[
  {...emptyBill(),id:'checked',vendor:'Checked supplier',status:'saved',reviewed:true,total:20,date:'28-10-2026'},
  {...emptyBill(),id:'review',vendor:'Review supplier',status:'saved',reviewed:false,total:30,date:'28-10-2026'},
  {...emptyBill(),id:'queued',vendor:'Queued supplier',status:'queued',reviewed:false},
 ];
 render(<App/>);
 await screen.findByText('Checked supplier');
 fireEvent.click(screen.getByRole('button',{name:/Needs review/}));
 expect(screen.getByText('Review supplier')).toBeTruthy();
 expect(screen.queryByText('Queued supplier')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Reading, 1 vouchers/}));
 expect(screen.getByText('Queued supplier')).toBeTruthy();
 expect(screen.queryByText('Review supplier')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/All vouchers/}));
 expect(screen.getByText('Checked supplier')).toBeTruthy();
});

test('dropping a photo saves it through the existing photo queue',async()=>{
 render(<App/>);
 const capture=screen.getByRole('heading',{name:'Add the next voucher'}).closest('section');
 fireEvent.drop(capture,{dataTransfer:{files:[new File(['photo'],'dropped.jpg',{type:'image/jpeg'})]}});
 await waitFor(()=>expect(state.rows).toHaveLength(1));
 expect(state.rows[0].filename).toBe('dropped.jpg');
});
