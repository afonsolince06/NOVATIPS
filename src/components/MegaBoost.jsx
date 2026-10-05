import BetCard from './BetCard';
import { supabase } from '../lib/supabase';
export default function MegaBoost({ bet, onOptionClick, selectedOptionLabel }) {
 const image = supabase.storage.from('prediction-images').getPublicUrl(bet.mega_boost.image_path).data.publicUrl;
 return <section className="mega-boost" aria-label="Mega Boost">
   <div className="mega-boost-heading"><span>🔥 MEGA BOOST</span>{bet.mega_boost.badge && <strong>{bet.mega_boost.badge}</strong>}</div>
   <div className="mega-boost-image"><img src={image} alt="" /></div>
   <div className="mega-boost-body">
     {bet.mega_boost.boosted_odds && <p className="mega-boost-promo">SIM boosted · {Number(bet.mega_boost.base_yes_odds).toFixed(2)} → {Number(bet.mega_boost.boosted_odds).toFixed(2)}</p>}
     <BetCard bet={bet} variant="fds" onOptionClick={onOptionClick} selectedOptionLabel={selectedOptionLabel} />
   </div>
 </section>;
}
