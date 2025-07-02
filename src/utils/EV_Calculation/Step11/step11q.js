const mongoose = require('mongoose');
const Hand = mongoose.models.Hand || mongoose.model('Hand');

/**
 * Step 11q: Store Response Frequencies
 * --------------------------------------------------
 * Persists the validated response-frequency summary (output of Step 11p) into
 * the corresponding `bettingActions[actionIndex]` sub-document of the Hand.
 *
 * @param {String|ObjectId} handId – Mongo _id of the Hand document.
 * @param {Number} actionIndex – Index of the betting action within the hand.
 * @param {Object} validated – Object returned by validateResponseFrequencies().
 *                             Expected shape: {
 *                               adjustedFrequencies: { fold, call, raise },
 *                               confidence,
 *                               metadata
 *                             }
 * @returns {Promise<Object>} MongoDB update result.
 */
async function storeResponseFrequencies(handId, actionIndex, validated) {
    if (!handId || actionIndex === undefined || !validated || !validated.adjustedFrequencies) {
        throw new Error('Invalid parameters passed to storeResponseFrequencies');
    }

    const path = `bettingActions.${actionIndex}.responseFrequencies`;

    const payload = {
        ...validated.adjustedFrequencies,
        confidence: validated.confidence ?? null,
        metadata: validated.metadata ?? null
    };

    // Update using positional index path
    const res = await Hand.updateOne({ _id: handId }, { $set: { [path]: payload } });
    return res;
}

module.exports = {
    storeResponseFrequencies,
    /**
     * Persists GTO frequencies calculated in Step 11o.
     * @param {String|ObjectId} handId
     * @param {Number} actionIndex
     * @param {Object} gtoResult – object returned by calculateNashEquilibriumGTOResponses()
     */
    async storeGTOFrequencies(handId, actionIndex, gtoResult) {
        if (!handId || actionIndex === undefined || !gtoResult || !gtoResult.frequencies) {
            throw new Error('Invalid parameters passed to storeGTOFrequencies');
        }
        const path = `bettingActions.${actionIndex}.gtoFrequencies`;
        const payload = {
            ...gtoResult.frequencies,
            confidence: gtoResult.gtoConfidence ?? null,
            overrideStrength: gtoResult.overrideStrength ?? null,
            metadata: gtoResult.metadata ?? null
        };
        return Hand.updateOne({ _id: handId }, { $set: { [path]: payload } });
    },
    /**
     * Persists the validated response-frequency summary (output of Step 11p) into
     * the corresponding `heroActions[actionIndex]` sub-document of the Hand.
     *
     * This mirrors `storeResponseFrequencies` but targets the Hero-specific
     * collection that was added in the schema migration (June 2025).
     *
     * @param {String|ObjectId} handId – Mongo _id of the Hand document.
     * @param {Number} actionIndex – Index of the hero action within hand.heroActions
     * @param {Object} validated – Validated frequencies produced by Step 11p.
     *                             Expected shape matches `storeResponseFrequencies`.
     * @returns {Promise<Object>} MongoDB update result.
     */
    async storeResponseFrequenciesToHeroActions(handId, actionIndex, validated) {
        if (!handId || actionIndex === undefined || !validated || !validated.adjustedFrequencies) {
            throw new Error('Invalid parameters passed to storeResponseFrequenciesToHeroActions');
        }

        // Path inside heroActions array (villain responses w.r.t hero action)
        const path = `heroActions.${actionIndex}.responseFrequencies`;

        const payload = {
            ...validated.adjustedFrequencies,
            confidence: validated.confidence ?? null,
            metadata: validated.metadata ?? null
        };

        return Hand.updateOne({ _id: handId }, { $set: { [path]: payload } });
    },
    /**
     * Persists GTO frequencies calculated in Step 11o into heroActions array.
     *
     * @param {String|ObjectId} handId
     * @param {Number} actionIndex
     * @param {Object} gtoResult – object returned by calculateNashEquilibriumGTOResponses()
     */
    async storeGTOFrequenciesToHeroActions(handId, actionIndex, gtoResult) {
        if (!handId || actionIndex === undefined || !gtoResult || !gtoResult.frequencies) {
            throw new Error('Invalid parameters passed to storeGTOFrequenciesToHeroActions');
        }
        const path = `heroActions.${actionIndex}.gtoFrequencies`;
        const payload = {
            ...gtoResult.frequencies,
            confidence: gtoResult.gtoConfidence ?? null,
            overrideStrength: gtoResult.overrideStrength ?? null,
            metadata: gtoResult.metadata ?? null
        };
        return Hand.updateOne({ _id: handId }, { $set: { [path]: payload } });
    }
}; 