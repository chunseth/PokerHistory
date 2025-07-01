/**
 * Step 11q8: Finalize Response Frequency Object
 * Packages all frequency calculations into a structured object for use in the EV calculation pipeline.
 * 
 * @param {Object} frequencyRanges - The frequency ranges from step 11q7
 * @param {Object} confidenceWeightedFrequencies - The confidence-weighted frequencies from step 11q6
 * @param {Object} normalizedFrequencies - The normalized frequencies from step 11q5
 * @param {Object} raiseFrequencyResult - The raise frequency result from step 11q4
 * @param {Object} callFrequencyResult - The call frequency result from step 11q3
 * @param {Object} adjustedFrequencies - The adjusted frequencies from step 11q2
 * @param {Object} aggregatedFactors - The aggregated adjustment factors from step 11q1
 * @param {Object} verificationResult - The verification result from step 11q3
 * @param {Object} independentCallFrequency - The independent call frequency calculation
 * @returns {Object} Finalized response frequency object
 */
function finalizeResponseFrequencyObject(
    frequencyRanges,
    confidenceWeightedFrequencies,
    normalizedFrequencies,
    raiseFrequencyResult,
    callFrequencyResult,
    adjustedFrequencies,
    aggregatedFactors,
    verificationResult,
    independentCallFrequency
) {
    if (!frequencyRanges || !frequencyRanges.success) {
        return {
            success: false,
            error: 'Missing frequency ranges from previous step',
            finalizedResponseFrequencies: null
        };
    }

    // Extract all frequency values
    const finalFrequencies = {
        point: {
            fold: confidenceWeightedFrequencies.confidenceWeightedFrequencies.foldFrequency,
            call: confidenceWeightedFrequencies.confidenceWeightedFrequencies.callFrequency,
            raise: confidenceWeightedFrequencies.confidenceWeightedFrequencies.raiseFrequency
        },
        ranges: {
            fold: frequencyRanges.frequencyRanges.fold,
            call: frequencyRanges.frequencyRanges.call,
            raise: frequencyRanges.frequencyRanges.raise
        },
        confidenceIntervals: frequencyRanges.confidenceIntervals
    };

    // Calculate summary statistics
    const summaryStats = calculateSummaryStatistics(finalFrequencies, frequencyRanges);

    // Generate quality assessment
    const qualityAssessment = assessResponseFrequencyQuality(
        frequencyRanges,
        confidenceWeightedFrequencies,
        verificationResult,
        aggregatedFactors
    );

    // Create calculation metadata
    const calculationMetadata = createCalculationMetadata(
        normalizedFrequencies,
        raiseFrequencyResult,
        callFrequencyResult,
        adjustedFrequencies,
        aggregatedFactors,
        verificationResult,
        independentCallFrequency
    );

    // Generate recommendations
    const recommendations = generateResponseFrequencyRecommendations(
        finalFrequencies,
        qualityAssessment,
        frequencyRanges
    );

    // Create validation summary
    const validationSummary = createValidationSummary(
        frequencyRanges,
        confidenceWeightedFrequencies,
        normalizedFrequencies
    );

    // Package everything into the final object
    const finalizedResponseFrequencies = {
        // Core frequency data
        frequencies: finalFrequencies,
        
        // Summary and quality information
        summary: summaryStats,
        quality: qualityAssessment,
        
        // Calculation details
        metadata: calculationMetadata,
        
        // Recommendations and guidance
        recommendations,
        
        // Validation and confidence
        validation: validationSummary,
        
        // Timestamp and version
        timestamp: new Date().toISOString(),
        version: '1.0',
        
        // Success indicator
        success: true
    };

    return {
        success: true,
        finalizedResponseFrequencies,
        exportFormats: {
            json: finalizedResponseFrequencies,
            simplified: createSimplifiedExport(finalizedResponseFrequencies),
            evReady: createEVReadyFormat(finalizedResponseFrequencies)
        }
    };
}

/**
 * Calculate summary statistics for the response frequencies
 */
function calculateSummaryStatistics(finalFrequencies, frequencyRanges) {
    const { point, ranges } = finalFrequencies;
    
    // Calculate total frequency (should be 1.0)
    const totalFrequency = point.fold + point.call + point.raise;
    
    // Calculate average uncertainty
    const averageUncertainty = (
        ranges.fold.uncertainty + 
        ranges.call.uncertainty + 
        ranges.raise.uncertainty
    ) / 3;
    
    // Determine dominant response
    let dominantResponse = 'balanced';
    if (point.fold > 0.6) dominantResponse = 'fold_dominant';
    else if (point.call > 0.6) dominantResponse = 'call_dominant';
    else if (point.raise > 0.3) dominantResponse = 'raise_dominant';
    
    // Calculate range widths
    const rangeWidths = {
        fold: ranges.fold.max - ranges.fold.min,
        call: ranges.call.max - ranges.call.min,
        raise: ranges.raise.max - ranges.raise.min
    };
    
    const averageRangeWidth = (rangeWidths.fold + rangeWidths.call + rangeWidths.raise) / 3;
    
    return {
        totalFrequency,
        averageUncertainty,
        dominantResponse,
        rangeWidths,
        averageRangeWidth,
        frequencyDistribution: {
            foldPercentage: (point.fold * 100).toFixed(1) + '%',
            callPercentage: (point.call * 100).toFixed(1) + '%',
            raisePercentage: (point.raise * 100).toFixed(1) + '%'
        }
    };
}

/**
 * Assess the quality of the response frequency calculations
 */
function assessResponseFrequencyQuality(frequencyRanges, confidenceWeightedFrequencies, verificationResult, aggregatedFactors) {
    let overallQuality = 'medium';
    let qualityFactors = [];
    let qualityScore = 0.5; // Base score
    
    // Assess based on confidence level
    const confidenceLevel = confidenceWeightedFrequencies.confidenceAnalysis.overall.level;
    if (confidenceLevel === 'high') {
        qualityScore += 0.3;
        qualityFactors.push('High confidence in calculations');
    } else if (confidenceLevel === 'low') {
        qualityScore -= 0.2;
        qualityFactors.push('Low confidence in calculations');
    }
    
    // Assess based on verification consistency
    if (verificationResult && verificationResult.verification) {
        const consistency = verificationResult.verification.consistency.level;
        if (consistency === 'high') {
            qualityScore += 0.2;
            qualityFactors.push('High verification consistency');
        } else if (consistency === 'low') {
            qualityScore -= 0.2;
            qualityFactors.push('Low verification consistency');
        }
    }
    
    // Assess based on range validation
    if (frequencyRanges.validation.isValid) {
        qualityScore += 0.1;
        qualityFactors.push('Frequency ranges are mathematically valid');
    } else {
        qualityScore -= 0.1;
        qualityFactors.push('Frequency ranges have validation issues');
    }
    
    // Assess based on uncertainty levels
    const averageUncertainty = frequencyRanges.metadata.averageUncertainty;
    if (averageUncertainty < 0.1) {
        qualityScore += 0.2;
        qualityFactors.push('Low average uncertainty');
    } else if (averageUncertainty > 0.2) {
        qualityScore -= 0.2;
        qualityFactors.push('High average uncertainty');
    }
    
    // Determine overall quality
    if (qualityScore >= 0.8) {
        overallQuality = 'high';
    } else if (qualityScore <= 0.3) {
        overallQuality = 'low';
    }
    
    return {
        overallQuality,
        qualityScore: Math.max(0, Math.min(1, qualityScore)),
        qualityFactors,
        confidenceLevel,
        averageUncertainty
    };
}

/**
 * Create calculation metadata
 */
function createCalculationMetadata(
    normalizedFrequencies,
    raiseFrequencyResult,
    callFrequencyResult,
    adjustedFrequencies,
    aggregatedFactors,
    verificationResult,
    independentCallFrequency
) {
    return {
        calculationSteps: {
            step11q1: 'Aggregated adjustment factors',
            step11q2: 'Applied adjustments to base frequencies',
            step11q3: 'Calculated call frequency from fold frequency',
            step11q4: 'Calculated raise frequency based on context',
            step11q5: 'Normalized frequencies to sum to 1.0',
            step11q6: 'Applied confidence weighting',
            step11q7: 'Generated frequency ranges',
            step11q8: 'Finalized response frequency object'
        },
        calculationDetails: {
            normalizationApplied: normalizedFrequencies.normalization.wasNeeded,
            normalizationMethod: normalizedFrequencies.normalization.method,
            confidenceWeightingApplied: confidenceWeightedFrequencies.confidenceAnalysis.weightingMethod,
            verificationUsed: verificationResult ? true : false,
            independentCalculationUsed: independentCallFrequency ? true : false
        },
        adjustmentFactors: aggregatedFactors ? {
            rangeStrengthAdjustment: aggregatedFactors.aggregatedFactors.factorBreakdown.find(f => f.factorName === 'rangeStrength')?.factor || 1.0,
            positionAdjustment: aggregatedFactors.aggregatedFactors.factorBreakdown.find(f => f.factorName === 'position')?.factor || 1.0,
            stackDepthAdjustment: aggregatedFactors.aggregatedFactors.factorBreakdown.find(f => f.factorName === 'stackDepth')?.factor || 1.0,
            multiwayAdjustment: aggregatedFactors.aggregatedFactors.factorBreakdown.find(f => f.factorName === 'multiway')?.factor || 1.0
        } : null
    };
}

/**
 * Generate recommendations based on the response frequencies
 */
function generateResponseFrequencyRecommendations(finalFrequencies, qualityAssessment, frequencyRanges) {
    const recommendations = [];
    
    // Quality-based recommendations
    if (qualityAssessment.overallQuality === 'low') {
        recommendations.push('Consider collecting more data about opponent tendencies');
        recommendations.push('Use conservative EV estimates due to high uncertainty');
    } else if (qualityAssessment.overallQuality === 'high') {
        recommendations.push('High confidence in response frequencies - proceed with EV calculations');
    }
    
    // Frequency-based recommendations
    const { point, ranges } = finalFrequencies;
    
    if (point.fold > 0.7) {
        recommendations.push('High fold frequency suggests bluffing opportunities');
    }
    
    if (point.call > 0.6) {
        recommendations.push('High call frequency suggests value betting with strong hands');
    }
    
    if (point.raise > 0.3) {
        recommendations.push('Significant raise frequency - be prepared for aggression');
    }
    
    // Uncertainty-based recommendations
    const averageUncertainty = frequencyRanges.metadata.averageUncertainty;
    if (averageUncertainty > 0.15) {
        recommendations.push('High uncertainty - consider multiple EV scenarios');
    }
    
    // Range-based recommendations
    const rangeWidths = {
        fold: ranges.fold.max - ranges.fold.min,
        call: ranges.call.max - ranges.call.min,
        raise: ranges.raise.max - ranges.raise.min
    };
    
    if (rangeWidths.fold > 0.3) {
        recommendations.push('Large fold frequency range - opponent fold tendency is unclear');
    }
    
    return recommendations;
}

/**
 * Create validation summary
 */
function createValidationSummary(frequencyRanges, confidenceWeightedFrequencies, normalizedFrequencies) {
    return {
        frequencySumValidation: {
            isValid: Math.abs(confidenceWeightedFrequencies.confidenceWeightedFrequencies.totalFrequency - 1.0) < 0.001,
            totalFrequency: confidenceWeightedFrequencies.confidenceWeightedFrequencies.totalFrequency,
            deviation: Math.abs(confidenceWeightedFrequencies.confidenceWeightedFrequencies.totalFrequency - 1.0)
        },
        rangeValidation: frequencyRanges.validation,
        confidenceValidation: {
            overallConfidence: confidenceWeightedFrequencies.confidenceAnalysis.overall.level,
            confidenceFactors: confidenceWeightedFrequencies.confidenceAnalysis.overall.factors
        },
        normalizationValidation: {
            wasApplied: normalizedFrequencies.normalization.wasNeeded,
            method: normalizedFrequencies.normalization.method,
            adjustment: normalizedFrequencies.normalization.difference
        }
    };
}

/**
 * Create simplified export format
 */
function createSimplifiedExport(finalizedResponseFrequencies) {
    return {
        fold: finalizedResponseFrequencies.frequencies.point.fold,
        call: finalizedResponseFrequencies.frequencies.point.call,
        raise: finalizedResponseFrequencies.frequencies.point.raise,
        quality: finalizedResponseFrequencies.quality.overallQuality,
        confidence: finalizedResponseFrequencies.frequencies.ranges.fold.confidence
    };
}

/**
 * Create EV-ready format
 */
function createEVReadyFormat(finalizedResponseFrequencies) {
    return {
        responseFrequencies: {
            fold: finalizedResponseFrequencies.frequencies.point.fold,
            call: finalizedResponseFrequencies.frequencies.point.call,
            raise: finalizedResponseFrequencies.frequencies.point.raise
        },
        confidenceLevel: finalizedResponseFrequencies.quality.confidenceLevel,
        uncertainty: finalizedResponseFrequencies.frequencies.ranges.fold.uncertainty,
        quality: finalizedResponseFrequencies.quality.overallQuality,
        recommendations: finalizedResponseFrequencies.recommendations.slice(0, 3) // Top 3 recommendations
    };
}

module.exports = {
    finalizeResponseFrequencyObject,
    calculateSummaryStatistics,
    assessResponseFrequencyQuality,
    createCalculationMetadata,
    generateResponseFrequencyRecommendations,
    createValidationSummary,
    createSimplifiedExport,
    createEVReadyFormat
}; 