import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import OwnerAccess,{safeSignInLocation} from '../src/OwnerAccess.jsx';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('owner sign-in uses a same-origin request, clears the password and updates reading access',async()=>{
 localStorage.clear();const onChange=vi.fn();
 const fetch=vi.fn(async()=>({ok:true,json:async()=>({authenticated:true})}));vi.stubGlobal('fetch',fetch);
 render(<OwnerAccess status={{authenticationRequired:true,accessConfigured:true}} onChange={onChange}/>);
 fireEvent.change(screen.getByLabelText('Owner access password'),{target:{value:'synthetic-owner-passphrase'}});
 fireEvent.click(screen.getByRole('button',{name:'Sign in to read photos'}));
 await waitFor(()=>expect(onChange).toHaveBeenCalledWith(true));
 const [url,options]=fetch.mock.calls[0];expect(url).toBe('/api/session');expect(options.credentials).toBe('same-origin');expect(options.method).toBe('POST');
 expect(JSON.parse(options.body).password).toBe('synthetic-owner-passphrase');
 expect(screen.getByLabelText('Owner access password').value).toBe('');expect(JSON.stringify(localStorage)).not.toContain('synthetic-owner-passphrase');
});
test('failed sign-in clears the submitted password and shows the server message',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,json:async()=>({error:'The access password is incorrect.'})})));
 render(<OwnerAccess status={{authenticationRequired:true,accessConfigured:true}} onChange={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Owner access password'),{target:{value:'wrong-fixture-password'}});
 fireEvent.click(screen.getByRole('button',{name:'Sign in to read photos'}));
 await screen.findByRole('alert');expect(screen.getByLabelText('Owner access password').value).toBe('');
});
test('sign-out clears access and an unconfigured deployment never asks for an API key',async()=>{
 const onChange=vi.fn();vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({authenticated:false})})));
 const view=render(<OwnerAccess status={{ownerAccess:true}} onChange={onChange}/>);
 fireEvent.click(screen.getByRole('button',{name:'Sign out'}));await waitFor(()=>expect(onChange).toHaveBeenCalledWith(false));
 view.rerender(<OwnerAccess status={{authenticationRequired:true,accessConfigured:false}} onChange={onChange}/>);
 expect(screen.queryByRole('textbox')).toBeNull();expect(screen.queryByRole('button')).toBeNull();expect(screen.queryByLabelText('Owner access password')).toBeNull();
});

test('a plain HTTP phone address cannot offer password submission',()=>{
 expect(safeSignInLocation(new URL('http://192.0.2.10:5173'))).toBe(false);
 expect(safeSignInLocation(new URL('http://voucher.example'))).toBe(false);
 expect(safeSignInLocation(new URL('https://voucher.example'))).toBe(true);
 expect(safeSignInLocation(new URL('http://localhost:5173'))).toBe(true);
});
