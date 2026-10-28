/**
 * Computer Organization & Architecture (COA)
 * Quantitative Performance Analysis & Amdahl's Law Calculator
 */

(function(exports) {
  'use strict';

  class PerformanceModel {
    /**
     * Compute Amdahl's Law Overall Speedup
     * @param {number} fractionEnhanced (0.0 to 1.0)
     * @param {number} speedupEnhanced (> 1.0)
     * @returns {{ overallSpeedup: number, maxTheoreticalSpeedup: number, executionTimeRatio: number }}
     */
    static calculateAmdahl(fractionEnhanced, speedupEnhanced) {
      const f = Math.max(0, Math.min(1, fractionEnhanced));
      const s = Math.max(1, speedupEnhanced);

      const enhancedExecutionTime = (1 - f) + (f / s);
      const overallSpeedup = 1 / enhancedExecutionTime;
      const maxTheoreticalSpeedup = 1 / (1 - f); // When s -> infinity

      return {
        fractionEnhanced: f,
        speedupEnhanced: s,
        overallSpeedup: parseFloat(overallSpeedup.toFixed(4)),
        maxTheoreticalSpeedup: f === 1 ? Infinity : parseFloat(maxTheoreticalSpeedup.toFixed(4)),
        executionTimeRatio: parseFloat(enhancedExecutionTime.toFixed(4))
      };
    }

    /**
     * Generate sensitivity curve data points for Amdahl's Law (varying fraction from 0% to 100%)
     */
    static generateAmdahlCurve(speedupValues = [2, 4, 8, 16]) {
      const fractions = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0];
      const results = {};

      for (const s of speedupValues) {
        results[s] = fractions.map(f => {
          const res = this.calculateAmdahl(f, s);
          return { f: Math.round(f * 100), speedup: res.overallSpeedup };
        });
      }

      return results;
    }

    /**
     * Calculate theoretical pipeline speedup using standard COA textbook formula:
     * S = (n * k) / (k + n - 1 + stall_cycles)
     */
    static calculateTheoreticalPipeline(numInstructions, numStages = 5, stallCycles = 0) {
      const n = numInstructions;
      const k = numStages;
      const unpipelinedCycles = n * k;
      const pipelinedCycles = k + n - 1 + stallCycles;
      const idealCycles = k + n - 1;

      const actualSpeedup = unpipelinedCycles / pipelinedCycles;
      const idealSpeedup = unpipelinedCycles / idealCycles;
      const efficiency = (actualSpeedup / k) * 100;
      const cpi = pipelinedCycles / n;

      return {
        n,
        k,
        stallCycles,
        unpipelinedCycles,
        pipelinedCycles,
        idealCycles,
        actualSpeedup: parseFloat(actualSpeedup.toFixed(3)),
        idealSpeedup: parseFloat(idealSpeedup.toFixed(3)),
        efficiency: parseFloat(efficiency.toFixed(2)),
        cpi: parseFloat(cpi.toFixed(3))
      };
    }
  }

  exports.PerformanceModel = PerformanceModel;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.PerformanceModule = {}));
