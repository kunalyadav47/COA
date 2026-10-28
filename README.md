# COA 5-Stage Pipelined Processor Studio

**Computer Organization & Architecture (COA) Academic Microproject**  
**Student:** Kunal Yadav | **Roll No:** 2411021060008 | **Squad:** 70  
**Curriculum Scope:** Module 3 (Instruction Pipelining, Hazard Resolution & Amdahl's Law) integrated with Module 2 (CPU Datapath & Control) and Module 1 (Functional Units & Common Bus Organization).

---

## 🚀 Overview

The **COA 5-Stage Pipelined Processor Studio** is an interactive, cycle-accurate architectural simulator and microarchitectural hazard analysis workbench. It models a 32-bit RISC CPU (MIPS / RISC-V subset) executing instructions across the classical five pipeline stages:
1. **IF** - Instruction Fetch
2. **ID** - Instruction Decode & Register File Read (Hardwired Control Unit)
3. **EX** - Execution & Address Calculation (ALU & Forwarding MUXes)
4. **MEM** - Data Memory Access (Word-Aligned RAM)
5. **WB** - Write-Back to Register File

### Key Features
- **Dynamic Space-Time Diagram Matrix:** Real-time visual grid showing the cycle-by-cycle stage of every instruction in flight, with color-coded badges, stall bubbles, and flushes.
- **Hardware Forwarding (Bypassing) Unit:** Emulates EX/MEM → EX and MEM/WB → EX data forwarding to resolve Read-After-Write (RAW) data dependencies with zero stall penalty.
- **Hazard Interlocking & Bubble Insertion:** Faithfully identifies Load-Use hazards and injects 1-cycle bubble stalls into the pipeline.
- **Branch Prediction & Control Hazard Handling:** Configurable Static Predict-Not-Taken, Dynamic 2-Bit Saturating Counter, and Static Predict-Taken predictors with branch target buffering.
- **Structural Hazard Simulation:** Demonstrates memory port arbitration in Von Neumann (unified memory) mode vs. collision-free Harvard split-cache architecture.
- **Amdahl's Law Laboratory:** Interactive parametric calculator and sensitivity curve visualizer modeling parallel speedup limits.
- **Automated Verification Suite:** 50 distinct unit and regression tests running in both Node.js CLI and in-browser across 9 suites.

---

## 📁 Repository Structure

```
coa-pipelining-simulator/
├── index.html                   # Master engineering workstation user interface
├── css/
│   └── styles.css               # Dark-slate CAD workbench stylesheet
├── js/
│   ├── engine/
│   │   ├── isa.js               # 32-bit RISC ISA specifications & opcodes
│   │   ├── assembler.js         # Two-pass assembly parser and label resolver
│   │   ├── hazard_unit.js       # Forwarding logic, stall detection, branch predictor
│   │   ├── datapath.js          # 5-stage CPU datapath & cycle stepping engine
│   │   └── performance.js       # CPI, speedup, and Amdahl's Law mathematical models
│   └── ui/
│       ├── pipeline_renderer.js # Space-time diagram matrix renderer
│       ├── datapath_renderer.js # Interactive SVG schematic renderer
│       └── app.js               # UI coordinator and event dispatcher
├── examples/                    # 5 Pre-configured educational benchmark programs
│   ├── benchmark1_raw_forwarding.asm
│   ├── benchmark2_load_use.asm
│   ├── benchmark3_branch_loop.asm
│   ├── benchmark4_structural_mem.asm
│   └── benchmark5_fibonacci.asm
├── tests/
│   └── test_runner.js           # 50-assertion automated Node.js test suite
├── docs/
│   ├── COA_Project_Report.md    # Full academic project report (Markdown)
│   ├── COA_Project_Report.html  # Styled printable HTML report
│   └── COA_Project_Report.pdf   # Official PDF project report (compiled via Chromium)
├── screenshots/                 # High-resolution application screenshots
│   ├── coa_overview_spacetime_studio.png
│   ├── coa_datapath_schematic.png
│   ├── coa_amdahl_performance_lab.png
│   ├── coa_load_use_hazard.png
│   └── coa_automated_test_suite.png
├── capture_artifacts.py         # Automated screenshot capture & PDF compilation tool
├── README.md                    # Project overview & documentation
└── TESTING.md                   # Verification and test execution record
```

---

## 🏃 Quick Start Guide

### 1. Launching the Web Simulator
Simply open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Firefox, Safari). Zero build steps or package managers (`npm`/`yarn`) are required:
```bash
start index.html
```

### 2. Running Automated Tests via Node.js
```bash
node tests/test_runner.js
```

### 3. Re-capturing Screenshots and Compiling the Report PDF
```bash
python capture_artifacts.py
```

---

## 📋 Academic Identity
- **Student Name:** Kunal Yadav
- **Roll Number:** 2411021060008
- **Squad:** 70
- **Course:** Computer Organization & Architecture (COA)
- **Year:** 2026
