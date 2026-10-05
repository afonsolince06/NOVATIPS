import test from 'node:test';
import assert from 'node:assert/strict';
import {windowState,isPredictionPublic,predictionState,toLocalDateTime} from '../src/lib/scheduling.js';
const start='2026-10-06T21:00:00Z',end='2026-10-07T00:00:00Z';
test('publication and closure enforce exact independent boundaries',()=>{
 const bet={status:'open',published:true,start_at:start,closes_at:end};
 assert.equal(isPredictionPublic(bet,Date.parse(start)-1),false);
 assert.equal(isPredictionPublic(bet,Date.parse(start)),true);
 assert.equal(predictionState(bet,Date.parse(start)-1),'scheduled');
 assert.equal(predictionState(bet,Date.parse(start)),'active');
 assert.equal(predictionState(bet,Date.parse(end)),'closed');
});
test('drafts and legacy published predictions preserve their visibility',()=>{
 assert.equal(isPredictionPublic({published:false,start_at:start},Date.parse(end)),false);
 assert.equal(predictionState({published:false,status:'open'},Date.parse(start)),'draft');
 assert.equal(isPredictionPublic({status:'open'},Date.parse(start)),true);
 assert.equal(predictionState({status:'resolved'},Date.parse(start)),'settled');
});
test('Missions and Bets use the same time window and local input roundtrip',()=>{
 assert.equal(windowState(start,end,Date.parse(start)-1),'scheduled');
 assert.equal(windowState(start,end,Date.parse(start)),'active');
 assert.equal(windowState(start,end,Date.parse(end)),'closed');
 const instant=new Date(start);
 assert.equal(new Date(toLocalDateTime(instant)).getTime(),instant.getTime());
 assert.equal(toLocalDateTime(''),'');
});
