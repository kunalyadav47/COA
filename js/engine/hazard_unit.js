/**
 * Computer Organization & Architecture (COA)
 * Comprehensive Pipeline Hazard Detection & Resolution Unit
 * 
 * Handles:
 * 1. Data Hazards (RAW dependencies, EX/MEM forwarding, MEM/WB forwarding, Load-Use stalls)
 * 2. Structural Hazards (Von Neumann unified memory contention vs Harvard dual-port)
 * 3. Control Hazards (Static Predict-Not-Taken, 2-Bit Saturating Predictor, Branch Delays, Pipeline Flushes)
 */

(function(exports) {
  'use strict';

  class HazardUnit {
    constructor(options = {}) {
      // Configuration settings
      this.forwardingEnabled = options.forwardingEnabled !== undefined ? options.forwardingEnabled : true;
      this.branchPredictionMode = options.branchPredictionMode || 'predict-not-taken'; // 'predict-not-taken', 'predict-taken', '2bit-dynamic'
      this.memoryArchitecture = options.memoryArchitecture || 'harvard'; // 'harvard' or 'von-neumann'
      this.branchResolveStage = options.branchResolveStage || 'ID'; // 'ID' (early branch, 1 cycle penalty) or 'EX' (standard, 2 cycle penalty)
      this.branchDelaySlot = options.branchDelaySlot || false;

      // 2-bit branch predictor table (PC -> 2-bit state 0..3)
      // 0: Strongly Not Taken, 1: Weakly Not Taken, 2: Weakly Taken, 3: Strongly Taken
      this.branchPredictorTable = {};
      this.branchTargetBuffer = {}; // PC -> predicted target address
    }

    reset() {
      this.branchPredictorTable = {};
      this.branchTargetBuffer = {};
    }

    /**
     * Compute forwarding multiplexer control lines (ForwardA, ForwardB)
     * Values:
     * 00 (0): No forwarding. Operand comes from ID/EX register.
     * 10 (2): Forward from EX/MEM stage (ALU result).
     * 01 (1): Forward from MEM/WB stage (ALU result or loaded memory data).
     */
    computeForwarding(idEx, exMem, memWb) {
      if (!this.forwardingEnabled || !idEx || idEx.isBubble) {
        return { forwardA: 0, forwardB: 0, explanationA: 'No forwarding', explanationB: 'No forwarding' };
      }

      let forwardA = 0;
      let forwardB = 0;
      let explanationA = 'Register File (ID/EX)';
      let explanationB = 'Register File (ID/EX)';

      const rs = idEx.rs;
      const rt = idEx.rt;

      // EX Hazard for ForwardA
      if (exMem && !exMem.isBubble && exMem.ctrl && exMem.ctrl.regWrite && exMem.writeReg !== 0 && exMem.writeReg === rs) {
        forwardA = 2; // 0b10
        explanationA = `Forwarded from EX/MEM ($r${rs} ALU result)`;
      }
      // MEM Hazard for ForwardA (only if not forwarded by EX stage)
      else if (memWb && !memWb.isBubble && memWb.ctrl && memWb.ctrl.regWrite && memWb.writeReg !== 0 && memWb.writeReg === rs) {
        forwardA = 1; // 0b01
        explanationA = `Forwarded from MEM/WB ($r${rs} WriteBack value)`;
      }

      // Check if current EX instruction actually reads rt as an operand (R-type, SW, BEQ, BNE)
      const usesRtAsSource = idEx.inst && (idEx.inst.type === 'R' || idEx.inst.mnemonic === 'SW' || idEx.inst.mnemonic === 'BEQ' || idEx.inst.mnemonic === 'BNE');

      if (usesRtAsSource) {
        // EX Hazard for ForwardB
        if (exMem && !exMem.isBubble && exMem.ctrl && exMem.ctrl.regWrite && exMem.writeReg !== 0 && exMem.writeReg === rt) {
          forwardB = 2; // 0b10
          explanationB = `Forwarded from EX/MEM ($r${rt} ALU result)`;
        }
        // MEM Hazard for ForwardB
        else if (memWb && !memWb.isBubble && memWb.ctrl && memWb.ctrl.regWrite && memWb.writeReg !== 0 && memWb.writeReg === rt) {
          forwardB = 1; // 0b01
          explanationB = `Forwarded from MEM/WB ($r${rt} WriteBack value)`;
        }
      }

      return { forwardA, forwardB, explanationA, explanationB };
    }

    /**
     * Check for Data Hazards requiring stalls (e.g. Load-Use hazard, or unforwarded RAW)
     * Returns: { stall: boolean, reason: string }
     */
    detectDataStall(ifId, idEx, exMem, memWb) {
      if (!ifId || ifId.isBubble || !ifId.inst) {
        return { stall: false, reason: null };
      }

      const ifIdInst = ifId.inst;
      const readsRs = ifIdInst.rs !== null && ifIdInst.rs !== undefined && ifIdInst.rs !== 0;
      const readsRt = ifIdInst.rt !== null && ifIdInst.rt !== undefined && ifIdInst.rt !== 0 &&
                      (ifIdInst.type === 'R' || ifIdInst.mnemonic === 'SW' || ifIdInst.mnemonic === 'BEQ' || ifIdInst.mnemonic === 'BNE');

      // 1. Forwarding is ENABLED:
      if (this.forwardingEnabled) {
        // Load-Use Hazard for general instructions
        if (idEx && !idEx.isBubble && idEx.ctrl && idEx.ctrl.memRead) {
          const loadDest = idEx.writeReg || idEx.rt;
          if (loadDest !== 0 && ((readsRs && loadDest === ifIdInst.rs) || (readsRt && loadDest === ifIdInst.rt))) {
            return {
              stall: true,
              hazardType: 'DATA_LOAD_USE',
              reason: `Load-Use RAW Hazard: Instruction '${ifIdInst.mnemonic}' depends on LW loading into $r${loadDest}. 1-cycle pipeline bubble required.`
            };
          }
        }

        // Branch in ID stage requires operands available in ID:
        const isBranchInst = (ifIdInst.mnemonic === 'BEQ' || ifIdInst.mnemonic === 'BNE');
        if (isBranchInst) {
          // If instruction in EX is a LW, its loaded data is not ready in EX stage
          if (idEx && !idEx.isBubble && idEx.ctrl && idEx.ctrl.memRead && idEx.writeReg !== 0) {
            if (idEx.writeReg === ifIdInst.rs || idEx.writeReg === ifIdInst.rt) {
              return {
                stall: true,
                hazardType: 'DATA_BRANCH_DEP_EX_LOAD',
                reason: `Branch Load Dependency: Branch in ID depends on $r${idEx.writeReg} currently loading from Memory. Pipeline stalled.`
              };
            }
          }
          // If instruction in MEM is a LW, its loaded data is not ready until WB
          if (exMem && !exMem.isBubble && exMem.ctrl && exMem.ctrl.memRead && exMem.writeReg !== 0) {
            if (exMem.writeReg === ifIdInst.rs || exMem.writeReg === ifIdInst.rt) {
              return {
                stall: true,
                hazardType: 'DATA_BRANCH_DEP_MEM_LOAD',
                reason: `Branch Load Dependency: Branch in ID depends on $r${exMem.writeReg} currently loading from Memory. 1-cycle stall required.`
              };
            }
          }
        }

        return { stall: false, reason: null };
      }

      // 2. Forwarding is DISABLED (Stall-Only Architecture):
      // With split-phase register file clocking (write-before-read: WB writes in first half,
      // ID reads in second half), dependencies with EX and MEM require stalling.
      const activeStages = [
        { stageName: 'EX', reg: idEx },
        { stageName: 'MEM', reg: exMem }
      ];

      for (const item of activeStages) {
        const stageReg = item.reg;
        if (stageReg && !stageReg.isBubble && stageReg.ctrl && stageReg.ctrl.regWrite && stageReg.writeReg !== 0) {
          const wReg = stageReg.writeReg;
          if ((readsRs && wReg === ifIdInst.rs) || (readsRt && wReg === ifIdInst.rt)) {
            return {
              stall: true,
              hazardType: 'DATA_RAW_NO_FORWARDING',
              reason: `RAW Data Hazard (No Forwarding): Stage ${item.stageName} writes to $r${wReg}, needed by '${ifIdInst.mnemonic}'. Pipeline stalled.`
            };
          }
        }
      }

      return { stall: false, reason: null };
    }

    /**
     * Check for Structural Hazards
     * Returns: { stall: boolean, reason: string }
     */
    detectStructuralStall(ifActive, memStage) {
      if (this.memoryArchitecture === 'von-neumann') {
        // In Von Neumann architecture, single unified memory port
        if (ifActive && memStage && !memStage.isBubble && memStage.ctrl && (memStage.ctrl.memRead || memStage.ctrl.memWrite)) {
          return {
            stall: true,
            hazardType: 'STRUCTURAL_MEMORY',
            reason: `Structural Memory Hazard: Unified memory accessed concurrently by IF (fetch) and MEM (${memStage.ctrl.memRead ? 'read' : 'write'}). IF stalled 1 cycle.`
          };
        }
      }
      return { stall: false, reason: null };
    }

    /**
     * Predict whether branch will be taken
     */
    predictBranch(pc) {
      if (this.branchPredictionMode === 'predict-not-taken') {
        return { predictTaken: false, predictedTarget: pc + 4, confidence: 'Static Not Taken' };
      }
      if (this.branchPredictionMode === 'predict-taken') {
        const target = this.branchTargetBuffer[pc] !== undefined ? this.branchTargetBuffer[pc] : pc + 4;
        return { predictTaken: true, predictedTarget: target, confidence: 'Static Taken' };
      }
      if (this.branchPredictionMode === '2bit-dynamic') {
        const state = this.branchPredictorTable[pc] !== undefined ? this.branchPredictorTable[pc] : 1; // default Weakly Not Taken (01)
        const predictTaken = state >= 2;
        const target = this.branchTargetBuffer[pc] !== undefined ? this.branchTargetBuffer[pc] : pc + 4;
        const stateNames = ['Strongly Not Taken (00)', 'Weakly Not Taken (01)', 'Weakly Taken (10)', 'Strongly Taken (11)'];
        return { predictTaken, predictedTarget: target, confidence: stateNames[state], state };
      }
      return { predictTaken: false, predictedTarget: pc + 4, confidence: 'Default Not Taken' };
    }

    /**
     * Update 2-bit branch predictor after branch resolution
     */
    updateBranchOutcome(pc, target, actuallyTaken) {
      if (this.branchPredictionMode === '2bit-dynamic') {
        let state = this.branchPredictorTable[pc] !== undefined ? this.branchPredictorTable[pc] : 1;
        if (actuallyTaken) {
          state = Math.min(3, state + 1);
        } else {
          state = Math.max(0, state - 1);
        }
        this.branchPredictorTable[pc] = state;
      }
      if (actuallyTaken) {
        this.branchTargetBuffer[pc] = target;
      }
    }
  }

  exports.HazardUnit = HazardUnit;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.HazardUnitModule = {}));
