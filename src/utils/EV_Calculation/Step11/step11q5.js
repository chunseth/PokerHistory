/**
 * Step 11q5: Normalize Frequencies to Sum to 1.0
 * Ensures that fold, call, and raise frequencies sum to exactly 1.0 while maintaining their relative relationships.
 * 
 * @param {Object} raiseFrequencyResult - The raise frequency result from step 11q4
 * @param {Object} callFrequencyResult - The call frequency result from step 11q3
 * @param {Object} adjustedFrequencies - The adjusted frequencies from step 11q2
 * @returns {Object} Normalized frequencies analysis
 */
function normalizeFrequenciesToSumToOne(raiseFrequencyResult, callFrequencyResult, adjustedFrequencies) {
    if (!raiseFrequencyResult || !raiseFrequencyResult.success || 
        !callFrequencyResult || !callFrequencyResult.success ||
        !adjustedFrequencies || !adjustedFrequencies.success) {
        return {
            success: false,
            error: 'Missing required frequency results from previous steps',
            normalizedFrequencies: null
        };
    }

    // Extract current frequencies
    const foldFreq = adjustedFrequencies.adjustedFrequencies.adjustedFoldFrequency;
    const callFreq = callFrequencyResult.callFrequency.callFrequency;
    const raiseFreq = raiseFrequencyResult.raiseFrequency.raiseFrequency;

    // Calculate current sum
    const currentSum = foldFreq + callFreq + raiseFreq;
    const targetSum = 1.0;
    const difference = Math.abs(currentSum - targetSum);

    // Check if normalization is needed
    const tolerance = 0.001; // Allow for small floating point errors
    const needsNormalization = difference > tolerance;

    let normalizedFrequencies;
    let normalizationMethod = 'none';
    let normalizationReason = 'Frequencies already sum to 1.0';

    if (needsNormalization) {
        // Method 1: Proportional scaling (maintains relative relationships)
        if (currentSum > 0) {
            const scalingFactor = targetSum / currentSum;
            const normalizedFold = foldFreq * scalingFactor;
            const normalizedCall = callFreq * scalingFactor;
            const normalizedRaise = raiseFreq * scalingFactor;

            normalizedFrequencies = {
                foldFrequency: normalizedFold,
                callFrequency: normalizedCall,
                raiseFrequency: normalizedRaise,
                totalFrequency: targetSum
            };

            normalizationMethod = 'proportional_scaling';
            normalizationReason = `Scaled all frequencies by factor ${scalingFactor.toFixed(4)} to sum to 1.0`;
        } else {
            // All frequencies are zero - assign equal probabilities
            normalizedFrequencies = {
                foldFrequency: 1/3,
                callFrequency: 1/3,
                raiseFrequency: 1/3,
                totalFrequency: targetSum
            };

            normalizationMethod = 'equal_distribution';
            normalizationReason = 'All frequencies were zero, assigned equal probabilities';
        }
    } else {
        // No normalization needed
        normalizedFrequencies = {
            foldFrequency: foldFreq,
            callFrequency: callFreq,
            raiseFrequency: raiseFreq,
            totalFrequency: currentSum
        };
    }

    // Calculate the impact of normalization
    const originalFrequencies = {
        foldFrequency: foldFreq,
        callFrequency: callFreq,
        raiseFrequency: raiseFreq,
        totalFrequency: currentSum
    };

    const frequencyChanges = {
        foldChange: normalizedFrequencies.foldFrequency - foldFreq,
        callChange: normalizedFrequencies.callFrequency - callFreq,
        raiseChange: normalizedFrequencies.raiseFrequency - raiseFreq
    };

    const percentageChanges = {
        foldPercentageChange: foldFreq > 0 ? ((frequencyChanges.foldChange / foldFreq) * 100).toFixed(2) + '%' : 'N/A',
        callPercentageChange: callFreq > 0 ? ((frequencyChanges.callChange / callFreq) * 100).toFixed(2) + '%' : 'N/A',
        raisePercentageChange: raiseFreq > 0 ? ((frequencyChanges.raiseChange / raiseFreq) * 100).toFixed(2) + '%' : 'N/A'
    };

    // Validate the normalized frequencies
    const normalizedSum = normalizedFrequencies.foldFrequency + normalizedFrequencies.callFrequency + normalizedFrequencies.raiseFrequency;
    const isValidSum = Math.abs(normalizedSum - 1.0) < tolerance;

    // Check if any frequency is outside reasonable bounds
    const validationChecks = {
        foldValid: normalizedFrequencies.foldFrequency >= 0 && normalizedFrequencies.foldFrequency <= 1,
        callValid: normalizedFrequencies.callFrequency >= 0 && normalizedFrequencies.callFrequency <= 1,
        raiseValid: normalizedFrequencies.raiseFrequency >= 0 && normalizedFrequencies.raiseFrequency <= 1,
        sumValid: isValidSum
    };

    const allValid = Object.values(validationChecks).every(valid => valid);

    // Calculate confidence in normalization
    let confidenceLevel = 'high';
    let confidenceFactors = [];

    if (!needsNormalization) {
        confidenceFactors.push('No normalization required - frequencies already sum to 1.0');
    } else if (normalizationMethod === 'proportional_scaling') {
        if (difference < 0.1) {
            confidenceFactors.push('Minor normalization required - high confidence');
        } else if (difference < 0.2) {
            confidenceLevel = 'medium';
            confidenceFactors.push('Moderate normalization required - medium confidence');
        } else {
            confidenceLevel = 'low';
            confidenceFactors.push('Major normalization required - low confidence in original calculations');
        }
    } else if (normalizationMethod === 'equal_distribution') {
        confidenceLevel = 'low';
        confidenceFactors.push('Equal distribution applied - original calculations may be unreliable');
    }

    if (!allValid) {
        confidenceLevel = 'low';
        confidenceFactors.push('Normalized frequencies failed validation checks');
    }

    // Determine if the normalization preserved the intended relationships
    const preservedRelationships = {
        foldVsCall: (foldFreq > callFreq) === (normalizedFrequencies.foldFrequency > normalizedFrequencies.callFrequency),
        foldVsRaise: (foldFreq > raiseFreq) === (normalizedFrequencies.foldFrequency > normalizedFrequencies.raiseFrequency),
        callVsRaise: (callFreq > raiseFreq) === (normalizedFrequencies.callFrequency > normalizedFrequencies.raiseFrequency)
    };

    const allRelationshipsPreserved = Object.values(preservedRelationships).every(preserved => preserved);

    if (!allRelationshipsPreserved) {
        confidenceLevel = 'low';
        confidenceFactors.push('Normalization changed relative frequency relationships');
    }

    return {
        success: true,
        normalizedFrequencies,
        normalization: {
            wasNeeded: needsNormalization,
            method: normalizationMethod,
            reason: normalizationReason,
            originalSum: currentSum,
            targetSum: targetSum,
            difference: difference
        },
        changes: {
            originalFrequencies,
            frequencyChanges,
            percentageChanges
        },
        validation: {
            isValid: allValid,
            checks: validationChecks,
            normalizedSum: normalizedSum,
            sumAccuracy: Math.abs(normalizedSum - 1.0)
        },
        relationships: {
            preserved: allRelationshipsPreserved,
            details: preservedRelationships
        },
        confidence: {
            level: confidenceLevel,
            factors: confidenceFactors
        }
    };
}

module.exports = {
    normalizeFrequenciesToSumToOne
}; 