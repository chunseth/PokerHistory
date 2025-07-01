/**
 * Step 11u: Finalize Response Model
 * -------------------------------------------------------------
 * Aggregates outputs from previous sub-steps into a single response model that
 * downstream EV calculations (Step 12+) can consume.
 *
 * Inputs expected (all optional but recommended):
 *   • validatedFreq   – output of validateResponseFrequencies (Step 11p)
 *   • ranges          – output of calculateResponseRanges (Step 11r)
 *   • raiseSizingInfo – object containing sizes (Step 11s) AND weighted info (Step 11t)
 *   • gtoComparison   – optional GTO result from Step 11o for reference
 *   • assumptions     – any explanatory assumptions / notes
 *
 * The model merges these into:
 *   {
 *     frequencies: { fold, call, raise },
 *     ranges:      { foldRange, callRange, raiseRange },
 *     raiseSizing: { catalogue: sizesObj, weighted: weightedObj },
 *     confidence,
 *     metadata: { wasAdjusted, gtoComparison, assumptions, ...extra }
 *   }
 */
function finalizeResponseModel({
    validatedFreq = {},
    ranges = {},
    raiseSizingInfo = {},
    gtoComparison = null,
    assumptions = []
} = {}) {
    const frequencies = validatedFreq.adjustedFrequencies || validatedFreq.probabilities || {
        fold: 0.6, call: 0.3, raise: 0.1
    };

    const responseModel = {
        frequencies,
        ranges: {
            foldRange: ranges.foldRange || [],
            callRange: ranges.callRange || [],
            raiseRange: ranges.raiseRange || []
        },
        raiseSizing: {
            catalogue: raiseSizingInfo.catalogue || raiseSizingInfo, // raw sizes object
            weighted: raiseSizingInfo.weighted // weighted object from 11t (if supplied)
        },
        confidence: validatedFreq.confidence ?? 0.5,
        metadata: {
            wasAdjusted: validatedFreq.wasAdjusted ?? false,
            gtoComparison: gtoComparison ? {
                frequencies: gtoComparison.frequencies,
                overrideStrength: gtoComparison.overrideStrength,
                gtoConfidence: gtoComparison.gtoConfidence
            } : null,
            assumptions,
            source: 'Step11u'
        }
    };

    return responseModel;
}

module.exports = {
    finalizeResponseModel
}; 