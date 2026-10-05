import test from 'node:test';
import assert from 'node:assert/strict';
import { findActiveMegaBoost } from '../src/lib/megaBoost.js';
const now = Date.parse('2026-10-05T12:00:00Z');
const boost = { id:'boost',status:'open',closes_at:'2026-10-05T12:01:00Z',section:'neon',mega_boost:{ enabled:true,active:true } };
test('finds an active boost without promoting ordinary featured predictions', () => {
 assert.equal(findActiveMegaBoost([{...boost,id:'normal',mega_boost:null,featured:true},boost],now),boost);
});
test('expiry removes the featured position exactly at the deadline', () => {
 assert.equal(findActiveMegaBoost([boost],Date.parse(boost.closes_at)),null);
 assert.equal(findActiveMegaBoost([boost],Date.parse(boost.closes_at)+1),null);
});
test('inactive, disabled, settled and malformed dates never feature', () => {
 for(const change of [{mega_boost:{enabled:true,active:false}},{mega_boost:{enabled:false,active:true}},{status:'resolved'},{closes_at:'invalid'}]) assert.equal(findActiveMegaBoost([{...boost,...change}],now),null);
 assert.equal(findActiveMegaBoost([],now),null);
});
test('boost retains its normal prediction ID and internal category', () => {
 const active=findActiveMegaBoost([boost],now);
 assert.equal(active.id,'boost');assert.equal(active.section,'neon');
 assert.deepEqual([boost].filter(b=>b.id!==active.id),[]);
});
