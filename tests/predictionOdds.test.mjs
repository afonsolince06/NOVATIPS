import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOppositeOdds, resolveOptionBOdds } from '../src/lib/predictionOdds.js';
test('original formula retains its rounding',()=>{assert.equal(generateOppositeOdds('1.70'),'2.23');assert.equal(generateOppositeOdds('2.00'),'1.84');assert.equal(generateOppositeOdds(''),'');});
test('empty B calculates automatically; manual B remains unchanged when A changes',()=>{assert.equal(resolveOptionBOdds('1.70',''),'2.23');assert.equal(resolveOptionBOdds('1.70','2.50'),'2.50');assert.equal(resolveOptionBOdds('2.00','2.50'),'2.50');});
