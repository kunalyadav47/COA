/**
 * Computer Organization & Architecture (COA)
 * Complete 5-Stage Pipelined Processor Datapath Model
 * 
 * Stages:
 * 1. IF  - Instruction Fetch
 * 2. ID  - Instruction Decode & Register Read (Hardwired Control Unit)
 * 3. EX  - Execute & Address Calculation (ALU & Forwarding MUXes)
 * 4. MEM - Memory Access (Data Memory Read/Write)
 * 5. WB  - Write Back (Register File Write Port)
 */

(function(exports) {
  'use strict';

  const ISA = typeof require !== 'undefined' ? require('./isa') : window.ISA;
  const { HazardUnit } = typeof require !== 'undefined' ? require('./hazard_unit') : window.HazardUnitModule;

  class PipelinedCPU {
    constructor(options = {}) {
      this.options = options;
      this.hazardUnit = new HazardUnit(options);

      // Architectural State
      this.registers = new Int32Array(32);
      this.dataMemory = new Int32Array(1024); // 4KB word-aligned data memory
      this.instructionMemory = [];
      this.pc = 0;
      this.cycleCount = 0;
      this.instructionsRetired = 0;
      this.isHalted = false;

      // Pipeline Inter-Stage Registers
      this.IF_ID = this.createEmptyPipelineReg();
      this.ID_EX = this.createEmptyPipelineReg();
      this.EX_MEM = this.createEmptyPipelineReg();
      this.MEM_WB = this.createEmptyPipelineReg();

      // Cycle-by-cycle Execution Trace for Space-Time Diagram & Verification
      // cycleRecords[cycleIndex] = { cycle, stages: { IF, ID, EX, MEM, WB }, events: [], registers, memoryDiff }
      this.cycleHistory = [];
      // instructionGrid[instructionIndex] = [ { cycle, stage, status } ]
      this.instructionGrid = [];
      // dynamicTrace = list of executed dynamic instruction instances
      this.dynamicTrace = [];
      this.dynamicInstSeq = 0;

      // Performance counters
      this.stats = {
        totalCycles: 0,
        instructionsRetired: 0,
        dataStallCycles: 0,
        structuralStallCycles: 0,
        controlFlushCycles: 0,
        forwardingEvents: 0,
        branchPredictions: 0,
        branchMispredictions: 0
      };
    }

    createEmptyPipelineReg() {
      return {
        isBubble: true,
        inst: null,
        pc: null,
        ctrl: {},
        bubbleReason: null
      };
    }

    reset() {
      this.registers.fill(0);
      this.dataMemory.fill(0);
      this.pc = 0;
      this.cycleCount = 0;
      this.instructionsRetired = 0;
      this.isHalted = false;

      this.IF_ID = this.createEmptyPipelineReg();
      this.ID_EX = this.createEmptyPipelineReg();
      this.EX_MEM = this.createEmptyPipelineReg();
      this.MEM_WB = this.createEmptyPipelineReg();

      this.cycleHistory = [];
      this.instructionGrid = [];
      this.dynamicTrace = [];
      this.dynamicInstSeq = 0;

      this.stats = {
        totalCycles: 0,
        instructionsRetired: 0,
        dataStallCycles: 0,
        structuralStallCycles: 0,
        controlFlushCycles: 0,
        forwardingEvents: 0,
        branchPredictions: 0,
        branchMispredictions: 0
      };

      this.hazardUnit.reset();
    }

    loadProgram(instructions, initialData = {}) {
      this.reset();
      this.instructionMemory = instructions.slice();

      // Initialize any custom memory data
      for (const [addr, val] of Object.entries(initialData)) {
        const wordIdx = Math.floor(parseInt(addr, 10) / 4);
        if (wordIdx >= 0 && wordIdx < this.dataMemory.length) {
          this.dataMemory[wordIdx] = val;
        }
      }

      // Initialize grid rows for all instructions
      this.instructionGrid = instructions.map((inst, idx) => ({
        instIndex: idx,
        pc: inst.pc,
        rawAsm: inst.rawAsm,
        stagesByCycle: {} // cycle -> stage name ('IF', 'ID', etc.)
      }));
    }

    /**
     * Decode control signals for instruction (Hardwired Control Unit)
     */
    generateControlSignals(inst) {
      if (!inst || inst.mnemonic === 'NOP') {
        return {
          regDst: 0, aluSrc: 0, memtoReg: 0, regWrite: false,
          memRead: false, memWrite: false, branch: false, bne: false,
          jump: false, aluOp: 'NOP'
        };
      }

      const ctrl = {
        regDst: 0,        // 0: rt, 1: rd
        aluSrc: 0,        // 0: readData2, 1: signExtImm
        memtoReg: 0,      // 0: aluResult, 1: memData
        regWrite: false,  // write to register file
        memRead: false,   // read data memory
        memWrite: false,  // write data memory
        branch: false,    // BEQ
        bne: false,       // BNE
        jump: false,      // J
        jal: false,       // JAL
        jr: false,        // JR
        aluOp: inst.mnemonic
      };

      switch (inst.type) {
        case 'R':
          if (inst.mnemonic === 'JR') {
            ctrl.jr = true;
            ctrl.regWrite = false;
          } else {
            ctrl.regDst = 1; // destination is rd
            ctrl.aluSrc = 0; // 2nd operand is register rt
            ctrl.regWrite = true;
            ctrl.memtoReg = 0;
          }
          break;

        case 'I':
          if (inst.mnemonic === 'LW') {
            ctrl.regDst = 0; // destination is rt
            ctrl.aluSrc = 1; // add immediate offset
            ctrl.memRead = true;
            ctrl.memtoReg = 1; // loaded data into rt
            ctrl.regWrite = true;
            ctrl.aluOp = 'ADD';
          } else if (inst.mnemonic === 'SW') {
            ctrl.aluSrc = 1; // add immediate offset
            ctrl.memWrite = true;
            ctrl.aluOp = 'ADD';
          } else if (inst.mnemonic === 'BEQ') {
            ctrl.branch = true;
            ctrl.aluOp = 'SUB';
          } else if (inst.mnemonic === 'BNE') {
            ctrl.bne = true;
            ctrl.aluOp = 'SUB';
          } else {
            // ADDI, ANDI, ORI, XORI, SLTI
            ctrl.regDst = 0; // destination is rt
            ctrl.aluSrc = 1; // immediate operand
            ctrl.regWrite = true;
            ctrl.memtoReg = 0;
          }
          break;

        case 'J':
          ctrl.jump = true;
          if (inst.mnemonic === 'JAL') {
            ctrl.jal = true;
            ctrl.regWrite = true;
            ctrl.regDst = 2; // R31 ($ra)
            ctrl.memtoReg = 0;
          }
          break;
      }

      return ctrl;
    }

    /**
     * Execute one clock cycle through all 5 pipeline stages in reverse order
     * (WB -> MEM -> EX -> ID -> IF) to ensure correct inter-stage latching.
     */
    stepCycle() {
      if (this.isHalted) {
        return false;
      }

      const currentCycle = this.cycleCount + 1;
      this.cycleCount = currentCycle;
      this.stats.totalCycles = currentCycle;

      const cycleEvents = [];

      // -------------------------------------------------------------
      // 1. WB Stage (Write-Back)
      // -------------------------------------------------------------
      let wbRetiredInst = null;
      if (!this.MEM_WB.isBubble && this.MEM_WB.inst) {
        const memWb = this.MEM_WB;
        if (memWb.ctrl && memWb.ctrl.regWrite && memWb.writeReg !== 0) {
          const finalVal = memWb.ctrl.memtoReg === 1 ? memWb.memData : memWb.aluResult;
          this.registers[memWb.writeReg] = finalVal;
          cycleEvents.push({
            stage: 'WB',
            type: 'REG_WRITE',
            message: `Wrote value ${finalVal} (0x${(finalVal >>> 0).toString(16)}) to $r${memWb.writeReg}`
          });
        }
        if (memWb.inst.mnemonic !== 'NOP') {
          this.instructionsRetired++;
          this.stats.instructionsRetired = this.instructionsRetired;
          wbRetiredInst = { ...memWb.inst, dynamicId: memWb.dynamicId };
        }
      }

      // -------------------------------------------------------------
      // 2. MEM Stage (Memory Access)
      // -------------------------------------------------------------
      let next_MEM_WB = this.createEmptyPipelineReg();

      if (!this.EX_MEM.isBubble && this.EX_MEM.inst) {
        const exMem = this.EX_MEM;
        let memData = 0;

        if (exMem.ctrl.memRead) {
          const byteAddr = exMem.aluResult;
          const wordIdx = Math.floor(byteAddr / 4);
          if (wordIdx >= 0 && wordIdx < this.dataMemory.length) {
            memData = this.dataMemory[wordIdx];
            cycleEvents.push({
              stage: 'MEM',
              type: 'MEM_READ',
              message: `Read ${memData} from Mem[${byteAddr}] (word index ${wordIdx})`
            });
          }
        } else if (exMem.ctrl.memWrite) {
          const byteAddr = exMem.aluResult;
          const wordIdx = Math.floor(byteAddr / 4);
          if (wordIdx >= 0 && wordIdx < this.dataMemory.length) {
            this.dataMemory[wordIdx] = exMem.writeData;
            cycleEvents.push({
              stage: 'MEM',
              type: 'MEM_WRITE',
              message: `Wrote ${exMem.writeData} to Mem[${byteAddr}] (word index ${wordIdx})`
            });
          }
        }

        next_MEM_WB = {
          isBubble: false,
          inst: exMem.inst,
          pc: exMem.pc,
          ctrl: exMem.ctrl,
          aluResult: exMem.aluResult,
          memData: memData,
          writeReg: exMem.writeReg,
          dynamicId: exMem.dynamicId
        };
      }

      // -------------------------------------------------------------
      // 3. EX Stage (Execution & Address Calculation)
      // -------------------------------------------------------------
      let next_EX_MEM = this.createEmptyPipelineReg();
      let forwardInfo = { forwardA: 0, forwardB: 0, explanationA: 'None', explanationB: 'None' };

      if (!this.ID_EX.isBubble && this.ID_EX.inst) {
        const idEx = this.ID_EX;

        // Compute forwarding
        forwardInfo = this.hazardUnit.computeForwarding(idEx, this.EX_MEM, this.MEM_WB);
        if (forwardInfo.forwardA !== 0 || forwardInfo.forwardB !== 0) {
          this.stats.forwardingEvents++;
          if (forwardInfo.forwardA !== 0) {
            cycleEvents.push({ stage: 'EX', type: 'FORWARD_A', message: `ForwardA: ${forwardInfo.explanationA}` });
          }
          if (forwardInfo.forwardB !== 0) {
            cycleEvents.push({ stage: 'EX', type: 'FORWARD_B', message: `ForwardB: ${forwardInfo.explanationB}` });
          }
        }

        // Determine ALU operand 1 (ALUIn1)
        let aluIn1 = idEx.readData1;
        if (forwardInfo.forwardA === 2) {
          aluIn1 = this.EX_MEM.aluResult; // EX/MEM Forward
        } else if (forwardInfo.forwardA === 1) {
          aluIn1 = this.MEM_WB.ctrl.memtoReg === 1 ? this.MEM_WB.memData : this.MEM_WB.aluResult; // MEM/WB Forward
        }

        // Determine ALU operand 2 register value before ALUSrc MUX
        let regData2 = idEx.readData2;
        if (forwardInfo.forwardB === 2) {
          regData2 = this.EX_MEM.aluResult;
        } else if (forwardInfo.forwardB === 1) {
          regData2 = this.MEM_WB.ctrl.memtoReg === 1 ? this.MEM_WB.memData : this.MEM_WB.aluResult;
        }

        // Determine ALU operand 2 (ALUSrc MUX)
        const aluIn2 = idEx.ctrl.aluSrc === 1 ? idEx.imm : regData2;

        // Execute ALU Operation
        let aluResult;
        if (idEx.ctrl && idEx.ctrl.jal) {
          aluResult = idEx.pc + 4; // Return link address for $ra
        } else {
          aluResult = this.executeALU(idEx.ctrl.aluOp, aluIn1, aluIn2, idEx.inst.shamt);
        }
        const zero = aluResult === 0;

        next_EX_MEM = {
          isBubble: false,
          inst: idEx.inst,
          pc: idEx.pc,
          ctrl: idEx.ctrl,
          aluResult: aluResult,
          writeData: regData2, // For SW instruction
          writeReg: idEx.writeReg,
          zero: zero,
          dynamicId: idEx.dynamicId
        };
      }

      // -------------------------------------------------------------
      // Hazard Detection & Control Hazard Resolution
      // -------------------------------------------------------------
      const dataStall = this.hazardUnit.detectDataStall(this.IF_ID, this.ID_EX, this.EX_MEM, this.MEM_WB);
      const structuralStall = this.hazardUnit.detectStructuralStall(this.pc < this.instructionMemory.length * 4, next_EX_MEM);

      let stallPipeline = dataStall.stall || structuralStall.stall;
      let stallReason = dataStall.reason || structuralStall.reason;

      if (dataStall.stall) this.stats.dataStallCycles++;
      if (structuralStall.stall) this.stats.structuralStallCycles++;

      // -------------------------------------------------------------
      // 4. ID Stage (Decode, Register Read, Early Branch Resolution)
      // -------------------------------------------------------------
      let next_ID_EX = this.createEmptyPipelineReg();
      let flushIF_ID = false;
      let branchTaken = false;
      let branchTargetPc = null;

      if (!stallPipeline) {
        if (!this.IF_ID.isBubble && this.IF_ID.inst) {
          const ifId = this.IF_ID;
          const inst = ifId.inst;
          const ctrl = this.generateControlSignals(inst);

          // Read Register File
          const rsVal = (inst.rs !== null && inst.rs !== undefined) ? this.registers[inst.rs] : 0;
          const rtVal = (inst.rt !== null && inst.rt !== undefined) ? this.registers[inst.rt] : 0;

          // Destination register selection (RegDst MUX)
          let writeReg = 0;
          if (ctrl.regWrite) {
            writeReg = ctrl.regDst === 1 ? inst.rd : (ctrl.regDst === 2 ? 31 : inst.rt);
          }

          // Branch / Jump evaluation in ID stage (Early Branch Resolution)
          if (ctrl.branch || ctrl.bne) {
            // Forwarding to ID stage branch comparator (priority: next_EX_MEM > this.EX_MEM > this.MEM_WB > RegFile)
            let cmpVal1 = rsVal;
            let cmpVal2 = rtVal;

            // 1. Forward from WB stage
            if (this.MEM_WB && !this.MEM_WB.isBubble && this.MEM_WB.ctrl && this.MEM_WB.ctrl.regWrite && this.MEM_WB.writeReg !== 0) {
              const wbVal = this.MEM_WB.ctrl.memtoReg === 1 ? this.MEM_WB.memData : this.MEM_WB.aluResult;
              if (this.MEM_WB.writeReg === inst.rs) cmpVal1 = wbVal;
              if (this.MEM_WB.writeReg === inst.rt) cmpVal2 = wbVal;
            }

            // 2. Forward from MEM stage (this.EX_MEM)
            if (this.EX_MEM && !this.EX_MEM.isBubble && this.EX_MEM.ctrl && this.EX_MEM.ctrl.regWrite && this.EX_MEM.writeReg !== 0) {
              const memVal = this.EX_MEM.aluResult;
              if (this.EX_MEM.writeReg === inst.rs) cmpVal1 = memVal;
              if (this.EX_MEM.writeReg === inst.rt) cmpVal2 = memVal;
            }

            // 3. Forward from EX stage just executed (next_EX_MEM)
            if (next_EX_MEM && !next_EX_MEM.isBubble && next_EX_MEM.ctrl && next_EX_MEM.ctrl.regWrite && next_EX_MEM.writeReg !== 0) {
              const exVal = next_EX_MEM.aluResult;
              if (next_EX_MEM.writeReg === inst.rs) cmpVal1 = exVal;
              if (next_EX_MEM.writeReg === inst.rt) cmpVal2 = exVal;
            }

            const isEqual = cmpVal1 === cmpVal2;
            branchTaken = ctrl.branch ? isEqual : !isEqual;
            branchTargetPc = inst.target !== null ? inst.target : (ifId.pc + 4 + (inst.imm * 4));

            this.stats.branchPredictions++;
            const prediction = this.hazardUnit.predictBranch(ifId.pc);

            if (branchTaken !== prediction.predictTaken) {
              // Misprediction penalty!
              this.stats.branchMispredictions++;
              this.stats.controlFlushCycles++;
              flushIF_ID = true;
              cycleEvents.push({
                stage: 'ID',
                type: 'BRANCH_MISPREDICT',
                message: `Control Hazard: Branch mispredicted! Branch ${branchTaken ? 'TAKEN' : 'NOT TAKEN'} to 0x${branchTargetPc.toString(16)}. Flushing speculative fetch.`
              });
              if (branchTaken) {
                this.pc = branchTargetPc;
              } else {
                this.pc = ifId.pc + 4;
              }
            } else {
              cycleEvents.push({
                stage: 'ID',
                type: 'BRANCH_PREDICT_HIT',
                message: `Branch prediction correct: ${prediction.confidence}`
              });
              if (branchTaken) {
                this.pc = branchTargetPc;
              }
            }

            this.hazardUnit.updateBranchOutcome(ifId.pc, branchTargetPc, branchTaken);
          } else if (ctrl.jump) {
            // Unconditional Jump (J or JAL)
            branchTargetPc = inst.target;
            this.pc = branchTargetPc;
            flushIF_ID = true;
            this.stats.controlFlushCycles++;
            cycleEvents.push({
              stage: 'ID',
              type: inst.mnemonic === 'JAL' ? 'JAL' : 'JUMP',
              message: `${inst.mnemonic} to 0x${branchTargetPc.toString(16)}${inst.mnemonic === 'JAL' ? ' ($ra linked to 0x' + (ifId.pc + 4).toString(16) + ')' : ''}. Flushing speculative fetch.`
            });
          } else if (ctrl.jr) {
            // Jump Register (JR rs, e.g. JR $ra subroutine return)
            let jrTarget = rsVal;
            if (this.MEM_WB && !this.MEM_WB.isBubble && this.MEM_WB.ctrl && this.MEM_WB.ctrl.regWrite && this.MEM_WB.writeReg !== 0 && this.MEM_WB.writeReg === inst.rs) {
              jrTarget = this.MEM_WB.ctrl.memtoReg === 1 ? this.MEM_WB.memData : this.MEM_WB.aluResult;
            }
            if (this.EX_MEM && !this.EX_MEM.isBubble && this.EX_MEM.ctrl && this.EX_MEM.ctrl.regWrite && this.EX_MEM.writeReg !== 0 && this.EX_MEM.writeReg === inst.rs) {
              jrTarget = this.EX_MEM.aluResult;
            }
            if (next_EX_MEM && !next_EX_MEM.isBubble && next_EX_MEM.ctrl && next_EX_MEM.ctrl.regWrite && next_EX_MEM.writeReg !== 0 && next_EX_MEM.writeReg === inst.rs) {
              jrTarget = next_EX_MEM.aluResult;
            }
            branchTargetPc = jrTarget;
            this.pc = branchTargetPc;
            flushIF_ID = true;
            this.stats.controlFlushCycles++;
            cycleEvents.push({
              stage: 'ID',
              type: 'JR',
              message: `Jump Register to 0x${branchTargetPc.toString(16)}. Flushing speculative fetch.`
            });
          }

          next_ID_EX = {
            isBubble: false,
            inst: inst,
            pc: ifId.pc,
            ctrl: ctrl,
            readData1: rsVal,
            readData2: rtVal,
            imm: inst.imm,
            rs: inst.rs,
            rt: inst.rt,
            rd: inst.rd,
            writeReg: writeReg,
            dynamicId: ifId.dynamicId
          };
        }
      } else {
        // Pipeline Stall: Insert Bubble into ID/EX, hold IF/ID and PC
        next_ID_EX = this.createEmptyPipelineReg();
        next_ID_EX.bubbleReason = stallReason;
        cycleEvents.push({
          stage: 'ID',
          type: 'STALL_BUBBLE',
          message: `Pipeline Bubble Inserted: ${stallReason}`
        });
      }

      // -------------------------------------------------------------
      // 5. IF Stage (Instruction Fetch)
      // -------------------------------------------------------------
      let next_IF_ID = this.IF_ID;

      if (!stallPipeline) {
        if (flushIF_ID) {
          next_IF_ID = this.createEmptyPipelineReg();
          next_IF_ID.bubbleReason = 'Branch / Jump Control Flush';
        } else {
          const instIndex = Math.floor(this.pc / 4);
          if (instIndex >= 0 && instIndex < this.instructionMemory.length) {
            const fetchedInst = this.instructionMemory[instIndex];
            const dynamicId = ++this.dynamicInstSeq;
            next_IF_ID = {
              isBubble: false,
              inst: fetchedInst,
              pc: this.pc,
              dynamicId: dynamicId
            };
            this.dynamicTrace.push({
              dynamicId: dynamicId,
              inst: fetchedInst,
              pc: this.pc,
              rawAsm: fetchedInst.rawAsm,
              stagesByCycle: { [currentCycle]: 'IF' }
            });
            cycleEvents.push({
              stage: 'IF',
              type: 'FETCH',
              message: `Fetched [0x${this.pc.toString(16)}] ${fetchedInst.rawAsm}`
            });
            this.pc += 4;
          } else {
            // Past end of instruction memory
            next_IF_ID = this.createEmptyPipelineReg();
          }
        }
      } else {
        cycleEvents.push({
          stage: 'IF',
          type: 'STALL_HELD',
          message: `IF Stage Stalled (PC maintained at 0x${this.pc.toString(16)})`
        });
      }

      // -------------------------------------------------------------
      // Record Space-Time Grid & Pipeline Stage State
      // -------------------------------------------------------------
      const activeStageSnapshots = {
        IF: { ...next_IF_ID },
        ID: { ...next_ID_EX },
        EX: { ...next_EX_MEM },
        MEM: { ...next_MEM_WB },
        WB: wbRetiredInst ? { isBubble: false, inst: wbRetiredInst } : { isBubble: true }
      };

      // Helper to record stage transitions in both static grid and dynamic execution trace
      const recordStage = (stageName, inst, dynamicId) => {
        if (!inst) return;
        // 1. Static grid
        const matchRow = this.instructionGrid.find(row => row.rawAsm === inst.rawAsm && row.pc === inst.pc);
        if (matchRow) {
          matchRow.stagesByCycle[currentCycle] = stageName;
        }
        // 2. Dynamic execution trace
        if (dynamicId) {
          const matchTrace = this.dynamicTrace.find(t => t.dynamicId === dynamicId);
          if (matchTrace) {
            matchTrace.stagesByCycle[currentCycle] = stageName;
          }
        }
      };

      // Record STALL if hazard unit held the pipeline
      if (stallPipeline && this.IF_ID && !this.IF_ID.isBubble && this.IF_ID.inst) {
        recordStage('STALL', this.IF_ID.inst, this.IF_ID.dynamicId);
      }

      // Record FLUSH if branch/jump flushed speculative fetch
      if (flushIF_ID && this.IF_ID && !this.IF_ID.isBubble && this.IF_ID.inst) {
        recordStage('FLUSH', this.IF_ID.inst, this.IF_ID.dynamicId);
      }

      // Record normal stages
      if (!stallPipeline && !flushIF_ID && next_IF_ID && !next_IF_ID.isBubble) {
        recordStage('IF', next_IF_ID.inst, next_IF_ID.dynamicId);
      }
      if (next_ID_EX && !next_ID_EX.isBubble) {
        recordStage('ID', next_ID_EX.inst, next_ID_EX.dynamicId);
      }
      if (next_EX_MEM && !next_EX_MEM.isBubble) {
        recordStage('EX', next_EX_MEM.inst, next_EX_MEM.dynamicId);
      }
      if (next_MEM_WB && !next_MEM_WB.isBubble) {
        recordStage('MEM', next_MEM_WB.inst, next_MEM_WB.dynamicId);
      }
      if (wbRetiredInst) {
        recordStage('WB', wbRetiredInst, wbRetiredInst.dynamicId);
      }

      // Latch all next pipeline registers
      this.IF_ID = next_IF_ID;
      this.ID_EX = next_ID_EX;
      this.EX_MEM = next_EX_MEM;
      this.MEM_WB = next_MEM_WB;

      // Check termination condition:
      // PC is past program end AND all 4 pipeline registers are bubbles
      const allBubbles = this.IF_ID.isBubble && this.ID_EX.isBubble && this.EX_MEM.isBubble && this.MEM_WB.isBubble;
      const pcPastEnd = Math.floor(this.pc / 4) >= this.instructionMemory.length;

      if (pcPastEnd && allBubbles) {
        this.isHalted = true;
        cycleEvents.push({ stage: 'CPU', type: 'HALTED', message: 'Program execution completed. Pipeline flushed.' });
      }

      // Record snapshot in history
      const historyRecord = {
        cycle: currentCycle,
        pc: this.pc,
        stages: activeStageSnapshots,
        events: cycleEvents,
        registers: new Int32Array(this.registers),
        forwardInfo: forwardInfo,
        stall: stallPipeline,
        stallReason: stallReason,
        isHalted: this.isHalted
      };

      this.cycleHistory.push(historyRecord);
      return !this.isHalted;
    }

    /**
     * ALU Arithmetic and Logic Execution Unit
     */
    executeALU(aluOp, in1, in2, shamt = 0) {
      switch (aluOp) {
        case 'ADD':
        case 'ADDI':
          return (in1 + in2) | 0;
        case 'SUB':
          return (in1 - in2) | 0;
        case 'AND':
        case 'ANDI':
          return (in1 & in2) | 0;
        case 'OR':
        case 'ORI':
          return (in1 | in2) | 0;
        case 'XOR':
        case 'XORI':
          return (in1 ^ in2) | 0;
        case 'NOR':
          return (~(in1 | in2)) | 0;
        case 'SLT':
        case 'SLTI':
          return (in1 < in2) ? 1 : 0;
        case 'SLL':
          return (in2 << (shamt & 0x1F)) | 0;
        case 'SRL':
          return (in2 >>> (shamt & 0x1F)) | 0;
        case 'NOP':
        default:
          return 0;
      }
    }

    /**
     * Run simulation until halted or max cycles reached
     */
    runToEnd(maxCycles = 2000) {
      let count = 0;
      while (!this.isHalted && count < maxCycles) {
        this.stepCycle();
        count++;
      }
      return this.isHalted;
    }

    /**
     * Get real-time quantitative metrics
     */
    getPerformanceMetrics() {
      const C = this.cycleCount || 1;
      const IC = this.instructionsRetired || 1;
      const cpi = (C / IC);
      const idealCpi = 1.0;
      const unpipelinedCycles = IC * 5;
      const speedup = (unpipelinedCycles / C);
      const efficiency = (speedup / 5.0) * 100;
      const throughput = (IC / C);

      return {
        totalCycles: this.cycleCount,
        instructionsRetired: this.instructionsRetired,
        cpi: parseFloat(cpi.toFixed(3)),
        idealCpi: idealCpi,
        unpipelinedCycles: unpipelinedCycles,
        speedup: parseFloat(speedup.toFixed(3)),
        efficiency: parseFloat(efficiency.toFixed(2)),
        throughput: parseFloat(throughput.toFixed(3)),
        dataStallCycles: this.stats.dataStallCycles,
        structuralStallCycles: this.stats.structuralStallCycles,
        controlFlushCycles: this.stats.controlFlushCycles,
        forwardingEvents: this.stats.forwardingEvents,
        branchPredictions: this.stats.branchPredictions,
        branchMispredictions: this.stats.branchMispredictions,
        branchAccuracy: this.stats.branchPredictions > 0
          ? parseFloat((((this.stats.branchPredictions - this.stats.branchMispredictions) / this.stats.branchPredictions) * 100).toFixed(1))
          : 100.0
      };
    }
  }

  exports.PipelinedCPU = PipelinedCPU;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.DatapathModule = {}));
