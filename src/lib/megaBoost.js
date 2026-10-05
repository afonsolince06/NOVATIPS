import {isPredictionPublic} from './scheduling.js';
export function findActiveMegaBoost(bets, now = Date.now()) {
 return bets.find(bet => bet.status === 'open' && isPredictionPublic(bet,now) && bet.mega_boost?.enabled === true && bet.mega_boost?.active === true && new Date(bet.closes_at).getTime() > now) || null;
}
