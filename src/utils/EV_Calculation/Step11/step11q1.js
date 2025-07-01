/**
 * Step 11q1: Aggregate All Adjustment Factors
 * Combines all adjustment factors (range strength, position, stack depth, multiway, street patterns)
 * into a weighted average adjustment factor for base frequencies.
 * 
 * @param {Object} baseFoldFrequency - The base fold frequency from step 11e
 * @param {Object} rangeStrengthAdjustment - The range strength adjustment from step 11f
 * @param {Object} positionAdjustment - The position adjustment from step 11g
 * @param {Object} stackDepthAdjustment - The stack depth adjustment from step 11h
 * @param {Object} multiwayAdjustment - The multiway adjustment from step 11i
 * @param {Object} streetPatterns - The street-specific patterns from step 11d
 * @returns {Object} Aggregated adjustment factors analysis
 */
function aggregateAllAdjustmentFactors(
    baseFoldFrequency,
    rangeStrengthAdjustment,
    positionAdjustment,
    stackDepthAdjustment,
    multiwayAdjustment,
    streetPatterns
) {
    if (!baseFoldFrequency) {
        return {
            success: false,
            error: 'Base fold frequency is required for aggregation',
            aggregatedFactors: null
        };
    }

    // Define importance weights for each adjustment factor
    const adjustmentWeights = {
        rangeStrength: 0.35,    // Most important - opponent's range strength
        position: 0.25,         // Important - position effects
        stackDepth: 0.20,       // Important - stack depth considerations
        multiway: 0.15,         // Moderate - multiway vs heads-up
        streetPatterns: 0.05    // Minor - street-specific patterns
    };

    // Extract adjustment factors with fallbacks
    const factors = {
        rangeStrength: {
            factor: rangeStrengthAdjustment?.adjustmentFactor || 1.0,
            weight: adjustmentWeights.rangeStrength,
            description: rangeStrengthAdjustment?.adjustmentReason || 'No range strength adjustment applied'
        },
        position: {
            factor: positionAdjustment?.positionAdjustment || 1.0,
            weight: adjustmentWeights.position,
            description: positionAdjustment?.positionReason || 'No position adjustment applied'
        },
        stackDepth: {
            factor: stackDepthAdjustment?.stackDepthAdjustment || 1.0,
            weight: adjustmentWeights.stackDepth,
            description: stackDepthAdjustment?.stackDepthReason || 'No stack depth adjustment applied'
        },
        multiway: {
            factor: multiwayAdjustment?.multiwayAdjustment || 1.0,
            weight: adjustmentWeights.multiway,
            description: multiwayAdjustment?.multiwayReason || 'No multiway adjustment applied'
        },
        streetPatterns: {
            factor: streetPatterns?.streetAdjustmentFactor || 1.0,
            weight: adjustmentWeights.streetPatterns,
            description: streetPatterns?.streetAdjustmentReason || 'No street pattern adjustment applied'
        }
    };

    // Calculate weighted average adjustment factor
    let totalWeightedFactor = 0;
    let totalWeight = 0;
    let factorBreakdown = [];

    for (const [factorName, factorData] of Object.entries(factors)) {
        const weightedFactor = factorData.factor * factorData.weight;
        totalWeightedFactor += weightedFactor;
        totalWeight += factorData.weight;

        factorBreakdown.push({
            factorName,
            factor: factorData.factor,
            weight: factorData.weight,
            weightedFactor,
            description: factorData.description
        });
    }

    const combinedAdjustmentFactor = totalWeight > 0 ? totalWeightedFactor / totalWeight : 1.0;

    // Calculate the impact of each factor
    const factorImpacts = factorBreakdown.map(factor => ({
        ...factor,
        impact: ((factor.factor - 1.0) * factor.weight * 100).toFixed(2) + '%'
    }));

    // Determine which factors had the most significant impact
    const significantFactors = factorImpacts
        .filter(factor => Math.abs(factor.factor - 1.0) > 0.1)
        .sort((a, b) => Math.abs(b.factor - 1.0) - Math.abs(a.factor - 1.0));

    // Calculate confidence in the aggregation
    let confidenceLevel = 'medium';
    let confidenceFactors = [];

    if (significantFactors.length >= 3) {
        confidenceLevel = 'high';
        confidenceFactors.push('Multiple significant adjustment factors present');
    } else if (significantFactors.length === 0) {
        confidenceLevel = 'low';
        confidenceFactors.push('No significant adjustments applied');
    }

    if (Math.abs(combinedAdjustmentFactor - 1.0) > 0.3) {
        confidenceFactors.push('Large overall adjustment suggests high confidence in factors');
    }

    // Check for conflicting adjustments
    const positiveAdjustments = factorImpacts.filter(f => f.factor > 1.0);
    const negativeAdjustments = factorImpacts.filter(f => f.factor < 1.0);

    if (positiveAdjustments.length > 0 && negativeAdjustments.length > 0) {
        confidenceFactors.push('Conflicting adjustments present - may reduce confidence');
        confidenceLevel = 'medium';
    }

    return {
        success: true,
        aggregatedFactors: {
            combinedAdjustmentFactor,
            factorBreakdown,
            factorImpacts,
            significantFactors,
            totalWeight,
            confidence: {
                level: confidenceLevel,
                factors: confidenceFactors
            }
        },
        metadata: {
            baseFoldFrequency: baseFoldFrequency.baseFoldFrequency,
            adjustedFoldFrequency: baseFoldFrequency.baseFoldFrequency * combinedAdjustmentFactor,
            adjustmentDirection: combinedAdjustmentFactor > 1.0 ? 'increase' : 'decrease',
            adjustmentMagnitude: Math.abs(combinedAdjustmentFactor - 1.0)
        }
    };
}

module.exports = {
    aggregateAllAdjustmentFactors
}; 