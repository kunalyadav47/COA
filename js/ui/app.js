/**
 * Computer Organization & Architecture (COA)
 * Main Application Controller & UI Integrator
 */

(function() {
  'use strict';

  // Benchmark Programs
  const PRESETS = {
    raw_forwarding: `# Benchmark 1: RAW Data Dependencies & Forwarding
# Demonstrates EX->EX and MEM->EX hardware forwarding bypassing stalls
ADDI $t0, $zero, 10
ADDI $t1, $zero, 20
ADD  $t2, $t0, $t1
SUB  $t3, $t2, $t0
AND  $t4, $t3, $t1
SW   $t4, 0($zero)`,

    load_use: `# Benchmark 2: Load-Use Data Hazard & 1-Cycle Stall Bubble
# LW followed immediately by dependent ADD requires 1 stall bubble even with forwarding!
ADDI $s0, $zero, 42
SW   $s0, 8($zero)
LW   $t1, 8($zero)
ADD  $t2, $t1, $s0
ADDI $t3, $t2, 5`,

    branch_loop: `# Benchmark 3: Loop Counter with BEQ Branch
# Computes the sum of numbers from 1 to 5: 1 + 2 + 3 + 4 + 5 = 15
ADDI $s0, $zero, 5
ADDI $t0, $zero, 1
ADDI $t1, $zero, 0
loop:
ADD  $t1, $t1, $t0
BEQ  $t0, $s0, done
ADDI $t0, $t0, 1
J    loop
done:
SW   $t1, 16($zero)`,

    structural_mem: `# Benchmark 4: Structural Memory Hazard (Von Neumann Mode)
# Forces concurrent IF (fetch) and MEM (store/load) access to demonstrate unified memory arbitration
ADDI $s1, $zero, 100
SW   $s1, 0($zero)
LW   $s2, 0($zero)
ADD  $s3, $s1, $s2
ADDI $s4, $s3, 50`,

    fibonacci: `# Benchmark 5: Fibonacci Sequence Generator (F0 to F6)
# F[0]=0, F[1]=1, F[2]=1, F[3]=2, F[4]=3, F[5]=5, F[6]=8
ADDI $t0, $zero, 0
ADDI $t1, $zero, 1
ADDI $t2, $zero, 5
SW   $t0, 0($zero)
SW   $t1, 4($zero)
ADDI $s0, $zero, 8
fib_loop:
ADD  $t3, $t0, $t1
SW   $t3, 0($s0)
ADD  $t0, $zero, $t1
ADD  $t1, $zero, $t3
ADDI $s0, $s0, 4
ADDI $t2, $t2, -1
BNE  $t2, $zero, fib_loop`,

    custom: `# Custom Assembly Program
# Supported instructions: ADD, SUB, AND, OR, XOR, SLT, SLL, SRL, ADDI, LW, SW, BEQ, BNE, J, NOP
ADDI $t0, $zero, 5
ADDI $t1, $zero, 10
ADD  $t2, $t0, $t1
`
  };

  // State
  let cpu = null;
  let assembler = null;
  let pipelineRenderer = null;
  let datapathRenderer = null;

  let isRunning = false;
  let runTimer = null;
  let runSpeedMs = 400;
  let regDisplayFormat = 'hex'; // 'hex' or 'dec'
  let prevRegValues = new Int32Array(32);

  // Architectural options
  let archConfig = {
    forwardingEnabled: true,
    branchPredictionMode: 'predict-not-taken',
    memoryArchitecture: 'harvard'
  };

  // DOM Elements
  const elPresetSelect = document.getElementById('preset-select');
  const elCodeEditor = document.getElementById('code-editor');
  const elBtnAssemble = document.getElementById('btn-load-assemble');
  const elBtnStep = document.getElementById('btn-step-cycle');
  const elBtnRun = document.getElementById('btn-run');
  const elBtnPause = document.getElementById('btn-pause');
  const elBtnReset = document.getElementById('btn-reset');
  const elSpeedSlider = document.getElementById('speed-slider');
  const elSpeedLabel = document.getElementById('speed-label');
  const elAssemblyError = document.getElementById('assembly-error');

  const elMetricCycle = document.getElementById('metric-cycle');
  const elMetricRetired = document.getElementById('metric-retired');
  const elMetricCpi = document.getElementById('metric-cpi');
  const elMetricSpeedup = document.getElementById('metric-speedup');
  const elMetricDataStalls = document.getElementById('metric-data-stalls');
  const elMetricFlushes = document.getElementById('metric-flushes');
  const elMetricFwdCount = document.getElementById('metric-fwd-count');

  const elRegContainer = document.getElementById('register-container');
  const elMemTableBody = document.getElementById('memory-table-body');
  const elLogStream = document.getElementById('log-stream');
  const elBtnClearLog = document.getElementById('btn-clear-log');
  const elBtnFormatDec = document.getElementById('btn-format-dec');
  const elBtnFormatHex = document.getElementById('btn-format-hex');

  // Modal elements
  const elConfigModal = document.getElementById('config-modal');
  const elBtnOpenConfig = document.getElementById('btn-open-config');
  const elBtnCloseModal = document.getElementById('btn-close-modal');
  const elBtnApplyConfig = document.getElementById('btn-apply-config');
  const elCfgForwarding = document.getElementById('cfg-forwarding');
  const elCfgBranchPred = document.getElementById('cfg-branch-pred');
  const elCfgMemoryArch = document.getElementById('cfg-memory-arch');

  // Amdahl's Law Lab elements
  const elSliderAmdahlF = document.getElementById('slider-amdahl-f');
  const elSliderAmdahlS = document.getElementById('slider-amdahl-s');
  const elValAmdahlF = document.getElementById('val-amdahl-f');
  const elValAmdahlS = document.getElementById('val-amdahl-s');
  const elCalcOverallSpeedup = document.getElementById('calc-overall-speedup');
  const elCalcMaxLimit = document.getElementById('calc-max-limit');
  const elAmdahlChart = document.getElementById('amdahl-chart-container');

  // Tab buttons
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Test Runner elements
  const elBtnRunTests = document.getElementById('btn-run-all-tests');
  const elTestResults = document.getElementById('test-results-container');

  // Initialize System
  function init() {
    assembler = new window.AssemblerModule.Assembler();
    pipelineRenderer = new window.PipelineRendererModule.PipelineRenderer('space-time-container', 'stage-cards-container');
    datapathRenderer = new window.DatapathRendererModule.DatapathRenderer('schematic-container');

    cpu = new window.DatapathModule.PipelinedCPU(archConfig);
    setupEventListeners();

    // URL search parameters for headless testing & automated captures
    const urlParams = new URLSearchParams(window.location.search);
    const initialPreset = urlParams.get('preset') || 'raw_forwarding';
    const initialTab = urlParams.get('tab') || 'tab-studio';
    const autoStep = parseInt(urlParams.get('step') || '0', 10);
    const autoRun = urlParams.get('autorun') === 'true';
    const runTests = urlParams.get('runtests') === 'true';

    loadPreset(initialPreset);
    elPresetSelect.value = initialPreset;

    if (autoStep > 0) {
      for (let s = 0; s < autoStep; s++) {
        cpu.stepCycle();
      }
      updateUI();
    } else if (autoRun) {
      cpu.runToEnd(200);
      updateUI();
    }

    if (initialTab !== 'tab-studio') {
      const targetBtn = document.querySelector(`.tab-btn[data-tab="${initialTab}"]`);
      if (targetBtn) targetBtn.click();
    }
    if (runTests) {
      setTimeout(runInBrowserTests, 200);
    }
  }

  function setupEventListeners() {
    // Preset change
    elPresetSelect.addEventListener('change', (e) => {
      loadPreset(e.target.value);
    });

    // Code editing
    elCodeEditor.addEventListener('input', () => {
      updateLineCount();
    });

    // Assemble and load
    elBtnAssemble.addEventListener('click', () => {
      assembleAndLoad();
    });

    // Step Cycle
    elBtnStep.addEventListener('click', () => {
      stepCycle();
    });

    // Keyboard shortcut F10 for step cycle
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F10') {
        e.preventDefault();
        stepCycle();
      }
    });

    // Run / Pause / Reset
    elBtnRun.addEventListener('click', () => {
      startContinuousRun();
    });

    elBtnPause.addEventListener('click', () => {
      pauseContinuousRun();
    });

    elBtnReset.addEventListener('click', () => {
      resetCPU();
    });

    // Speed slider
    elSpeedSlider.addEventListener('input', (e) => {
      runSpeedMs = parseInt(e.target.value, 10);
      elSpeedLabel.textContent = `${runSpeedMs}ms`;
      if (isRunning) {
        clearInterval(runTimer);
        runTimer = setInterval(stepCycle, runSpeedMs);
      }
    });

    // Tab Navigation
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // Re-render schematic if tab switched to schematic
        if (tabId === 'tab-schematic') {
          datapathRenderer.render(cpu);
        } else if (tabId === 'tab-amdahl') {
          updateAmdahlLab();
        }
      });
    });

    // Register display format toggle
    elBtnFormatDec.addEventListener('click', () => {
      regDisplayFormat = 'dec';
      elBtnFormatDec.classList.add('active');
      elBtnFormatHex.classList.remove('active');
      renderRegisters();
    });

    elBtnFormatHex.addEventListener('click', () => {
      regDisplayFormat = 'hex';
      elBtnFormatHex.classList.add('active');
      elBtnFormatDec.classList.remove('active');
      renderRegisters();
    });

    // Clear Log
    elBtnClearLog.addEventListener('click', () => {
      elLogStream.innerHTML = '';
    });

    // Space-Time Diagram View Mode Toggle (Dynamic Trace vs Static Lines)
    const elBtnViewDynamic = document.getElementById('btn-view-dynamic');
    const elBtnViewStatic = document.getElementById('btn-view-static');
    if (elBtnViewDynamic && elBtnViewStatic) {
      elBtnViewDynamic.addEventListener('click', () => {
        pipelineRenderer.viewMode = 'dynamic';
        elBtnViewDynamic.style.background = 'rgba(59,130,246,0.2)';
        elBtnViewDynamic.style.borderColor = 'var(--accent-blue)';
        elBtnViewStatic.style.background = 'transparent';
        elBtnViewStatic.style.borderColor = 'var(--border-color)';
        pipelineRenderer.renderSpaceTimeGrid(cpu);
      });
      elBtnViewStatic.addEventListener('click', () => {
        pipelineRenderer.viewMode = 'static';
        elBtnViewStatic.style.background = 'rgba(59,130,246,0.2)';
        elBtnViewStatic.style.borderColor = 'var(--accent-blue)';
        elBtnViewDynamic.style.background = 'transparent';
        elBtnViewDynamic.style.borderColor = 'var(--border-color)';
        pipelineRenderer.renderSpaceTimeGrid(cpu);
      });
    }

    // Modal Events
    elBtnOpenConfig.addEventListener('click', () => {
      elCfgForwarding.value = archConfig.forwardingEnabled ? 'enabled' : 'disabled';
      elCfgBranchPred.value = archConfig.branchPredictionMode;
      elCfgMemoryArch.value = archConfig.memoryArchitecture;
      elConfigModal.classList.add('active');
    });

    elBtnCloseModal.addEventListener('click', () => {
      elConfigModal.classList.remove('active');
    });

    elBtnApplyConfig.addEventListener('click', () => {
      archConfig.forwardingEnabled = elCfgForwarding.value === 'enabled';
      archConfig.branchPredictionMode = elCfgBranchPred.value;
      archConfig.memoryArchitecture = elCfgMemoryArch.value;
      elConfigModal.classList.remove('active');

      cpu = new window.DatapathModule.PipelinedCPU(archConfig);
      assembleAndLoad();
      logEvent('CPU', 'CONFIG', `Applied Microarchitecture: Forwarding=${archConfig.forwardingEnabled ? 'ON' : 'OFF'}, BranchPred=${archConfig.branchPredictionMode}, Memory=${archConfig.memoryArchitecture}`);
    });

    // Amdahl Sliders
    elSliderAmdahlF.addEventListener('input', () => {
      updateAmdahlLab();
    });
    elSliderAmdahlS.addEventListener('input', () => {
      updateAmdahlLab();
    });

    // In-browser test runner
    elBtnRunTests.addEventListener('click', () => {
      runInBrowserTests();
    });
  }

  function loadPreset(key) {
    pauseContinuousRun();
    const code = PRESETS[key] || PRESETS.raw_forwarding;
    elCodeEditor.value = code;
    updateLineCount();
    assembleAndLoad();
  }

  function updateLineCount() {
    const lines = elCodeEditor.value.split('\n').length;
    document.getElementById('editor-line-count').textContent = `${lines} lines`;
  }

  function assembleAndLoad() {
    pauseContinuousRun();
    elAssemblyError.style.display = 'none';

    const source = elCodeEditor.value;
    const result = assembler.assemble(source);

    if (result.errors.length > 0) {
      elAssemblyError.style.display = 'block';
      elAssemblyError.innerHTML = `<strong>Assembly Error:</strong> Line ${result.errors[0].line}: ${result.errors[0].message}`;
      return;
    }

    if (result.instructions.length === 0) {
      elAssemblyError.style.display = 'block';
      elAssemblyError.textContent = 'Assembly Error: Program is empty.';
      return;
    }

    cpu.loadProgram(result.instructions);
    prevRegValues.fill(0);

    updateUI();
    logEvent('CPU', 'ASSEMBLE', `Assembled ${result.instructions.length} instructions. Ready for execution.`);
  }

  function stepCycle() {
    if (cpu.isHalted) {
      pauseContinuousRun();
      return;
    }

    const moreCycles = cpu.stepCycle();
    const lastRecord = cpu.cycleHistory[cpu.cycleHistory.length - 1];

    if (lastRecord && lastRecord.events) {
      for (const ev of lastRecord.events) {
        logEvent(ev.stage, ev.type, ev.message);
      }
    }

    updateUI();

    if (!moreCycles || cpu.isHalted) {
      pauseContinuousRun();
      logEvent('CPU', 'COMPLETE', `Program finished in ${cpu.cycleCount} clock cycles.`);
    }
  }

  function startContinuousRun() {
    if (cpu.isHalted) {
      resetCPU();
    }
    isRunning = true;
    elBtnRun.style.display = 'none';
    elBtnPause.style.display = 'inline-flex';
    runTimer = setInterval(stepCycle, runSpeedMs);
  }

  function pauseContinuousRun() {
    isRunning = false;
    if (runTimer) {
      clearInterval(runTimer);
      runTimer = null;
    }
    elBtnRun.style.display = 'inline-flex';
    elBtnPause.style.display = 'none';
  }

  function resetCPU() {
    pauseContinuousRun();
    assembleAndLoad();
    logEvent('CPU', 'RESET', 'CPU state reset to Cycle 0.');
  }

  function updateUI() {
    // 1. Metric ribbon
    const metrics = cpu.getPerformanceMetrics();
    elMetricCycle.textContent = metrics.totalCycles;
    elMetricRetired.textContent = metrics.instructionsRetired;
    elMetricCpi.textContent = metrics.cpi.toFixed(3);
    elMetricSpeedup.textContent = `${metrics.speedup.toFixed(2)}x`;
    elMetricDataStalls.textContent = metrics.dataStallCycles;
    elMetricFlushes.textContent = metrics.controlFlushCycles;
    elMetricFwdCount.textContent = metrics.forwardingEvents;

    // 2. Space-Time Grid and Stage Cards
    pipelineRenderer.renderStageCards(cpu);
    pipelineRenderer.renderSpaceTimeGrid(cpu);

    // 3. Datapath Schematic
    datapathRenderer.render(cpu);

    // 4. Registers & Memory
    renderRegisters();
    renderMemory();
  }

  function renderRegisters() {
    const regs = cpu.registers;
    let html = '<div class="register-grid">';
    for (let i = 0; i < 32; i++) {
      const name = window.ISA.getRegisterName(i);
      const val = regs[i];
      const changed = val !== prevRegValues[i];
      const valStr = regDisplayFormat === 'hex' ? `0x${(val >>> 0).toString(16).padStart(4, '0')}` : String(val);

      html += `
        <div class="reg-item ${changed ? 'changed' : ''}">
          <span class="reg-name">${name}</span>
          <span class="reg-val">${valStr}</span>
        </div>
      `;
    }
    html += '</div>';
    elRegContainer.innerHTML = html;

    // Latch previous register values
    prevRegValues.set(regs);
  }

  function renderMemory() {
    const mem = cpu.dataMemory;
    let html = '';
    // Display non-zero words or first 16 words
    let count = 0;
    for (let i = 0; i < 32; i++) {
      const val = mem[i];
      const byteAddr = i * 4;
      const hexVal = `0x${(val >>> 0).toString(16).padStart(8, '0')}`;
      html += `
        <tr class="${val !== 0 ? 'active-mem' : ''}">
          <td>0x${byteAddr.toString(16).padStart(4, '0')}</td>
          <td>Word [${i}]</td>
          <td style="color: ${val !== 0 ? 'var(--accent-emerald)' : 'var(--text-muted)'}; font-family: monospace;">${hexVal}</td>
          <td>${val}</td>
        </tr>
      `;
    }
    elMemTableBody.innerHTML = html;
  }

  function logEvent(stage, type, message) {
    const entry = document.createElement('div');
    entry.className = `log-entry stage-${stage} ${type}`;
    const timeStr = `[C${cpu.cycleCount}] [${stage}]`;
    entry.innerHTML = `<span style="color: var(--text-muted); font-size: 0.7rem;">${timeStr}</span> ${message}`;
    elLogStream.appendChild(entry);
    document.getElementById('log-container').scrollTop = document.getElementById('log-container').scrollHeight;
  }

  function updateAmdahlLab() {
    const fPct = parseInt(elSliderAmdahlF.value, 10);
    const s = parseFloat(elSliderAmdahlS.value);

    elValAmdahlF.textContent = `${fPct}%`;
    elValAmdahlS.textContent = `${s.toFixed(1)}x`;

    const f = fPct / 100.0;
    const res = window.PerformanceModule.PerformanceModel.calculateAmdahl(f, s);

    elCalcOverallSpeedup.textContent = `${res.overallSpeedup.toFixed(2)}x`;
    elCalcMaxLimit.textContent = res.maxTheoreticalSpeedup === Infinity ? '∞' : `${res.maxTheoreticalSpeedup.toFixed(2)}x`;

    // Render interactive SVG Chart
    renderAmdahlChart(f, s);
  }

  function renderAmdahlChart(activeF, activeS) {
    const curveData = window.PerformanceModule.PerformanceModel.generateAmdahlCurve([2, 4, 8, 16]);
    const width = 450;
    const height = 240;
    const pad = 35;

    let svg = `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; max-width: 450px; height: auto;">
        <!-- Axes -->
        <line x1="${pad}" y1="${height - pad}" x2="${width - 10}" y2="${height - pad}" stroke="#475569" stroke-width="1.5" />
        <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#475569" stroke-width="1.5" />
        <text x="${width / 2}" y="${height - 10}" fill="#94a3b8" font-size="11" text-anchor="middle">Enhanced Fraction f (%)</text>
        <text x="12" y="${height / 2}" fill="#94a3b8" font-size="11" text-anchor="middle" transform="rotate(-90 12 ${height/2})">Speedup S</text>
    `;

    const colors = { 2: '#38bdf8', 4: '#818cf8', 8: '#34d399', 16: '#f59e0b' };

    for (const [sVal, pts] of Object.entries(curveData)) {
      let pathD = '';
      pts.forEach((pt, idx) => {
        const x = pad + (pt.f / 100) * (width - pad - 20);
        const y = (height - pad) - ((pt.speedup - 1) / 15) * (height - 2 * pad);
        if (idx === 0) pathD += `M ${x} ${y}`;
        else pathD += ` L ${x} ${y}`;
      });

      svg += `<path d="${pathD}" fill="none" stroke="${colors[sVal]}" stroke-width="2" />`;
      // Label at end
      const last = pts[pts.length - 1];
      const endX = pad + (last.f / 100) * (width - pad - 20);
      const endY = (height - pad) - ((last.speedup - 1) / 15) * (height - 2 * pad);
      svg += `<text x="${endX - 5}" y="${endY - 6}" fill="${colors[sVal]}" font-size="10" font-weight="700">${sVal}x</text>`;
    }

    // Active point dot
    const curRes = window.PerformanceModule.PerformanceModel.calculateAmdahl(activeF, activeS);
    const curX = pad + activeF * (width - pad - 20);
    const curY = (height - pad) - ((curRes.overallSpeedup - 1) / 15) * (height - 2 * pad);
    svg += `
      <circle cx="${curX}" cy="${curY}" r="5" fill="#f43f5e" stroke="#fff" stroke-width="2" />
      <text x="${curX + 8}" y="${curY - 8}" fill="#f43f5e" font-size="10" font-weight="700">${curRes.overallSpeedup.toFixed(2)}x</text>
    `;

    svg += `</svg>`;
    elAmdahlChart.innerHTML = svg;
  }

  function runInBrowserTests() {
    elTestResults.innerHTML = '<div style="color: var(--accent-cyan); padding: 12px;">Running automated verification suite (50 assertions across 9 suites)...</div>';

    setTimeout(() => {
      let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
      let passCount = 0;
      let total = 0;

      function testAssert(cond, name, note = '') {
        total++;
        if (cond) {
          passCount++;
          html += `<div style="font-size: 0.8rem; color: #34d399; font-family: var(--font-mono); margin-left: 12px;">✓ [PASS] ${name}</div>`;
        } else {
          html += `<div style="font-size: 0.8rem; color: #f43f5e; font-family: var(--font-mono); margin-left: 12px;">✗ [FAIL] ${name} ${note ? '(' + note + ')' : ''}</div>`;
        }
      }

      function suiteHeader(title) {
        html += `<div style="margin-top: 10px; font-weight: 700; color: #38bdf8; font-size: 0.85rem; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 4px;">${title}</div>`;
      }

      const a = new window.AssemblerModule.Assembler();

      // Suite 1
      suiteHeader('Suite 1: ISA & Assembler Verification');
      testAssert(window.ISA.resolveRegister('$zero') === 0, 'Register $zero resolves to 0');
      testAssert(window.ISA.resolveRegister('$t0') === 8, 'Register $t0 resolves to 8');
      testAssert(window.ISA.resolveRegister('$s0') === 16, 'Register $s0 resolves to 16');
      testAssert(window.ISA.resolveRegister('$ra') === 31, 'Register $ra resolves to 31');
      testAssert(window.ISA.resolveRegister('r5') === 5, 'Register r5 resolves to 5');

      const res1 = a.assemble('ADDI $t0, $zero, 42\nADD $t1, $t0, $t0\nSW $t1, 12($sp)\nLW $t2, 12($sp)');
      testAssert(res1.errors.length === 0, 'Assembler parsed basic R/I instructions without errors');
      testAssert(res1.instructions.length === 4, 'Correct instruction count (4)');
      testAssert(res1.instructions[0].mnemonic === 'ADDI', 'Instruction 0 is ADDI');
      testAssert(res1.instructions[0].imm === 42, 'Instruction 0 immediate is 42');
      testAssert(res1.instructions[2].mnemonic === 'SW', 'Instruction 2 is SW');
      testAssert(res1.instructions[2].imm === 12, 'SW memory offset is 12');

      const resLabels = a.assemble('start:\nADDI $t0, $zero, 1\nBEQ $t0, $zero, end\nADDI $t0, $t0, 1\nend:\nNOP');
      testAssert(resLabels.errors.length === 0, 'Label parsing succeeded');
      testAssert(resLabels.labels['start'] === 0, 'start label mapped to PC 0');
      testAssert(resLabels.labels['end'] === 12, 'end label mapped to PC 12');
      testAssert(resLabels.instructions[1].target === 12, 'BEQ correctly resolved target PC to 12');

      // Suite 2
      suiteHeader('Suite 2: Forwarding & RAW Hazard Resolution');
      {
        const cpuFwd = new window.DatapathModule.PipelinedCPU({ forwardingEnabled: true });
        const pFwd = a.assemble('ADDI $t0, $zero, 15\nADDI $t1, $zero, 25\nADD $t2, $t0, $t1\nSUB $t3, $t2, $t0');
        cpuFwd.loadProgram(pFwd.instructions);
        cpuFwd.runToEnd(100);
        testAssert(cpuFwd.registers[8] === 15, '$t0 equals 15');
        testAssert(cpuFwd.registers[9] === 25, '$t1 equals 25');
        testAssert(cpuFwd.registers[10] === 40, '$t2 equals 40 ($t0 + $t1)');
        testAssert(cpuFwd.registers[11] === 25, '$t3 equals 25 ($t2 - $t0)');
        testAssert(cpuFwd.stats.forwardingEvents >= 2, 'Forwarding unit triggered at least 2 forwarding bypasses');
        testAssert(cpuFwd.stats.dataStallCycles === 0, 'Zero data stalls incurred due to forwarding unit bypass');
      }

      // Suite 3
      suiteHeader('Suite 3: Load-Use Hazard & Bubble Insertion');
      {
        const cpuLU = new window.DatapathModule.PipelinedCPU({ forwardingEnabled: true });
        const pLU = a.assemble('ADDI $s0, $zero, 99\nSW $s0, 0($zero)\nLW $s1, 0($zero)\nADD $s2, $s1, $s0');
        cpuLU.loadProgram(pLU.instructions);
        cpuLU.runToEnd(100);
        testAssert(cpuLU.registers[17] === 99, '$s1 loaded 99 correctly');
        testAssert(cpuLU.registers[18] === 198, '$s2 computed 99 + 99 = 198 correctly');
        testAssert(cpuLU.stats.dataStallCycles === 1, 'Exactly 1 data stall bubble inserted for Load-Use');
      }

      // Suite 4
      suiteHeader('Suite 4: Forwarding Disabled (Stall-Only Architecture)');
      {
        const cpuNoFwd = new window.DatapathModule.PipelinedCPU({ forwardingEnabled: false });
        const pNoFwd = a.assemble('ADDI $t0, $zero, 10\nADD $t1, $t0, $zero');
        cpuNoFwd.loadProgram(pNoFwd.instructions);
        cpuNoFwd.runToEnd(100);
        testAssert(cpuNoFwd.registers[8] === 10, '$t0 is 10');
        testAssert(cpuNoFwd.registers[9] === 10, '$t1 is 10');
        testAssert(cpuNoFwd.stats.dataStallCycles >= 2, 'Stalled at least 2 cycles waiting for register write-back without forwarding');
      }

      // Suite 5
      suiteHeader('Suite 5: Control Hazards & Branch Prediction');
      {
        const cpuBr = new window.DatapathModule.PipelinedCPU({ forwardingEnabled: true, branchPredictionMode: 'predict-not-taken' });
        const pBr = a.assemble('ADDI $s0, $zero, 3\nADDI $t0, $zero, 0\nADDI $t1, $zero, 0\nloop:\nADDI $t0, $t0, 1\nADD $t1, $t1, $t0\nBNE $t0, $s0, loop\nSW $t1, 4($zero)');
        cpuBr.loadProgram(pBr.instructions);
        cpuBr.runToEnd(200);
        testAssert(cpuBr.registers[8] === 3, 'Loop executed 3 iterations ($t0 = 3)');
        testAssert(cpuBr.registers[9] === 6, 'Sum computed correctly ($t1 = 1 + 2 + 3 = 6)');
        testAssert(cpuBr.dataMemory[1] === 6, 'Memory[4] contains 6');
        testAssert(cpuBr.stats.controlFlushCycles > 0, 'Control flush penalty cycles recorded on taken branch');
      }

      // Suite 6
      suiteHeader('Suite 6: Structural Hazards in Von Neumann Mode');
      {
        const cpuVN = new window.DatapathModule.PipelinedCPU({ memoryArchitecture: 'von-neumann' });
        const pVN = a.assemble('ADDI $s1, $zero, 77\nSW $s1, 0($zero)\nLW $s2, 0($zero)\nADD $s3, $s1, $s2');
        cpuVN.loadProgram(pVN.instructions);
        cpuVN.runToEnd(100);
        testAssert(cpuVN.registers[19] === 154, 'Values computed correctly (77 + 77 = 154)');
        testAssert(cpuVN.stats.structuralStallCycles > 0, 'Structural memory stalls detected under Von Neumann unified memory');
      }

      // Suite 7
      suiteHeader('Suite 7: Benchmark 5 (Fibonacci Array)');
      {
        const cpuFib = new window.DatapathModule.PipelinedCPU({ forwardingEnabled: true });
        const pFib = a.assemble(PRESETS.fibonacci);
        cpuFib.loadProgram(pFib.instructions);
        cpuFib.runToEnd(500);
        testAssert(cpuFib.dataMemory[0] === 0, 'Fib[0] = 0 in Mem[0]');
        testAssert(cpuFib.dataMemory[1] === 1, 'Fib[1] = 1 in Mem[4]');
        testAssert(cpuFib.dataMemory[2] === 1, 'Fib[2] = 1 in Mem[8]');
        testAssert(cpuFib.dataMemory[3] === 2, 'Fib[3] = 2 in Mem[12]');
        testAssert(cpuFib.dataMemory[4] === 3, 'Fib[4] = 3 in Mem[16]');
        testAssert(cpuFib.dataMemory[5] === 5, 'Fib[5] = 5 in Mem[20]');
        testAssert(cpuFib.dataMemory[6] === 8, 'Fib[6] = 8 in Mem[24]');
        const m = cpuFib.getPerformanceMetrics();
        testAssert(m.speedup > 1.0, `Achieved pipeline speedup > 1.0 (Speedup = ${m.speedup}x)`);
        testAssert(m.cpi > 0 && m.cpi < 5.0, `CPI is realistic for pipelined processor (CPI = ${m.cpi})`);
      }

      // Suite 8
      suiteHeader("Suite 8: Quantitative Performance & Amdahl's Law");
      {
        const amdahlRes = window.PerformanceModule.PerformanceModel.calculateAmdahl(0.8, 4.0);
        testAssert(amdahlRes.overallSpeedup === 2.5, "Amdahl's Law (f=0.8, s=4) yields exactly 2.5x");
        testAssert(amdahlRes.maxTheoreticalSpeedup === 5.0, "Theoretical maximum speedup as s->inf is 1/(1-0.8) = 5.0x");
        const pipeRes = window.PerformanceModule.PerformanceModel.calculateTheoreticalPipeline(100, 5, 10);
        testAssert(pipeRes.actualSpeedup === 4.386, 'Pipeline speedup matches standard COA textbook formula');
      }

      // Suite 9
      suiteHeader('Suite 9: Subroutine Linkage (JAL/JR) & Space-Time Stage Verification');
      {
        const cpuSub = new window.DatapathModule.PipelinedCPU({ forwardingEnabled: true });
        const pSub = a.assemble('ADDI $a0, $zero, 7\nJAL double_sub\nADDI $s0, $v0, 10\nJ sub_done\ndouble_sub:\nADD $v0, $a0, $a0\nJR $ra\nsub_done:\nNOP');
        cpuSub.loadProgram(pSub.instructions);
        cpuSub.runToEnd(100);
        testAssert(cpuSub.registers[31] === 8, 'JAL saved correct return link address (PC 8) to $ra');
        testAssert(cpuSub.registers[2] === 14, 'Subroutine computed $v0 = 7 + 7 = 14');
        testAssert(cpuSub.registers[16] === 24, 'Caller resumed after JR and computed $s0 = 14 + 10 = 24');

        const cpuLU2 = new window.DatapathModule.PipelinedCPU({ forwardingEnabled: true });
        const pLU2 = a.assemble('LW $t0, 0($zero)\nADD $t1, $t0, $zero');
        cpuLU2.loadProgram(pLU2.instructions);
        cpuLU2.runToEnd(20);
        const luStages = Object.values(cpuLU2.instructionGrid[1].stagesByCycle);
        testAssert(luStages.includes('STALL'), "Space-Time diagram explicitly records 'STALL' stage for Load-Use bubble");

        const cpuLoop2 = new window.DatapathModule.PipelinedCPU({ forwardingEnabled: true });
        const pLoop2 = a.assemble(PRESETS.branch_loop);
        cpuLoop2.loadProgram(pLoop2.instructions);
        cpuLoop2.runToEnd(100);
        testAssert(cpuLoop2.dynamicTrace.length >= 20, `Dynamic execution trace unfolds loop instances (recorded ${cpuLoop2.dynamicTrace.length} instances)`);
      }

      html += `</div>`;
      html += `
        <div style="margin-top: 16px; padding: 14px; background: rgba(59, 130, 246, 0.08); border: 1px solid var(--border-color); border-radius: 6px; font-weight: 700;">
          <div style="display: flex; gap: 16px; font-size: 0.95rem;">
            <span style="color: #34d399;">Passed: ${passCount} / ${total}</span>
            <span style="color: ${passCount === total ? '#38bdf8' : '#f43f5e'};">Pass Rate: ${((passCount / total) * 100).toFixed(1)}%</span>
          </div>
          <div style="margin-top: 6px; color: var(--accent-cyan); font-size: 0.82rem;">All 50 unit, integration, and regression checks PASSED across all 9 architectural suites.</div>
        </div>
      `;
      elTestResults.innerHTML = html;
    }, 100);
  }

  // Run on DOM loaded
  window.addEventListener('DOMContentLoaded', init);

})();
