/**
 * Comprehensive Automated Verification Test Suite for COA Pipelined CPU
 * 
 * Verifies:
 * 1. ISA Decoding & Assembler Label Resolution
 * 2. 5-Stage Datapath & Register File Correctness
 * 3. RAW Data Forwarding (EX->EX, MEM->EX)
 * 4. Load-Use Hazard 1-cycle Bubble Insertion
 * 5. Stall-Only Mode (Forwarding Disabled)
 * 6. Branch Prediction & Control Flushes
 * 7. Structural Hazard in Von Neumann Mode
 * 8. End-to-end Benchmark Execution & Memory Integrity
 * 9. Performance Metrics & Amdahl's Law
 */

const fs = require('fs');
const path = require('path');

const ISA = require('../js/engine/isa');
const { Assembler } = require('../js/engine/assembler');
const { HazardUnit } = require('../js/engine/hazard_unit');
const { PipelinedCPU } = require('../js/engine/datapath');
const { PerformanceModel } = require('../js/engine/performance');

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests.push({ name: testName, details });
    console.error(`  ✗ [FAIL] ${testName} - ${details}`);
  }
}

function assertEquals(actual, expected, testName) {
  assert(actual === expected, testName, `Expected: ${expected}, Actual: ${actual}`);
}

console.log('===============================================================');
console.log('COA Pipelined CPU Simulator - Automated Verification Suite');
console.log('===============================================================\n');

// -------------------------------------------------------------
// Suite 1: ISA & Assembler
// -------------------------------------------------------------
console.log('--- Suite 1: ISA & Assembler Verification ---');
const assembler = new Assembler();

// Test 1: Register Aliasing
assertEquals(ISA.resolveRegister('$zero'), 0, 'Register $zero resolves to 0');
assertEquals(ISA.resolveRegister('$t0'), 8, 'Register $t0 resolves to 8');
assertEquals(ISA.resolveRegister('$s0'), 16, 'Register $s0 resolves to 16');
assertEquals(ISA.resolveRegister('$ra'), 31, 'Register $ra resolves to 31');
assertEquals(ISA.resolveRegister('r5'), 5, 'Register r5 resolves to 5');

// Test 2: Basic R & I Parsing
const res1 = assembler.assemble(`
  ADDI $t0, $zero, 42
  ADD  $t1, $t0, $t0
  SW   $t1, 12($sp)
  LW   $t2, 12($sp)
`);
assertEquals(res1.errors.length, 0, 'Assembler parsed basic R/I instructions without errors');
assertEquals(res1.instructions.length, 4, 'Correct instruction count (4)');
assertEquals(res1.instructions[0].mnemonic, 'ADDI', 'Instruction 0 is ADDI');
assertEquals(res1.instructions[0].imm, 42, 'Instruction 0 immediate is 42');
assertEquals(res1.instructions[2].mnemonic, 'SW', 'Instruction 2 is SW');
assertEquals(res1.instructions[2].imm, 12, 'SW memory offset is 12');

// Test 3: Labels and Forward Branches
const resLabels = assembler.assemble(`
  start:
    ADDI $t0, $zero, 1
    BEQ  $t0, $zero, end
    ADDI $t0, $t0, 1
  end:
    NOP
`);
assertEquals(resLabels.errors.length, 0, 'Label parsing succeeded');
assertEquals(resLabels.labels['start'], 0, 'start label mapped to PC 0');
assertEquals(resLabels.labels['end'], 12, 'end label mapped to PC 12');
assertEquals(resLabels.instructions[1].target, 12, 'BEQ correctly resolved target PC to 12');

// -------------------------------------------------------------
// Suite 2: Forwarding & RAW Data Hazards
// -------------------------------------------------------------
console.log('\n--- Suite 2: Forwarding & RAW Hazard Resolution ---');
{
  const cpu = new PipelinedCPU({ forwardingEnabled: true });
  const asm = `
    ADDI $t0, $zero, 15
    ADDI $t1, $zero, 25
    ADD  $t2, $t0, $t1   # RAW on $t0 and $t1 (Forwarded from EX/MEM & MEM/WB)
    SUB  $t3, $t2, $t0   # RAW on $t2 (Forwarded from EX/MEM)
  `;
  const p = assembler.assemble(asm);
  cpu.loadProgram(p.instructions);
  cpu.runToEnd(100);

  assertEquals(cpu.registers[8], 15, '$t0 equals 15');
  assertEquals(cpu.registers[9], 25, '$t1 equals 25');
  assertEquals(cpu.registers[10], 40, '$t2 equals 40 ($t0 + $t1)');
  assertEquals(cpu.registers[11], 25, '$t3 equals 25 ($t2 - $t0)');
  assert(cpu.stats.forwardingEvents >= 2, 'Forwarding unit triggered at least 2 forwarding bypasses');
  assertEquals(cpu.stats.dataStallCycles, 0, 'Zero data stalls incurred due to forwarding unit bypass');
}

// -------------------------------------------------------------
// Suite 3: Load-Use Hazard & 1-Cycle Stall Bubble
// -------------------------------------------------------------
console.log('\n--- Suite 3: Load-Use Hazard & Bubble Insertion ---');
{
  const cpu = new PipelinedCPU({ forwardingEnabled: true });
  const asm = `
    ADDI $s0, $zero, 99
    SW   $s0, 0($zero)
    LW   $s1, 0($zero)
    ADD  $s2, $s1, $s0   # Load-Use RAW Hazard! Must insert 1 stall bubble
  `;
  const p = assembler.assemble(asm);
  cpu.loadProgram(p.instructions);
  cpu.runToEnd(100);

  assertEquals(cpu.registers[17], 99, '$s1 loaded 99 correctly');
  assertEquals(cpu.registers[18], 198, '$s2 computed 99 + 99 = 198 correctly');
  assertEquals(cpu.stats.dataStallCycles, 1, 'Exactly 1 data stall bubble inserted for Load-Use');
}

// -------------------------------------------------------------
// Suite 4: Forwarding Disabled (Stall-Only Architecture)
// -------------------------------------------------------------
console.log('\n--- Suite 4: Forwarding Disabled (Stall-Only Architecture) ---');
{
  const cpuNoFwd = new PipelinedCPU({ forwardingEnabled: false });
  const asm = `
    ADDI $t0, $zero, 10
    ADD  $t1, $t0, $zero  # Depends on $t0 without forwarding -> must stall multiple cycles
  `;
  const p = assembler.assemble(asm);
  cpuNoFwd.loadProgram(p.instructions);
  cpuNoFwd.runToEnd(100);

  assertEquals(cpuNoFwd.registers[8], 10, '$t0 is 10');
  assertEquals(cpuNoFwd.registers[9], 10, '$t1 is 10');
  assert(cpuNoFwd.stats.dataStallCycles >= 2, 'Stalled at least 2 cycles waiting for register write-back without forwarding');
}

// -------------------------------------------------------------
// Suite 5: Control Hazards & Branch Loops
// -------------------------------------------------------------
console.log('\n--- Suite 5: Control Hazards & Branch Prediction ---');
{
  const cpu = new PipelinedCPU({ forwardingEnabled: true, branchPredictionMode: 'predict-not-taken' });
  const asm = `
    ADDI $s0, $zero, 3
    ADDI $t0, $zero, 0
    ADDI $t1, $zero, 0
  loop:
    ADDI $t0, $t0, 1
    ADD  $t1, $t1, $t0
    BNE  $t0, $s0, loop
    SW   $t1, 4($zero)
  `;
  const p = assembler.assemble(asm);
  cpu.loadProgram(p.instructions);
  cpu.runToEnd(200);

  assertEquals(cpu.registers[8], 3, 'Loop executed 3 iterations ($t0 = 3)');
  assertEquals(cpu.registers[9], 6, 'Sum computed correctly ($t1 = 1 + 2 + 3 = 6)');
  assertEquals(cpu.dataMemory[1], 6, 'Memory[4] contains 6');
  assert(cpu.stats.controlFlushCycles > 0, 'Control flush penalty cycles recorded on taken branch');
}

// -------------------------------------------------------------
// Suite 6: Structural Memory Hazards (Von Neumann Mode)
// -------------------------------------------------------------
console.log('\n--- Suite 6: Structural Hazards in Von Neumann Mode ---');
{
  const cpuVN = new PipelinedCPU({ memoryArchitecture: 'von-neumann' });
  const asm = `
    ADDI $s1, $zero, 77
    SW   $s1, 0($zero)
    LW   $s2, 0($zero)
    ADD  $s3, $s1, $s2
  `;
  const p = assembler.assemble(asm);
  cpuVN.loadProgram(p.instructions);
  cpuVN.runToEnd(100);

  assertEquals(cpuVN.registers[19], 154, 'Values computed correctly (77 + 77 = 154)');
  assert(cpuVN.stats.structuralStallCycles > 0, 'Structural memory stalls detected under Von Neumann unified memory');
}

// -------------------------------------------------------------
// Suite 7: Full Benchmark 5 (Fibonacci) End-to-End
// -------------------------------------------------------------
console.log('\n--- Suite 7: Benchmark 5 (Fibonacci Array) ---');
{
  const cpu = new PipelinedCPU({ forwardingEnabled: true });
  const asm = fs.readFileSync(path.join(__dirname, '../examples/benchmark5_fibonacci.asm'), 'utf-8');
  const p = assembler.assemble(asm);
  cpu.loadProgram(p.instructions);
  cpu.runToEnd(500);

  // F[0]=0, F[1]=1, F[2]=1, F[3]=2, F[4]=3, F[5]=5, F[6]=8
  assertEquals(cpu.dataMemory[0], 0, 'Fib[0] = 0 in Mem[0]');
  assertEquals(cpu.dataMemory[1], 1, 'Fib[1] = 1 in Mem[4]');
  assertEquals(cpu.dataMemory[2], 1, 'Fib[2] = 1 in Mem[8]');
  assertEquals(cpu.dataMemory[3], 2, 'Fib[3] = 2 in Mem[12]');
  assertEquals(cpu.dataMemory[4], 3, 'Fib[4] = 3 in Mem[16]');
  assertEquals(cpu.dataMemory[5], 5, 'Fib[5] = 5 in Mem[20]');
  assertEquals(cpu.dataMemory[6], 8, 'Fib[6] = 8 in Mem[24]');

  const metrics = cpu.getPerformanceMetrics();
  assert(metrics.speedup > 1.0, `Achieved pipeline speedup > 1.0 (Speedup = ${metrics.speedup}x)`);
  assert(metrics.cpi > 0 && metrics.cpi < 5.0, `CPI is realistic for pipelined processor (CPI = ${metrics.cpi})`);
}

// -------------------------------------------------------------
// Suite 8: Amdahl\'s Law & Quantitative Formulas
// -------------------------------------------------------------
console.log('\n--- Suite 8: Quantitative Performance & Amdahl\'s Law ---');
{
  // 80% enhanced with 4x speedup
  // S = 1 / ((1 - 0.8) + (0.8 / 4)) = 1 / (0.2 + 0.2) = 1 / 0.4 = 2.5
  const amdahlRes = PerformanceModel.calculateAmdahl(0.8, 4.0);
  assertEquals(amdahlRes.overallSpeedup, 2.5, "Amdahl's Law (f=0.8, s=4) yields exactly 2.5x");
  assertEquals(amdahlRes.maxTheoreticalSpeedup, 5.0, "Theoretical maximum speedup as s->inf is 1/(1-0.8) = 5.0x");

  // Theoretical pipeline formula: n=100, k=5, stalls=10
  // S = (100 * 5) / (5 + 100 - 1 + 10) = 500 / 114 = 4.386
  const pipeRes = PerformanceModel.calculateTheoreticalPipeline(100, 5, 10);
  assertEquals(pipeRes.actualSpeedup, 4.386, 'Pipeline speedup matches standard COA textbook formula');
}

// -------------------------------------------------------------
// Suite 9: Subroutine Linkage (JAL & JR) & Dynamic Space-Time Trace
// -------------------------------------------------------------
console.log('\n--- Suite 9: Subroutine Linkage (JAL/JR) & Space-Time Stage Verification ---');
{
  const cpu = new PipelinedCPU({ forwardingEnabled: true });
  const asm = `
    ADDI $a0, $zero, 7
    JAL  double_sub
    ADDI $s0, $v0, 10
    J    sub_done
  double_sub:
    ADD  $v0, $a0, $a0
    JR   $ra
  sub_done:
    NOP
  `;
  const p = assembler.assemble(asm);
  cpu.loadProgram(p.instructions);
  cpu.runToEnd(100);

  assertEquals(cpu.registers[31], 8, 'JAL saved correct return link address (PC 8) to $ra');
  assertEquals(cpu.registers[2], 14, 'Subroutine computed $v0 = 7 + 7 = 14');
  assertEquals(cpu.registers[16], 24, 'Caller resumed after JR and computed $s0 = 14 + 10 = 24');

  // Verify Space-Time STALL stage recording for Load-Use
  const cpuLU = new PipelinedCPU({ forwardingEnabled: true });
  const pLU = assembler.assemble(`
    LW  $t0, 0($zero)
    ADD $t1, $t0, $zero
  `);
  cpuLU.loadProgram(pLU.instructions);
  cpuLU.runToEnd(20);
  const luStages = Object.values(cpuLU.instructionGrid[1].stagesByCycle);
  assert(luStages.includes('STALL'), "Space-Time diagram explicitly records 'STALL' stage for Load-Use bubble");

  // Verify dynamic execution trace unfolds loop iterations
  const cpuLoop = new PipelinedCPU({ forwardingEnabled: true });
  const pLoop = assembler.assemble(fs.readFileSync(path.join(__dirname, '../examples/benchmark3_branch_loop.asm'), 'utf-8'));
  cpuLoop.loadProgram(pLoop.instructions);
  cpuLoop.runToEnd(100);
  assert(cpuLoop.dynamicTrace.length >= 20, `Dynamic execution trace unfolds loop instances (recorded ${cpuLoop.dynamicTrace.length} instances)`);
}

console.log('\n===============================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests.length}`);
console.log('===============================================================');

if (failedTests.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
