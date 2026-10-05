// Preserve the original opposite-odd formula and rounding.
export function generateOppositeOdds(optionAOdds) {
 const o = parseFloat(optionAOdds);
 if (!o || o <= 1.01) return '';
 return (Math.round((o / (o - 1)) * 0.92 * 100) / 100).toFixed(2);
}
export function resolveOptionBOdds(optionAOdds, manualOdds) {
 return manualOdds === '' || manualOdds == null ? generateOppositeOdds(optionAOdds) : manualOdds;
}
