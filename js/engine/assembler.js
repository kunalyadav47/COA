/**
 * Computer Organization & Architecture (COA)
 * MIPS / RISC-V Assembly Language Parser & Assembler
 */

(function(exports) {
  'use strict';

  const ISA = typeof require !== 'undefined' ? require('./isa') : window.ISA;

  class Assembler {
    constructor() {
      this.labels = {};
      this.instructions = [];
      this.errors = [];
    }

    /**
     * Assemble raw assembly code string into executable instruction memory.
     * @param {string} sourceCode
     * @returns {{ instructions: Array, labels: Object, errors: Array }}
     */
    assemble(sourceCode) {
      this.labels = {};
      this.instructions = [];
      this.errors = [];

      const rawLines = sourceCode.split('\n');
      const parsedItems = [];
      let currentPc = 0;

      // PASS 1: Clean lines, discover labels, map instruction memory addresses
      for (let i = 0; i < rawLines.length; i++) {
        let line = rawLines[i];
        const lineNum = i + 1;

        // Strip comments (# and //)
        const commentIdx = line.search(/(#|\/\/)/);
        if (commentIdx !== -1) {
          line = line.substring(0, commentIdx);
        }
        line = line.trim();
        if (!line) continue;

        // Check for directives like .text, .data, .globl (ignored for simple CPU)
        if (line.startsWith('.')) {
          continue;
        }

        // Check for labels (e.g., "loop:" or "start: addi $t0, $zero, 5")
        while (line.includes(':')) {
          const colonIdx = line.indexOf(':');
          const labelName = line.substring(0, colonIdx).trim();
          if (!labelName) {
            this.errors.push({ line: lineNum, message: 'Empty label name before colon' });
            break;
          }
          if (this.labels.hasOwnProperty(labelName)) {
            this.errors.push({ line: lineNum, message: `Duplicate label definition: '${labelName}'` });
          } else {
            this.labels[labelName] = currentPc;
          }
          line = line.substring(colonIdx + 1).trim();
        }

        if (!line) continue;

        parsedItems.push({
          lineNum,
          pc: currentPc,
          rawAsm: line
        });
        currentPc += 4;
      }

      if (this.errors.length > 0) {
        return { instructions: [], labels: this.labels, errors: this.errors };
      }

      // PASS 2: Assemble instructions and resolve labels / operands
      for (const item of parsedItems) {
        try {
          const inst = this.parseInstruction(item.rawAsm, item.pc, item.lineNum);
          this.instructions.push(inst);
        } catch (err) {
          this.errors.push({
            line: item.lineNum,
            message: err.message,
            rawAsm: item.rawAsm
          });
        }
      }

      return {
        instructions: this.instructions,
        labels: this.labels,
        errors: this.errors
      };
    }

    parseInstruction(line, pc, lineNum) {
      // Split mnemonic from operands
      const spaceMatch = line.match(/^([a-zA-Z]+)\s*(.*)$/);
      if (!spaceMatch) {
        throw new Error(`Invalid syntax or unknown instruction: '${line}'`);
      }

      const mnemonic = spaceMatch[1].toUpperCase();
      const operandStr = spaceMatch[2].trim();

      // Handle NOP
      if (mnemonic === 'NOP') {
        return ISA.createNOP(pc, lineNum);
      }

      // Parse operands
      const tokens = operandStr ? this.tokenizeOperands(operandStr) : [];

      switch (mnemonic) {
        // R-Type 3-register: mnemonic rd, rs, rt
        case 'ADD':
        case 'SUB':
        case 'AND':
        case 'OR':
        case 'XOR':
        case 'NOR':
        case 'SLT': {
          if (tokens.length !== 3) {
            throw new Error(`${mnemonic} requires 3 register operands: rd, rs, rt (got ${tokens.length})`);
          }
          const rd = ISA.resolveRegister(tokens[0]);
          const rs = ISA.resolveRegister(tokens[1]);
          const rt = ISA.resolveRegister(tokens[2]);
          return ISA.createInstruction('R', mnemonic, { rd, rs, rt, pc, lineNum, rawAsm: line });
        }

        // Shift instructions: mnemonic rd, rt, shamt
        case 'SLL':
        case 'SRL': {
          if (tokens.length !== 3) {
            throw new Error(`${mnemonic} requires 3 operands: rd, rt, shamt`);
          }
          const rd = ISA.resolveRegister(tokens[0]);
          const rt = ISA.resolveRegister(tokens[1]);
          const shamt = this.parseImmediate(tokens[2]);
          return ISA.createInstruction('R', mnemonic, { rd, rs: 0, rt, shamt, pc, lineNum, rawAsm: line });
        }

        // Jump Register: JR rs
        case 'JR': {
          if (tokens.length !== 1) {
            throw new Error(`JR requires 1 register operand: rs (e.g. JR $ra)`);
          }
          const rs = ISA.resolveRegister(tokens[0]);
          return ISA.createInstruction('R', mnemonic, { rd: 0, rs, rt: 0, shamt: 0, pc, lineNum, rawAsm: line });
        }

        // I-Type arithmetic: mnemonic rt, rs, imm
        case 'ADDI':
        case 'ANDI':
        case 'ORI':
        case 'XORI':
        case 'SLTI': {
          if (tokens.length !== 3) {
            throw new Error(`${mnemonic} requires 3 operands: rt, rs, immediate`);
          }
          const rt = ISA.resolveRegister(tokens[0]);
          const rs = ISA.resolveRegister(tokens[1]);
          const imm = this.parseImmediate(tokens[2]);
          return ISA.createInstruction('I', mnemonic, { rt, rs, imm, pc, lineNum, rawAsm: line });
        }

        // Memory load/store: LW rt, offset(rs) OR SW rt, offset(rs)
        case 'LW':
        case 'SW': {
          if (tokens.length === 2) {
            // format: rt, offset(rs)
            const rt = ISA.resolveRegister(tokens[0]);
            const memRef = this.parseMemoryReference(tokens[1]);
            return ISA.createInstruction('I', mnemonic, {
              rt,
              rs: memRef.baseReg,
              imm: memRef.offset,
              pc,
              lineNum,
              rawAsm: line
            });
          } else if (tokens.length === 3) {
            // alternate format: rt, rs, offset
            const rt = ISA.resolveRegister(tokens[0]);
            const rs = ISA.resolveRegister(tokens[1]);
            const imm = this.parseImmediate(tokens[2]);
            return ISA.createInstruction('I', mnemonic, { rt, rs, imm, pc, lineNum, rawAsm: line });
          } else {
            throw new Error(`${mnemonic} requires format: ${mnemonic} rt, offset(rs)`);
          }
        }

        // Conditional Branch: BEQ rs, rt, label / offset
        case 'BEQ':
        case 'BNE': {
          if (tokens.length !== 3) {
            throw new Error(`${mnemonic} requires 3 operands: rs, rt, label`);
          }
          const rs = ISA.resolveRegister(tokens[0]);
          const rt = ISA.resolveRegister(tokens[1]);
          const labelOrImm = tokens[2];
          let targetPc = null;
          let imm = 0;

          if (this.labels.hasOwnProperty(labelOrImm)) {
            targetPc = this.labels[labelOrImm];
            // Branch offset in words relative to next instruction (pc + 4)
            imm = (targetPc - (pc + 4)) / 4;
          } else {
            // direct numeric offset
            imm = this.parseImmediate(labelOrImm);
            targetPc = pc + 4 + (imm * 4);
          }

          return ISA.createInstruction('I', mnemonic, {
            rs,
            rt,
            imm,
            target: targetPc,
            pc,
            lineNum,
            rawAsm: line
          });
        }

        // Unconditional Jump: J target_label / address
        case 'J':
        case 'JAL': {
          if (tokens.length !== 1) {
            throw new Error(`${mnemonic} requires 1 operand: target_label or address`);
          }
          const targetToken = tokens[0];
          let targetPc = null;
          if (this.labels.hasOwnProperty(targetToken)) {
            targetPc = this.labels[targetToken];
          } else {
            targetPc = this.parseImmediate(targetToken);
          }

          return ISA.createInstruction('J', mnemonic, {
            target: targetPc,
            pc,
            lineNum,
            rawAsm: line
          });
        }

        default:
          throw new Error(`Unsupported or unknown mnemonic: '${mnemonic}'`);
      }
    }

    tokenizeOperands(operandStr) {
      // Split on commas while preserving parenthesized memory references
      const parts = operandStr.split(',').map(s => s.trim()).filter(Boolean);
      return parts;
    }

    parseMemoryReference(token) {
      // Parses "offset(base)" e.g. "4($s0)", "-8($sp)", "($t1)"
      const match = token.match(/^([+-]?\d+|0x[0-9a-fA-F]+)?\s*\(\s*([^)]+)\s*\)$/);
      if (!match) {
        throw new Error(`Invalid memory addressing format '${token}'. Expected 'offset(baseRegister)' like '4($s0)'`);
      }
      const offsetStr = match[1] || '0';
      const offset = this.parseImmediate(offsetStr);
      const baseReg = ISA.resolveRegister(match[2].trim());
      return { offset, baseReg };
    }

    parseImmediate(token) {
      token = token.trim();
      let val;
      if (token.startsWith('0x') || token.startsWith('0X') || token.startsWith('-0x')) {
        val = parseInt(token, 16);
      } else {
        val = parseInt(token, 10);
      }
      if (isNaN(val)) {
        throw new Error(`Invalid immediate or number format: '${token}'`);
      }
      return val;
    }
  }

  exports.Assembler = Assembler;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.AssemblerModule = {}));
