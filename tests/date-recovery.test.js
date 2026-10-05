import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverVoucherDate} from '../shared/date-recovery.js';
test('readable date notes move into Date using the documented century convention',()=>{
 for(const note of ['01/07/26','Year has only two digits: 19/06/27']){
 const result=recoverVoucherDate({date:null,unclear:[{field:'voucher_date',note}],uncertain_fields:['date'],reviewed:true});
 assert.equal(result.date,note.startsWith('01')?'01-07-2026':'19-06-2027');assert.deepEqual(result.unclear,[]);assert.equal(result.reviewed,false);
 }
});
test('ambiguous, invalid and already edited dates are not overwritten',()=>{
 for(const note of ['01/07/26 or 28','31/02/26','3 or 8'])assert.equal(recoverVoucherDate({date:null,unclear:[{field:'voucher_date',note}]}),null);
 assert.equal(recoverVoucherDate({date:'01-07-1926',unclear:[{field:'voucher_date',note:'01/07/26'}]}),null);
});
