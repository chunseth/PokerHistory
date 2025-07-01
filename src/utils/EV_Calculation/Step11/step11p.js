/**
 * Step 11p: Validate Response Frequencies
 * -------------------------------------------------------------
 * Uses the probabilities generated in Step 11o1 (calculateWeightedResponseProbabilities)
 * to ensure they are internally consistent, respect minimum/maximum bounds,
 * and sum to exactly 1. If any issues are detected the frequencies are
 * adjusted in the least-invasive way possible and the caller is informed.
 *
 * The function is intentionally kept self-contained so it can be plugged into
 * the wider EV calculation pipeline immediately after Step 11o1.
 *
 * @param {Object} weightedResponse – The object returned by
 *        calculateWeightedResponseProbabilities() in step11o1.js
 * @param {Object} [options] – Optional validation options
 * @param {number} [options.minRaise] – Minimum allowable raise probability (default 0.02)
 * @param {number} [options.tolerance] – Allowed numeric tolerance when checking if
 *        probabilities sum to 1 (default 0.001)
 * @returns {Object} Validation result containing flags and (possibly) corrected frequencies
 */
function validateResponseFrequencies(weightedResponse, options = {}) {
  const MIN_RAISE = typeof options.minRaise === 'number' ? options.minRaise : 0.02; // 2 %
  const TOLERANCE = typeof options.tolerance === 'number' ? options.tolerance : 0.001;

  if (!weightedResponse || typeof weightedResponse !== 'object' || !weightedResponse.probabilities) {
    return {
      isValid: false,
      wasAdjusted: false,
      adjustmentReason: 'No probabilities provided',
      adjustedFrequencies: null,
      originalProbabilities: null
    };
  }

  const { fold: inFold = 0, call: inCall = 0, raise: inRaise = 0 } = weightedResponse.probabilities;

  // Helper to clamp a value to the [0,1] interval
  const clamp01 = (x) => Math.min(1, Math.max(0, x));

  // Start with the incoming values
  let fold = inFold;
  let call = inCall;
  let raise = inRaise;
  const reasons = [];
  let wasAdjusted = false;

  // 1. Clamp extremes
  if (fold < 0 || fold > 1 || call < 0 || call > 1 || raise < 0 || raise > 1) {
    fold = clamp01(fold);
    call = clamp01(call);
    raise = clamp01(raise);
    wasAdjusted = true;
    reasons.push('Probabilities clamped to the [0,1] range');
  }

  // 2. Enforce minimum raise probability (important in poker theory)
  if (raise < MIN_RAISE) {
    const diff = MIN_RAISE - raise;

    // Reduce fold and call proportionally to free up the deficit
    const available = fold + call;
    if (available > 0) {
      const foldShare = fold / available;
      const callShare = call / available;
      fold -= diff * foldShare;
      call -= diff * callShare;
      raise = MIN_RAISE;
      wasAdjusted = true;
      reasons.push(`Minimum raise probability of ${MIN_RAISE} enforced`);
    } else {
      // Edge-case: nothing to redistribute, just set raise to min and renormalise later
      raise = MIN_RAISE;
      wasAdjusted = true;
      reasons.push('Raise probability below minimum with no room to redistribute');
    }
  }

  // 3. Normalise so that fold + call + raise = 1 (within tolerance)
  let total = fold + call + raise;
  if (Math.abs(total - 1) > TOLERANCE && total > 0) {
    fold /= total;
    call /= total;
    raise /= total;
    wasAdjusted = true;
    reasons.push('Probabilities normalised to sum to 1');
  }

  // 4. Final guard – if for some pathological reason we still violate constraints, fall back to base frequencies
  total = fold + call + raise;
  const isValid =
    Math.abs(total - 1) <= TOLERANCE &&
    fold >= 0 && call >= 0 && raise >= MIN_RAISE &&
    fold <= 1 && call <= 1 && raise <= 1;

  if (!isValid) {
    return {
      isValid: false,
      wasAdjusted: true,
      adjustmentReason: 'Unable to correct probabilities with given constraints',
      adjustedFrequencies: { fold, call, raise },
      originalProbabilities: weightedResponse.probabilities
    };
  }

  return {
    isValid: !wasAdjusted,
    wasAdjusted,
    adjustmentReason: reasons.join('; ') || null,
    adjustedFrequencies: { fold, call, raise },
    originalProbabilities: weightedResponse.probabilities,
    confidence: weightedResponse.confidence,
    ranges: weightedResponse.ranges,
    metadata: weightedResponse.metadata
  };
}

module.exports = {
  validateResponseFrequencies
}; 