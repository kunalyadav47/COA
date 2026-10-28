/**
 * Computer Organization & Architecture (COA)
 * Interactive 5-Stage Datapath SVG Schematic Renderer
 */

(function(exports) {
  'use strict';

  class DatapathRenderer {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
    }

    render(cpu) {
      if (!this.container) return;

      const ifInst = cpu.IF_ID && !cpu.IF_ID.isBubble ? cpu.IF_ID.inst : null;
      const idInst = cpu.ID_EX && !cpu.ID_EX.isBubble ? cpu.ID_EX.inst : null;
      const exInst = cpu.EX_MEM && !cpu.EX_MEM.isBubble ? cpu.EX_MEM.inst : null;
      const memInst = cpu.MEM_WB && !cpu.MEM_WB.isBubble ? cpu.MEM_WB.inst : null;

      const lastHistory = cpu.cycleHistory.length > 0 ? cpu.cycleHistory[cpu.cycleHistory.length - 1] : null;
      const fwd = lastHistory ? lastHistory.forwardInfo : { forwardA: 0, forwardB: 0 };

      const ifText = ifInst ? ifInst.rawAsm : 'NOP / Idle';
      const idText = idInst ? idInst.rawAsm : 'NOP / Idle';
      const exText = exInst ? exInst.rawAsm : 'NOP / Idle';
      const memText = memInst ? memInst.rawAsm : 'NOP / Idle';

      const fwdAActive = fwd.forwardA !== 0;
      const fwdBActive = fwd.forwardB !== 0;

      const svg = `
        <svg viewBox="0 0 1000 480" class="schematic-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-reg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#334155" />
              <stop offset="100%" stop-color="#1e293b" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
            <marker id="arrow-fwd" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>

          <!-- Stage Columns Backgrounds -->
          <rect x="10" y="30" width="170" height="420" rx="8" fill="rgba(2, 132, 199, 0.05)" stroke="#0284c7" stroke-width="1" stroke-dasharray="4" />
          <text x="95" y="55" fill="#0284c7" font-weight="700" font-size="14" text-anchor="middle">IF: Instruction Fetch</text>
          
          <rect x="210" y="30" width="180" height="420" rx="8" fill="rgba(124, 58, 237, 0.05)" stroke="#7c3aed" stroke-width="1" stroke-dasharray="4" />
          <text x="300" y="55" fill="#7c3aed" font-weight="700" font-size="14" text-anchor="middle">ID: Decode & RegRead</text>
          
          <rect x="420" y="30" width="180" height="420" rx="8" fill="rgba(217, 119, 6, 0.05)" stroke="#d97706" stroke-width="1" stroke-dasharray="4" />
          <text x="510" y="55" fill="#d97706" font-weight="700" font-size="14" text-anchor="middle">EX: Execute & ALU</text>
          
          <rect x="630" y="30" width="170" height="420" rx="8" fill="rgba(5, 150, 105, 0.05)" stroke="#059669" stroke-width="1" stroke-dasharray="4" />
          <text x="715" y="55" fill="#059669" font-weight="700" font-size="14" text-anchor="middle">MEM: Memory Access</text>
          
          <rect x="830" y="30" width="150" height="420" rx="8" fill="rgba(220, 38, 38, 0.05)" stroke="#dc2626" stroke-width="1" stroke-dasharray="4" />
          <text x="905" y="55" fill="#dc2626" font-weight="700" font-size="14" text-anchor="middle">WB: Write-Back</text>

          <!-- Inter-Stage Pipeline Registers -->
          <rect x="185" y="70" width="20" height="360" rx="4" fill="url(#grad-reg)" stroke="#475569" stroke-width="2" />
          <text x="195" y="260" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" transform="rotate(-90 195 260)">IF / ID REGISTER</text>

          <rect x="395" y="70" width="20" height="360" rx="4" fill="url(#grad-reg)" stroke="#475569" stroke-width="2" />
          <text x="405" y="260" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" transform="rotate(-90 405 260)">ID / EX REGISTER</text>

          <rect x="605" y="70" width="20" height="360" rx="4" fill="url(#grad-reg)" stroke="#475569" stroke-width="2" />
          <text x="615" y="260" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" transform="rotate(-90 615 260)">EX / MEM REGISTER</text>

          <rect x="805" y="70" width="20" height="360" rx="4" fill="url(#grad-reg)" stroke="#475569" stroke-width="2" />
          <text x="815" y="260" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" transform="rotate(-90 815 260)">MEM / WB REGISTER</text>

          <!-- Component Blocks -->
          <!-- 1. IF Stage: PC & Instruction Memory -->
          <rect x="25" y="160" width="45" height="70" rx="4" fill="#1e293b" stroke="#0284c7" stroke-width="2" />
          <text x="47" y="195" fill="#38bdf8" font-weight="700" font-size="12" text-anchor="middle">PC</text>
          <text x="47" y="215" fill="#94a3b8" font-size="10" text-anchor="middle">0x${(cpu.pc || 0).toString(16)}</text>

          <line x1="70" y1="195" x2="95" y2="195" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)" />

          <rect x="95" y="145" width="75" height="100" rx="4" fill="#1e293b" stroke="#0284c7" stroke-width="2" />
          <text x="132" y="185" fill="#38bdf8" font-weight="700" font-size="11" text-anchor="middle">Instruction</text>
          <text x="132" y="200" fill="#38bdf8" font-weight="700" font-size="11" text-anchor="middle">Memory</text>
          <text x="132" y="225" fill="#94a3b8" font-size="9" text-anchor="middle">[ROM/Cache]</text>

          <!-- Line from IM to IF/ID -->
          <line x1="170" y1="195" x2="185" y2="195" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)" />

          <!-- 2. ID Stage: Control Unit & Register File -->
          <rect x="235" y="90" width="135" height="60" rx="4" fill="#1e293b" stroke="#7c3aed" stroke-width="2" />
          <text x="302" y="115" fill="#c084fc" font-weight="700" font-size="12" text-anchor="middle">Control Unit</text>
          <text x="302" y="135" fill="#94a3b8" font-size="10" text-anchor="middle">Hardwired Decoder</text>

          <rect x="240" y="180" width="125" height="130" rx="4" fill="#1e293b" stroke="#7c3aed" stroke-width="2" />
          <text x="302" y="210" fill="#c084fc" font-weight="700" font-size="12" text-anchor="middle">Register File</text>
          <text x="255" y="240" fill="#94a3b8" font-size="10">Read 1</text>
          <text x="255" y="270" fill="#94a3b8" font-size="10">Read 2</text>
          <text x="255" y="295" fill="#94a3b8" font-size="10">Write Reg</text>

          <rect x="250" y="340" width="105" height="40" rx="4" fill="#1e293b" stroke="#7c3aed" stroke-width="1.5" />
          <text x="302" y="365" fill="#c084fc" font-size="11" text-anchor="middle">Sign Extend</text>

          <!-- Lines from ID to ID/EX -->
          <line x1="365" y1="235" x2="395" y2="235" stroke="#c084fc" stroke-width="2" marker-end="url(#arrow)" />
          <line x1="365" y1="265" x2="395" y2="265" stroke="#c084fc" stroke-width="2" marker-end="url(#arrow)" />
          <line x1="355" y1="360" x2="395" y2="360" stroke="#c084fc" stroke-width="2" marker-end="url(#arrow)" />

          <!-- 3. EX Stage: Forwarding Unit & ALU -->
          <rect x="440" y="345" width="140" height="55" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="2" />
          <text x="510" y="370" fill="#fbbf24" font-weight="700" font-size="12" text-anchor="middle">Forwarding Unit</text>
          <text x="510" y="388" fill="#94a3b8" font-size="9" text-anchor="middle">FwdA: ${fwd.forwardA} | FwdB: ${fwd.forwardB}</text>

          <!-- ALU polygon -->
          <polygon points="490,170 540,200 540,240 490,270 490,230 480,220 490,210" fill="#1e293b" stroke="#d97706" stroke-width="2.5" />
          <text x="510" y="225" fill="#f59e0b" font-weight="800" font-size="14" text-anchor="middle">ALU</text>

          <!-- Lines to ALU -->
          <line x1="415" y1="190" x2="485" y2="190" stroke="#f59e0b" stroke-width="2" marker-end="url(#arrow)" />
          <line x1="415" y1="250" x2="485" y2="250" stroke="#f59e0b" stroke-width="2" marker-end="url(#arrow)" />

          <!-- Line from ALU to EX/MEM -->
          <line x1="540" y1="220" x2="605" y2="220" stroke="#f59e0b" stroke-width="2.5" marker-end="url(#arrow)" />

          <!-- 4. MEM Stage: Data Memory -->
          <rect x="655" y="170" width="120" height="120" rx="4" fill="#1e293b" stroke="#059669" stroke-width="2" />
          <text x="715" y="210" fill="#34d399" font-weight="700" font-size="13" text-anchor="middle">Data Memory</text>
          <text x="670" y="240" fill="#94a3b8" font-size="10">Address</text>
          <text x="670" y="265" fill="#94a3b8" font-size="10">Write Data</text>

          <!-- Lines from EX/MEM to MEM & Pass-through -->
          <line x1="625" y1="220" x2="655" y2="220" stroke="#34d399" stroke-width="2" marker-end="url(#arrow)" />
          <line x1="775" y1="220" x2="805" y2="220" stroke="#34d399" stroke-width="2" marker-end="url(#arrow)" />

          <!-- 5. WB Stage: WriteBack MUX & Feedback Wire -->
          <ellipse cx="880" cy="220" rx="20" ry="35" fill="#1e293b" stroke="#dc2626" stroke-width="2" />
          <text x="880" y="225" fill="#f87171" font-weight="700" font-size="10" text-anchor="middle">MUX</text>

          <!-- Feedback wire to RegFile Write Port -->
          <path d="M 900 220 L 950 220 L 950 450 L 225 450 L 225 300 L 240 300" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="5" marker-end="url(#arrow)" />
          <text x="600" y="443" fill="#f87171" font-size="10" font-family="monospace">Write-Back Bus (Register Write Port)</text>

          <!-- Active Forwarding Bypass Paths -->
          ${fwd.forwardA === 2 ? `
            <path d="M 615 210 Q 530 135 450 185" fill="none" stroke="#f59e0b" stroke-width="3" filter="url(#glow)" marker-end="url(#arrow-fwd)" />
            <text x="530" y="145" fill="#fbbf24" font-size="11" font-weight="700" text-anchor="middle">EX/MEM → ForwardA (ALU In1)</text>
          ` : (fwd.forwardA === 1 ? `
            <path d="M 815 210 Q 630 120 450 185" fill="none" stroke="#f59e0b" stroke-width="3" filter="url(#glow)" marker-end="url(#arrow-fwd)" />
            <text x="630" y="130" fill="#fbbf24" font-size="11" font-weight="700" text-anchor="middle">MEM/WB → ForwardA (ALU In1)</text>
          ` : '')}

          ${fwd.forwardB === 2 ? `
            <path d="M 615 240 Q 530 310 450 255" fill="none" stroke="#f59e0b" stroke-width="3" filter="url(#glow)" marker-end="url(#arrow-fwd)" />
            <text x="530" y="315" fill="#fbbf24" font-size="11" font-weight="700" text-anchor="middle">EX/MEM → ForwardB (ALU In2)</text>
          ` : (fwd.forwardB === 1 ? `
            <path d="M 815 240 Q 630 330 450 255" fill="none" stroke="#f59e0b" stroke-width="3" filter="url(#glow)" marker-end="url(#arrow-fwd)" />
            <text x="630" y="335" fill="#fbbf24" font-size="11" font-weight="700" text-anchor="middle">MEM/WB → ForwardB (ALU In2)</text>
          ` : '')}

          <!-- Instruction Footers -->
          <text x="95" y="440" fill="#38bdf8" font-size="11" font-family="monospace" text-anchor="middle">${ifText}</text>
          <text x="300" y="440" fill="#c084fc" font-size="11" font-family="monospace" text-anchor="middle">${idText}</text>
          <text x="510" y="440" fill="#fbbf24" font-size="11" font-family="monospace" text-anchor="middle">${exText}</text>
          <text x="715" y="440" fill="#34d399" font-size="11" font-family="monospace" text-anchor="middle">${memText}</text>
        </svg>
      `;

      this.container.innerHTML = svg;
    }
  }

  exports.DatapathRenderer = DatapathRenderer;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.DatapathRendererModule = {}));
