/**
 * Step 11q6: Apply Confidence Weighting
 * Weights frequencies based on data quality and confidence levels from previous calculations.
 * 
 * @param {Object} normalizedFrequencies - The normalized frequencies from step 11q5
 * @param {Object} callFrequencyResult - The call frequency result from step 11q3
 * @param {Object} independentCallFrequency - The independent call frequency calculation
 * @param {Object} verificationResult - The verification result comparing derived vs independent
 * @param {Object} raiseFrequencyResult - The raise frequency result from step 11q4
 * @param {Object} adjustedFrequencies - The adjusted frequencies from step 11q2
 * @param {Object} aggregatedFactors - The aggregated adjustment factors from step 11q1
 * @returns {Object} Confidence-weighted frequencies analysis
 */
function applyConfidenceWeighting(
    normalizedFrequencies,
    callFrequencyResult,
    independentCallFrequency,
    verificationResult,
    raiseFrequencyResult,
    adjustedFrequencies,
    aggregatedFactors
) {
    if (!normalizedFrequencies || !normalizedFrequencies.success) {
        return {
            success: false,
            error: 'Missing normalized frequencies from previous step',
            confidenceWeightedFrequencies: null
        };
    }

    // Extract base frequencies
    const baseFrequencies = normalizedFrequencies.normalizedFrequencies;
    const foldFreq = baseFrequencies.foldFrequency;
    const callFreq = baseFrequencies.callFrequency;
    const raiseFreq = baseFrequencies.raiseFrequency;

    // Calculate confidence scores for each frequency component
    const confidenceScores = {
        fold: calculateFoldConfidenceScore(adjustedFrequencies, aggregatedFactors),
        call: calculateCallConfidenceScore(callFrequencyResult, independentCallFrequency, verificationResult),
        raise: calculateRaiseConfidenceScore(raiseFrequencyResult)
    };

    // Calculate overall confidence level
    const overallConfidence = calculateOverallConfidenceLevel(confidenceScores);

    // Apply confidence weighting
    let weightedFrequencies;
    let weightingMethod = 'none';
    let weightingReason = 'No confidence weighting applied';

    if (overallConfidence.level === 'low') {
        // Low confidence - apply conservative weighting
        weightedFrequencies = applyConservativeWeighting(baseFrequencies, confidenceScores);
        weightingMethod = 'conservative';
        weightingReason = 'Low overall confidence - applied conservative weighting';
    } else if (overallConfidence.level === 'medium') {
        // Medium confidence - apply moderate weighting
        weightedFrequencies = applyModerateWeighting(baseFrequencies, confidenceScores);
        weightingMethod = 'moderate';
        weightingReason = 'Medium overall confidence - applied moderate weighting';
    } else {
        // High confidence - minimal weighting
        weightedFrequencies = applyMinimalWeighting(baseFrequencies, confidenceScores);
        weightingMethod = 'minimal';
        weightingReason = 'High overall confidence - applied minimal weighting';
    }

    // Ensure frequencies still sum to 1.0 after weighting
    const weightedSum = weightedFrequencies.foldFrequency + weightedFrequencies.callFrequency + weightedFrequencies.raiseFrequency;
    const tolerance = 0.001;

    if (Math.abs(weightedSum - 1.0) > tolerance) {
        // Renormalize if needed
        const scalingFactor = 1.0 / weightedSum;
        weightedFrequencies = {
            foldFrequency: weightedFrequencies.foldFrequency * scalingFactor,
            callFrequency: weightedFrequencies.callFrequency * scalingFactor,
            raiseFrequency: weightedFrequencies.raiseFrequency * scalingFactor,
            totalFrequency: 1.0
        };
        weightingReason += ' - renormalized after weighting';
    }

    // Calculate the impact of confidence weighting
    const frequencyChanges = {
        foldChange: weightedFrequencies.foldFrequency - foldFreq,
        callChange: weightedFrequencies.callFrequency - callFreq,
        raiseChange: weightedFrequencies.raiseFrequency - raiseFreq
    };

    const percentageChanges = {
        foldPercentageChange: foldFreq > 0 ? ((frequencyChanges.foldChange / foldFreq) * 100).toFixed(2) + '%' : 'N/A',
        callPercentageChange: callFreq > 0 ? ((frequencyChanges.callChange / callFreq) * 100).toFixed(2) + '%' : 'N/A',
        raisePercentageChange: raiseFreq > 0 ? ((frequencyChanges.raiseChange / raiseFreq) * 100).toFixed(2) + '%' : 'N/A'
    };

    return {
        success: true,
        confidenceWeightedFrequencies: weightedFrequencies,
        confidenceAnalysis: {
            scores: confidenceScores,
            overall: overallConfidence,
            weightingMethod,
            weightingReason
        },
        changes: {
            originalFrequencies: baseFrequencies,
            frequencyChanges,
            percentageChanges,
            totalChange: Math.abs(frequencyChanges.foldChange) + Math.abs(frequencyChanges.callChange) + Math.abs(frequencyChanges.raiseChange)
        },
        validation: {
            isValid: Math.abs(weightedSum - 1.0) <= tolerance,
            weightedSum: weightedSum,
            sumAccuracy: Math.abs(weightedSum - 1.0)
        }
    };
}

/**
 * Calculate confidence score for fold frequency
 */
function calculateFoldConfidenceScore(adjustedFrequencies, aggregatedFactors) {
    let score = 0.5; // Base score
    let factors = [];

    if (adjustedFrequencies && adjustedFrequencies.confidence) {
        const confidence = adjustedFrequencies.confidence.level;
        if (confidence === 'high') {
            score += 0.3;
            factors.push('High confidence in fold frequency calculation');
        } else if (confidence === 'medium') {
            score += 0.1;
            factors.push('Medium confidence in fold frequency calculation');
        } else {
            score -= 0.2;
            factors.push('Low confidence in fold frequency calculation');
        }
    }

    if (aggregatedFactors && aggregatedFactors.aggregatedFactors) {
        const confidence = aggregatedFactors.aggregatedFactors.confidence.level;
        if (confidence === 'high') {
            score += 0.2;
            factors.push('High confidence in adjustment factors');
        } else if (confidence === 'low') {
            score -= 0.1;
            factors.push('Low confidence in adjustment factors');
        }
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        factors
    };
}

/**
 * Calculate confidence score for call frequency
 */
function calculateCallConfidenceScore(callFrequencyResult, independentCallFrequency, verificationResult) {
    let score = 0.5; // Base score
    let factors = [];

    if (callFrequencyResult && callFrequencyResult.confidence) {
        const confidence = callFrequencyResult.confidence.level;
        if (confidence === 'high') {
            score += 0.2;
            factors.push('High confidence in derived call frequency');
        } else if (confidence === 'low') {
            score -= 0.1;
            factors.push('Low confidence in derived call frequency');
        }
    }

    if (independentCallFrequency && independentCallFrequency.independentCallFrequency) {
        const confidence = independentCallFrequency.independentCallFrequency.confidence.level;
        if (confidence === 'high') {
            score += 0.2;
            factors.push('High confidence in independent call frequency');
        } else if (confidence === 'low') {
            score -= 0.1;
            factors.push('Low confidence in independent call frequency');
        }
    }

    if (verificationResult && verificationResult.verification) {
        const consistency = verificationResult.verification.consistency.level;
        if (consistency === 'high') {
            score += 0.3;
            factors.push('High consistency between call frequency calculations');
        } else if (consistency === 'medium') {
            score += 0.1;
            factors.push('Medium consistency between call frequency calculations');
        } else {
            score -= 0.2;
            factors.push('Low consistency between call frequency calculations');
        }
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        factors
    };
}

/**
 * Calculate confidence score for raise frequency
 */
function calculateRaiseConfidenceScore(raiseFrequencyResult) {
    let score = 0.5; // Base score
    let factors = [];

    if (raiseFrequencyResult && raiseFrequencyResult.confidence) {
        const confidence = raiseFrequencyResult.confidence.level;
        if (confidence === 'high') {
            score += 0.3;
            factors.push('High confidence in raise frequency calculation');
        } else if (confidence === 'medium') {
            score += 0.1;
            factors.push('Medium confidence in raise frequency calculation');
        } else {
            score -= 0.2;
            factors.push('Low confidence in raise frequency calculation');
        }
    }

    if (raiseFrequencyResult && raiseFrequencyResult.validation) {
        if (raiseFrequencyResult.validation.isValid) {
            score += 0.1;
            factors.push('Raise frequency validation passed');
        } else {
            score -= 0.2;
            factors.push('Raise frequency validation failed');
        }
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        factors
    };
}

/**
 * Calculate overall confidence level
 */
function calculateOverallConfidenceLevel(confidenceScores) {
    const avgScore = (confidenceScores.fold.score + confidenceScores.call.score + confidenceScores.raise.score) / 3;
    
    let level = 'medium';
    let factors = [];

    if (avgScore >= 0.7) {
        level = 'high';
        factors.push('High average confidence score');
    } else if (avgScore <= 0.4) {
        level = 'low';
        factors.push('Low average confidence score');
    }

    // Check for consistency across components
    const scores = [confidenceScores.fold.score, confidenceScores.call.score, confidenceScores.raise.score];
    const variance = calculateVariance(scores);
    
    if (variance < 0.05) {
        factors.push('High consistency across frequency components');
    } else if (variance > 0.15) {
        level = Math.min(level, 'medium');
        factors.push('Low consistency across frequency components');
    }

    return {
        level,
        averageScore: avgScore,
        variance,
        factors
    };
}

/**
 * Apply conservative weighting for low confidence
 */
function applyConservativeWeighting(baseFrequencies, confidenceScores) {
    // Conservative weighting reduces extreme values
    const conservativeFactor = 0.8;
    
    return {
        foldFrequency: baseFrequencies.foldFrequency * (0.5 + confidenceScores.fold.score * 0.5),
        callFrequency: baseFrequencies.callFrequency * (0.5 + confidenceScores.call.score * 0.5),
        raiseFrequency: baseFrequencies.raiseFrequency * (0.5 + confidenceScores.raise.score * 0.5),
        totalFrequency: 1.0
    };
}

/**
 * Apply moderate weighting for medium confidence
 */
function applyModerateWeighting(baseFrequencies, confidenceScores) {
    // Moderate weighting applies confidence scores directly
    return {
        foldFrequency: baseFrequencies.foldFrequency * confidenceScores.fold.score,
        callFrequency: baseFrequencies.callFrequency * confidenceScores.call.score,
        raiseFrequency: baseFrequencies.raiseFrequency * confidenceScores.raise.score,
        totalFrequency: 1.0
    };
}

/**
 * Apply minimal weighting for high confidence
 */
function applyMinimalWeighting(baseFrequencies, confidenceScores) {
    // Minimal weighting - slight adjustments only
    const minimalFactor = 0.95;
    
    return {
        foldFrequency: baseFrequencies.foldFrequency * (minimalFactor + (1 - minimalFactor) * confidenceScores.fold.score),
        callFrequency: baseFrequencies.callFrequency * (minimalFactor + (1 - minimalFactor) * confidenceScores.call.score),
        raiseFrequency: baseFrequencies.raiseFrequency * (minimalFactor + (1 - minimalFactor) * confidenceScores.raise.score),
        totalFrequency: 1.0
    };
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(numbers) {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
}

module.exports = {
    applyConfidenceWeighting,
    calculateFoldConfidenceScore,
    calculateCallConfidenceScore,
    calculateRaiseConfidenceScore,
    calculateOverallConfidenceLevel,
    applyConservativeWeighting,
    applyModerateWeighting,
    applyMinimalWeighting,
    calculateVariance
}; 