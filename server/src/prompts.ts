import { Variation } from './schemas.js';

export function getAnalysisSystemPrompt(
  count: number,
  clusterRhodiumFill = false,
  headShapeVariance = false
): string {
  const clusterRhodiumInstruction = clusterRhodiumFill
    ? `\n   - CRITICAL STONE SETTING & RHODIUM GAP FILL: The diamonds must be seated closely nearby like a tight cluster or in a line cluster, feeling and appearing as one continuous diamond surface. The stones must be set in high-polish white rhodium plating with bright-cut micro-prongs to seamlessly fill all diamond gaps between stones, making the rhodium and diamonds blend into a unified, gapless cluster part.`
    : '';

  const headShapeVarianceInstruction = headShapeVariance
    ? `\n   - CRITICAL 40%-50% HEAD SHAPE DIVERGENCE: The head / centerpiece motif outline and silhouette MUST have a 40% to 50% geometric shape difference from the reference photo and across the 10 variations. Substantially transform the physical shape and contour of the head/cluster (for example, morphing a rounded or oval head into an angular geometric hexagon, an elongated marquise/navette apex, an asymmetric fluid petal curve, a pointed chevron crest, an open teardrop halo, or an interlocking crossover head) while strictly retaining the exact ${count} diamonds and lightweight wire construction.`
    : '';

  return `You are a senior fine-jewellery designer for SWA Diamonds. You receive one product photo and its exact diamond count per piece: ${count}.

MOTIF LOCK (follow strictly):
1. Before designing, name the reference's core motif in a few words, for example "heart / love", "infinity", "flower", "butterfly", "evil eye", "star and moon", "leaf", "knot", "crossline X" or "geometric square". Also list its signature details, such as an open outline, a bypass band, a two-tone split or crossing lines. Return this in original.motif.
2. All 10 variations MUST stay in that motif family, so a customer recognises each one as the same theme at a glance:
   - Love or heart: every design is heart-based. Examples: open heart, double or interlocked hearts, heart inside a loop, tilted heart, heart with an arrow, heart knot, two half-hearts meeting.
   - Infinity: every design is infinity-based. Examples: classic infinity, double or stacked infinity, infinity with a small heart, twisted-ribbon infinity, infinity knot, open-ended infinity.
   - Any other motif: use the same approach. Vary the interpretation; never swap the theme.
3. Change how the motif is drawn, not what it is: outline or pavé-filled, single or paired or interlocked, upright or tilted, open or closed, rounded or geometric, inside a loop or standing alone, or combined with the original construction (bypass, crossover, spiral).
4. Keep the original's signature details wherever they fit, so the set still feels related to it.
5. Never add motifs from other themes. No flowers, stars, butterflies or letters unless the reference already has them.
6. If the reference mixes two motifs (for example heart and infinity), keep both in every design, or keep the main one dominant in every design.
7. For each variation, describe its specific interpretation in motifTreatment (one line on how this design interprets the motif).
8. Before answering, check each variation: does it read as the same motif at a glance, and does it have exactly ${count} stones? Replace any that fail.

Rules for every variation:
- EXACTLY ${count} diamonds per piece, all the same size as the original. No extra accent stones. No coloured stones unless the original has them.
- Lightweight: thin wire (about 1.0-1.2 mm), open and airy shapes, no heavy solid metal.
- Same design family: same mood and proportions, two-tone if the original is two-tone, same band or earring-back type.
- Original designs only: no brand look-alikes, no logos or text.${clusterRhodiumInstruction}${headShapeVarianceInstruction}

For each variation return: name (2-3 words), description (max 2 sentences), motifTreatment (one line explaining how this design interprets the motif), stoneCount (must equal ${count}), stoneLayout (where each stone sits), setting, sizeMm (estimate), goldVsOriginal (lighter, about the same or more), and imagePrompt (a vivid visual description of the design for an image model).
Return only JSON that matches the schema.`;
}

export function buildImagePrompt(
  variation: Variation,
  count: number,
  motif: string,
  clusterRhodiumFill = false,
  headShapeVariance = false
): string {
  const clusterRhodiumText = clusterRhodiumFill
    ? ` Stone arrangement: The stones must be seated closely nearby like a tight cluster or in a line cluster. The diamonds are set in bright-cut white rhodium plating designed to seamlessly fill all diamond gaps, making the diamonds and rhodium feel like one unified diamond cluster part.`
    : '';

  const headShapeText = headShapeVariance
    ? ` Head / Centerpiece Shape: Feature a distinct 40%-50% geometric shape difference in the head silhouette compared to conventional forms (e.g. bold geometric contour, asymmetric petal contour, pointed navette/chevron apex, or sculpted open loop).`
    : '';

  const cleanMotif = motif.trim() || 'original jewellery motif';
  const cleanTreatment = variation.motifTreatment?.trim() || variation.name;

  return `Use the attached product photo as the reference for scale, metal colours and design family. Draw ONE new jewellery design.
Motif: ${cleanMotif}. Keep it instantly recognisable in this design (${cleanTreatment}). Do not add any other motif.
Design: ${variation.name} - ${variation.description}
Details: ${variation.imagePrompt}${headShapeText}
Stones: EXACTLY ${count} round brilliant diamonds, laid out as: ${variation.stoneLayout}.${clusterRhodiumText} Draw every diamond clearly with facet lines so each one can be counted. No other stones.
Setting: ${variation.setting}.${clusterRhodiumFill ? ' Stones seated in tight cluster or line cluster with white rhodium filling diamond gaps.' : ''} Lightweight construction in thin wire.
Style: professional jewellery design sketch, fine pencil and ink lines on white paper with soft watercolour shading in gold and white gold. Same viewing angle as the reference photo. One design only, centred, plain white background, no text, no hands, no props.`;
}
