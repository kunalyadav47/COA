# Automated Verification & Testing Record

**Project:** COA 5-Stage Pipelined Processor Studio  
**Author:** Kunal Yadav (2411021060008) • Squad 70  
**Test Suite Status:** 50 / 50 Tests PASSED (100% Pass Rate)

---

## 🧪 Test Execution Command

Run the automated test runner using Node.js:
```bash
node tests/test_runner.js
```

---

## 📊 Test Suite Coverage Summary

| Test Suite | Focus Area | Assertions | Result |
| :--- | :--- | :---: | :---: |
| **Suite 1: ISA & Assembler** | Register aliasing, R/I type instructions, label mapping | 15 | **PASS (15/15)** |
| **Suite 2: RAW Forwarding** | EX/MEM and MEM/WB hardware forwarding without stalls | 6 | **PASS (6/6)** |
| **Suite 3: Load-Use Hazard** | Unavoidable 1-cycle bubble stall insertion with forwarding | 3 | **PASS (3/3)** |
| **Suite 4: Stall-Only Mode** | Multi-cycle bubble stalling when forwarding is disabled | 3 | **PASS (3/3)** |
| **Suite 5: Control Hazards** | Branch evaluation, taken branch penalties, loop execution | 4 | **PASS (4/4)** |
| **Suite 6: Structural Hazards**| Unified memory arbitration in Von Neumann mode | 2 | **PASS (2/2)** |
| **Suite 7: Benchmark 5** | End-to-end Fibonacci sequence generation in memory | 9 | **PASS (9/9)** |
| **Suite 8: Quantitative Models** | Amdahl's Law and theoretical pipeline speedup formulas | 3 | **PASS (3/3)** |
| **Suite 9: Subroutines & Stages** | JAL link address, JR return, Space-Time STALL/FLUSH | 5 | **PASS (5/5)** |
| **TOTAL** | **Full System Architectural Verification** | **50** | **PASS (50/50)** |

---

## 📝 Console Execution Log

```
===============================================================
COA Pipelined CPU Simulator - Automated Verification Suite
===============================================================

--- Suite 1: ISA & Assembler Verification ---
  ✓ [PASS] Register $zero resolves to 0
  ✓ [PASS] Register $t0 resolves to 8
  ✓ [PASS] Register $s0 resolves to 16
  ✓ [PASS] Register $ra resolves to 31
  ✓ [PASS] Register r5 resolves to 5
  ✓ [PASS] Assembler parsed basic R/I instructions without errors
  ✓ [PASS] Correct instruction count (4)
  ✓ [PASS] Instruction 0 is ADDI
  ✓ [PASS] Instruction 0 immediate is 42
  ✓ [PASS] Instruction 2 is SW
  ✓ [PASS] SW memory offset is 12
  ✓ [PASS] Label parsing succeeded
  ✓ [PASS] start label mapped to PC 0
  ✓ [PASS] end label mapped to PC 12
  ✓ [PASS] BEQ correctly resolved target PC to 12

--- Suite 2: Forwarding & RAW Hazard Resolution ---
  ✓ [PASS] $t0 equals 15
  ✓ [PASS] $t1 equals 25
  ✓ [PASS] $t2 equals 40 ($t0 + $t1)
  ✓ [PASS] $t3 equals 25 ($t2 - $t0)
  ✓ [PASS] Forwarding unit triggered at least 2 forwarding bypasses
  ✓ [PASS] Zero data stalls incurred due to forwarding unit bypass

--- Suite 3: Load-Use Hazard & Bubble Insertion ---
  ✓ [PASS] $s1 loaded 99 correctly
  ✓ [PASS] $s2 computed 99 + 99 = 198 correctly
  ✓ [PASS] Exactly 1 data stall bubble inserted for Load-Use

--- Suite 4: Forwarding Disabled (Stall-Only Architecture) ---
  ✓ [PASS] $t0 is 10
  ✓ [PASS] $t1 is 10
  ✓ [PASS] Stalled at least 2 cycles waiting for register write-back without forwarding

--- Suite 5: Control Hazards & Branch Prediction ---
  ✓ [PASS] Loop executed 3 iterations ($t0 = 3)
  ✓ [PASS] Sum computed correctly ($t1 = 1 + 2 + 3 = 6)
  ✓ [PASS] Memory[4] contains 6
  ✓ [PASS] Control flush penalty cycles recorded on taken branch

--- Suite 6: Structural Hazards in Von Neumann Mode ---
  ✓ [PASS] Values computed correctly (77 + 77 = 154)
  ✓ [PASS] Structural memory stalls detected under Von Neumann unified memory

--- Suite 7: Benchmark 5 (Fibonacci Array) ---
  ✓ [PASS] Fib[0] = 0 in Mem[0]
  ✓ [PASS] Fib[1] = 1 in Mem[4]
  ✓ [PASS] Fib[2] = 1 in Mem[8]
  ✓ [PASS] Fib[3] = 2 in Mem[12]
  ✓ [PASS] Fib[4] = 3 in Mem[16]
  ✓ [PASS] Fib[5] = 5 in Mem[20]
  ✓ [PASS] Fib[6] = 8 in Mem[24]
  ✓ [PASS] Achieved pipeline speedup > 1.0 (Speedup = 4.184x)
  ✓ [PASS] CPI is realistic for pipelined processor (CPI = 1.195)

--- Suite 8: Quantitative Performance & Amdahl's Law ---
  ✓ [PASS] Amdahl's Law (f=0.8, s=4) yields exactly 2.5x
  ✓ [PASS] Theoretical maximum speedup as s->inf is 1/(1-0.8) = 5.0x
  ✓ [PASS] Pipeline speedup matches standard COA textbook formula

--- Suite 9: Subroutine Linkage (JAL/JR) & Space-Time Stage Verification ---
  ✓ [PASS] JAL saved correct return link address (PC 8) to $ra
  ✓ [PASS] Subroutine computed $v0 = 7 + 7 = 14
  ✓ [PASS] Caller resumed after JR and computed $s0 = 14 + 10 = 24
  ✓ [PASS] Space-Time diagram explicitly records 'STALL' stage for Load-Use bubble
  ✓ [PASS] Dynamic execution trace unfolds loop instances (recorded 22 instances)

===============================================================
TOTAL TESTS: 50 | PASSED: 50 | FAILED: 0
===============================================================
```
