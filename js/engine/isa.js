/**
 * Computer Organization & Architecture (COA)
 * MIPS / RISC-V 32-bit Instruction Set Architecture Definition
 * 
 * Supports R-Type, I-Type, and J-Type formats with complete register aliases,
 * opcode / funct definitions, and encoding/decoding utilities.
 */

(function(exports) {
  'use strict';

  // 32 General-Purpose Register Map
  const REGISTER_NAMES = [
    '$zero', '$at', '$v0', '$v1',
    '$a0', '$a1', '$a2', '$a3',
    '$t0', '$t1', '$t2', '$t3', '$t4', '$t5', '$t6', '$t7',
    '$s0', '$s1', '$s2', '$s3', '$s4', '$s5', '$s6', '$s7',
    '$t8', '$t9', '$k0', '$k1',
    '$gp', '$sp', '$fp', '$ra'
  ];

  const REGISTER_ALIASES = {};
  REGISTER_NAMES.forEach((name, idx) => {
    REGISTER_ALIASES[name] = idx;
    REGISTER_ALIASES[name.replace('$', '')] = idx;
    REGISTER_ALIASES[`$r${idx}`] = idx;
    REGISTER_ALIASES[`r${idx}`] = idx;
    REGISTER_ALIASES[`${idx}`] = idx;
  });

  // Opcodes & Funct codes
  const OPCODES = {
    // R-Type uses Opcode 0x00
    R_TYPE: 0x00,
    // I-Type Opcodes
    ADDI: 0x08,
    ANDI: 0x0C,
    ORI:  0x0D,
    XORI: 0x0E,
    SLTI: 0x0A,
    LW:   0x23,
    SW:   0x2B,
    BEQ:  0x04,
    BNE:  0x05,
    // J-Type Opcodes
    J:    0x02,
    JAL:  0x03
  };

  const FUNCT_CODES = {
    ADD: 0x20,
    SUB: 0x22,
    AND: 0x24,
    OR:  0x25,
    XOR: 0x26,
    NOR: 0x27,
    SLT: 0x2A,
    SLL: 0x00,
    SRL: 0x02,
    JR:  0x08
  };

  function resolveRegister(regToken) {
    if (typeof regToken === 'number') {
      if (regToken >= 0 && regToken < 32) return regToken;
      throw new Error(`Register index out of bounds (0-31): ${regToken}`);
    }
    const clean = String(regToken).trim().toLowerCase();
    if (REGISTER_ALIASES.hasOwnProperty(clean)) {
      return REGISTER_ALIASES[clean];
    }
    throw new Error(`Unknown register alias: '${regToken}'`);
  }

  function getRegisterName(regIndex) {
    if (regIndex >= 0 && regIndex < 32) {
      return REGISTER_NAMES[regIndex];
    }
    return `$r${regIndex}`;
  }

  // Instruction format helper
  function createInstruction(type, mnemonic, fields = {}) {
    return {
      type,                // 'R', 'I', 'J', 'NOP'
      mnemonic: mnemonic.toUpperCase(),
      rs: fields.rs !== undefined ? fields.rs : null,
      rt: fields.rt !== undefined ? fields.rt : null,
      rd: fields.rd !== undefined ? fields.rd : null,
      shamt: fields.shamt !== undefined ? fields.shamt : 0,
      imm: fields.imm !== undefined ? fields.imm : 0,
      target: fields.target !== undefined ? fields.target : null,
      rawAsm: fields.rawAsm || mnemonic,
      lineNum: fields.lineNum || 0,
      pc: fields.pc !== undefined ? fields.pc : 0,
      id: fields.id || ('inst_' + Math.random().toString(36).substr(2, 9))
    };
  }

  function createNOP(pc = 0, lineNum = 0) {
    return createInstruction('NOP', 'NOP', {
      rs: 0, rt: 0, rd: 0, shamt: 0, imm: 0,
      rawAsm: 'NOP',
      pc,
      lineNum
    });
  }

  exports.REGISTER_NAMES = REGISTER_NAMES;
  exports.REGISTER_ALIASES = REGISTER_ALIASES;
  exports.OPCODES = OPCODES;
  exports.FUNCT_CODES = FUNCT_CODES;
  exports.resolveRegister = resolveRegister;
  exports.getRegisterName = getRegisterName;
  exports.createInstruction = createInstruction;
  exports.createNOP = createNOP;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.ISA = {}));
