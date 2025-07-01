/**
 * Step 11q7: Generate Frequency Ranges
 * Creates min/max ranges for each frequency to account for uncertainty in opponent modeling.
 * 
 * @param {Object} confidenceWeightedFrequencies - The confidence-weighted frequencies from step 11q6
 * @param {Object} confidenceAnalysis - The confidence analysis from step 11q6
 * @param {Object} opponentRange - The opponent's range analysis from step 11c
 * @param {Object} verificationResult - The verification result from step 11q3
 * @param {Object} normalizedFrequencies - The normalized frequencies from step 11q5
 * @returns {Object} Frequency ranges with confidence intervals
 */
function generateFrequencyRanges(
    confidenceWeightedFrequencies,
    confidenceAnalysis,
    opponentRange,
    verificationResult,
    normalizedFrequencies
) {
    if (!confidenceWeightedFrequencies || !confidenceWeightedFrequencies.success) {
        return {
            success: false,
            error: 'Missing confidence-weighted frequencies from previous step',
            frequencyRanges: null
        };
    }

    const frequencies = confidenceWeightedFrequencies.confidenceWeightedFrequencies;
    const foldFreq = frequencies.foldFrequency;
    const callFreq = frequencies.callFrequency;
    const raiseFreq = frequencies.raiseFrequency;

    // Calculate base uncertainty based on confidence level
    const baseUncertainty = calculateBaseUncertainty(confidenceAnalysis.overall);

    // Calculate range-specific uncertainties
    const foldUncertainty = calculateFoldUncertainty(foldFreq, opponentRange, confidenceAnalysis);
    const callUncertainty = calculateCallUncertainty(callFreq, verificationResult, confidenceAnalysis);
    const raiseUncertainty = calculateRaiseUncertainty(raiseFreq, opponentRange, confidenceAnalysis);

    // Generate frequency ranges
    const frequencyRanges = {
        fold: generateFrequencyRange(foldFreq, foldUncertainty, 'fold'),
        call: generateFrequencyRange(callFreq, callUncertainty, 'call'),
        raise: generateFrequencyRange(raiseFreq, raiseUncertainty, 'raise')
    };

    // Validate that ranges are consistent (sum to approximately 1.0)
    const rangeValidation = validateFrequencyRanges(frequencyRanges);

    // Calculate confidence intervals
    const confidenceIntervals = {
        fold: calculateConfidenceInterval(frequencyRanges.fold, confidenceAnalysis.overall.level),
        call: calculateConfidenceInterval(frequencyRanges.call, confidenceAnalysis.overall.level),
        raise: calculateConfidenceInterval(frequencyRanges.raise, confidenceAnalysis.overall.level)
    };

    // Generate uncertainty factors
    const uncertaintyFactors = {
        opponentRangeSize: calculateOpponentRangeUncertainty(opponentRange),
        verificationConsistency: calculateVerificationUncertainty(verificationResult),
        confidenceLevel: calculateConfidenceLevelUncertainty(confidenceAnalysis.overall),
        frequencyMagnitude: calculateFrequencyMagnitudeUncertainty(frequencies)
    };

    return {
        success: true,
        frequencyRanges,
        confidenceIntervals,
        uncertaintyFactors,
        validation: rangeValidation,
        metadata: {
            baseUncertainty,
            foldUncertainty,
            callUncertainty,
            raiseUncertainty,
            overallConfidence: confidenceAnalysis.overall.level,
            averageUncertainty: (foldUncertainty + callUncertainty + raiseUncertainty) / 3
        }
    };
}

/**
 * Calculate base uncertainty based on overall confidence level
 */
function calculateBaseUncertainty(overallConfidence) {
    switch (overallConfidence.level) {
        case 'high':
            return 0.05; // 5% uncertainty for high confidence
        case 'medium':
            return 0.10; // 10% uncertainty for medium confidence
        case 'low':
            return 0.20; // 20% uncertainty for low confidence
        default:
            return 0.15; // Default 15% uncertainty
    }
}

/**
 * Calculate fold frequency uncertainty
 */
function calculateFoldUncertainty(foldFreq, opponentRange, confidenceAnalysis) {
    let uncertainty = calculateBaseUncertainty(confidenceAnalysis.overall);

    // Adjust based on opponent range size
    if (opponentRange && opponentRange.rangeSize) {
        if (opponentRange.rangeSize < 10) {
            uncertainty += 0.05; // Small range = more uncertainty
        } else if (opponentRange.rangeSize > 100) {
            uncertainty -= 0.02; // Large range = less uncertainty
        }
    }

    // Adjust based on fold frequency magnitude
    if (foldFreq > 0.8) {
        uncertainty += 0.03; // Very high fold frequency = more uncertainty
    } else if (foldFreq < 0.2) {
        uncertainty += 0.03; // Very low fold frequency = more uncertainty
    }

    // Adjust based on confidence scores
    const foldConfidence = confidenceAnalysis.scores.fold.score;
    if (foldConfidence < 0.4) {
        uncertainty += 0.05;
    } else if (foldConfidence > 0.8) {
        uncertainty -= 0.03;
    }

    return Math.max(0.02, Math.min(0.4, uncertainty)); // Clamp between 2% and 40%
}

/**
 * Calculate call frequency uncertainty
 */
function calculateCallUncertainty(callFreq, verificationResult, confidenceAnalysis) {
    let uncertainty = calculateBaseUncertainty(confidenceAnalysis.overall);

    // Adjust based on verification consistency
    if (verificationResult && verificationResult.verification) {
        const consistency = verificationResult.verification.consistency.level;
        if (consistency === 'low') {
            uncertainty += 0.08; // Low consistency = high uncertainty
        } else if (consistency === 'high') {
            uncertainty -= 0.03; // High consistency = low uncertainty
        }
    }

    // Adjust based on call frequency magnitude
    if (callFreq > 0.7) {
        uncertainty += 0.04; // Very high call frequency = more uncertainty
    } else if (callFreq < 0.1) {
        uncertainty += 0.04; // Very low call frequency = more uncertainty
    }

    // Adjust based on confidence scores
    const callConfidence = confidenceAnalysis.scores.call.score;
    if (callConfidence < 0.4) {
        uncertainty += 0.05;
    } else if (callConfidence > 0.8) {
        uncertainty -= 0.03;
    }

    return Math.max(0.02, Math.min(0.4, uncertainty));
}

/**
 * Calculate raise frequency uncertainty
 */
function calculateRaiseUncertainty(raiseFreq, opponentRange, confidenceAnalysis) {
    let uncertainty = calculateBaseUncertainty(confidenceAnalysis.overall);

    // Adjust based on opponent range strength
    if (opponentRange && opponentRange.averageStrength) {
        if (opponentRange.averageStrength === 'very_weak' || opponentRange.averageStrength === 'very_strong') {
            uncertainty -= 0.03; // Clear range strength = less uncertainty
        } else if (opponentRange.averageStrength === 'medium') {
            uncertainty += 0.05; // Unclear range strength = more uncertainty
        }
    }

    // Adjust based on raise frequency magnitude
    if (raiseFreq > 0.4) {
        uncertainty += 0.06; // Very high raise frequency = more uncertainty
    } else if (raiseFreq < 0.05) {
        uncertainty += 0.06; // Very low raise frequency = more uncertainty
    }

    // Adjust based on confidence scores
    const raiseConfidence = confidenceAnalysis.scores.raise.score;
    if (raiseConfidence < 0.4) {
        uncertainty += 0.05;
    } else if (raiseConfidence > 0.8) {
        uncertainty -= 0.03;
    }

    return Math.max(0.02, Math.min(0.4, uncertainty));
}

/**
 * Generate frequency range for a specific frequency
 */
function generateFrequencyRange(frequency, uncertainty, frequencyType) {
    const range = uncertainty * frequency;
    const min = Math.max(0, frequency - range);
    const max = Math.min(1, frequency + range);
    const mid = (min + max) / 2;

    return {
        frequency,
        min,
        max,
        mid,
        range: max - min,
        uncertainty,
        type: frequencyType,
        confidence: calculateRangeConfidence(frequency, uncertainty, frequencyType)
    };
}

/**
 * Calculate confidence level for a frequency range
 */
function calculateRangeConfidence(frequency, uncertainty, frequencyType) {
    let confidence = 'medium';

    if (uncertainty < 0.05) {
        confidence = 'high';
    } else if (uncertainty > 0.15) {
        confidence = 'low';
    }

    // Adjust based on frequency magnitude
    if (frequency > 0.8 || frequency < 0.2) {
        confidence = Math.min(confidence, 'medium'); // Extreme values reduce confidence
    }

    return confidence;
}

/**
 * Validate that frequency ranges are consistent
 */
function validateFrequencyRanges(frequencyRanges) {
    const minSum = frequencyRanges.fold.min + frequencyRanges.call.min + frequencyRanges.raise.min;
    const maxSum = frequencyRanges.fold.max + frequencyRanges.call.max + frequencyRanges.raise.max;
    const midSum = frequencyRanges.fold.mid + frequencyRanges.call.mid + frequencyRanges.raise.mid;

    const tolerance = 0.1; // Allow 10% deviation from 1.0

    const validation = {
        minSumValid: Math.abs(minSum - 1.0) <= tolerance,
        maxSumValid: Math.abs(maxSum - 1.0) <= tolerance,
        midSumValid: Math.abs(midSum - 1.0) <= tolerance,
        minSum,
        maxSum,
        midSum,
        minDeviation: Math.abs(minSum - 1.0),
        maxDeviation: Math.abs(maxSum - 1.0),
        midDeviation: Math.abs(midSum - 1.0)
    };

    validation.isValid = validation.minSumValid && validation.maxSumValid && validation.midSumValid;

    return validation;
}

/**
 * Calculate confidence intervals for each frequency
 */
function calculateConfidenceInterval(frequencyRange, confidenceLevel) {
    const { min, max, mid, uncertainty } = frequencyRange;

    // Calculate different confidence levels
    const intervals = {
        '90%': {
            min: Math.max(0, mid - 1.645 * uncertainty * mid),
            max: Math.min(1, mid + 1.645 * uncertainty * mid)
        },
        '95%': {
            min: Math.max(0, mid - 1.96 * uncertainty * mid),
            max: Math.min(1, mid + 1.96 * uncertainty * mid)
        },
        '99%': {
            min: Math.max(0, mid - 2.576 * uncertainty * mid),
            max: Math.min(1, mid + 2.576 * uncertainty * mid)
        }
    };

    return {
        point: mid,
        range: { min, max },
        intervals,
        uncertainty,
        confidenceLevel
    };
}

/**
 * Calculate uncertainty based on opponent range size
 */
function calculateOpponentRangeUncertainty(opponentRange) {
    if (!opponentRange || !opponentRange.rangeSize) {
        return 0.15; // Default uncertainty
    }

    const rangeSize = opponentRange.rangeSize;
    
    if (rangeSize < 5) {
        return 0.25; // Very small range = high uncertainty
    } else if (rangeSize < 20) {
        return 0.20; // Small range = high uncertainty
    } else if (rangeSize < 50) {
        return 0.15; // Medium range = medium uncertainty
    } else if (rangeSize < 100) {
        return 0.10; // Large range = low uncertainty
    } else {
        return 0.05; // Very large range = very low uncertainty
    }
}

/**
 * Calculate uncertainty based on verification consistency
 */
function calculateVerificationUncertainty(verificationResult) {
    if (!verificationResult || !verificationResult.verification) {
        return 0.20; // Default uncertainty
    }

    const consistency = verificationResult.verification.consistency.level;
    
    switch (consistency) {
        case 'high':
            return 0.05;
        case 'medium':
            return 0.15;
        case 'low':
            return 0.30;
        default:
            return 0.20;
    }
}

/**
 * Calculate uncertainty based on confidence level
 */
function calculateConfidenceLevelUncertainty(overallConfidence) {
    switch (overallConfidence.level) {
        case 'high':
            return 0.05;
        case 'medium':
            return 0.15;
        case 'low':
            return 0.30;
        default:
            return 0.20;
    }
}

/**
 * Calculate uncertainty based on frequency magnitude
 */
function calculateFrequencyMagnitudeUncertainty(frequencies) {
    const { foldFrequency, callFrequency, raiseFrequency } = frequencies;
    
    let uncertainty = 0;
    
    // Extreme frequencies have higher uncertainty
    if (foldFrequency > 0.8 || foldFrequency < 0.2) uncertainty += 0.05;
    if (callFrequency > 0.7 || callFrequency < 0.1) uncertainty += 0.05;
    if (raiseFrequency > 0.4 || raiseFrequency < 0.05) uncertainty += 0.05;
    
    // Balanced frequencies have lower uncertainty
    if (foldFrequency > 0.3 && foldFrequency < 0.7) uncertainty -= 0.02;
    if (callFrequency > 0.2 && callFrequency < 0.6) uncertainty -= 0.02;
    if (raiseFrequency > 0.1 && raiseFrequency < 0.3) uncertainty -= 0.02;
    
    return Math.max(0, uncertainty);
}

module.exports = {
    generateFrequencyRanges,
    calculateBaseUncertainty,
    calculateFoldUncertainty,
    calculateCallUncertainty,
    calculateRaiseUncertainty,
    generateFrequencyRange,
    calculateRangeConfidence,
    validateFrequencyRanges,
    calculateConfidenceInterval,
    calculateOpponentRangeUncertainty,
    calculateVerificationUncertainty,
    calculateConfidenceLevelUncertainty,
    calculateFrequencyMagnitudeUncertainty
}; 