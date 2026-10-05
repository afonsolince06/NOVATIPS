import BetCard from './BetCard';
import { supabase } from '../lib/supabase';
export default function MegaBoost({ bet, onOptionClick, selectedOptionLabel }) {
 const image = supabase.storage.from('prediction-images').getPublicUrl(bet.mega_boost.image_path).data.publicUrl;
 return <section className="mega-boost" aria-label="Mega Boost">
   <div className="mega-boost-heading"><span>🔥 MEGA BOOST</span>{bet.mega_boost.badge && <strong>{bet.mega_boost.badge}</strong>}</div>
   <div className="mega-boost-image"><img src={image} alt="" /></div>
   <div className="mega-boost-body">
     {[['boosted_odds','base_yes_odds',0],['boosted_no_odds','base_no_odds',1]].map(([boost,base,index]) => bet.mega_boost[boost] ? <p key={boost} className="mega-boost-promo">{bet.options[index]?.label} boosted · {Number(bet.mega_boost[base]).toFixed(2)} → {Number(bet.mega_boost[boost]).toFixed(2)}</p> : null)}
     <BetCard bet={bet} variant="fds" onOptionClick={onOptionClick} selectedOptionLabel={selectedOptionLabel} />
   </div>
 </section>;
}
