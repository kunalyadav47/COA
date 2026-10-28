/**
 * Computer Organization & Architecture (COA)
 * Pipeline Space-Time Diagram & Stage Status Renderer
 */

(function(exports) {
  'use strict';

  class PipelineRenderer {
    constructor(tableContainerId, stageCardsContainerId) {
      this.tableContainer = document.getElementById(tableContainerId);
      this.stageCardsContainer = document.getElementById(stageCardsContainerId);
      this.viewMode = 'dynamic'; // 'dynamic' (execution trace) or 'static' (assembly lines)
    }

    /**
     * Render the 5 active stage cards in the sidebar
     */
    renderStageCards(cpu) {
      if (!this.stageCardsContainer) return;

      const stages = [
        { name: 'IF', reg: cpu.IF_ID, tag: 'Fetch', colorVar: '--stage-if' },
        { name: 'ID', reg: cpu.ID_EX, tag: 'Decode', colorVar: '--stage-id' },
        { name: 'EX', reg: cpu.EX_MEM, tag: 'Execute', colorVar: '--stage-ex' },
        { name: 'MEM', reg: cpu.MEM_WB, tag: 'Memory', colorVar: '--stage-mem' },
        { name: 'WB', reg: cpu.cycleHistory.length > 0 ? cpu.cycleHistory[cpu.cycleHistory.length - 1].stages.WB : null, tag: 'WriteBack', colorVar: '--stage-wb' }
      ];

      let html = '';
      for (const s of stages) {
        const reg = s.reg;
        const isBubble = !reg || reg.isBubble || !reg.inst;
        const asmText = isBubble ? (reg && reg.bubbleReason ? `[BUBBLE: ${reg.bubbleReason}]` : '[BUBBLE / NOP]') : reg.inst.rawAsm;
        const pcText = (!isBubble && reg.inst) ? `PC: 0x${(reg.inst.pc || 0).toString(16).padStart(4, '0')}` : 'Inactive';

        let metaText = '';
        if (!isBubble && reg.ctrl) {
          const activeSignals = [];
          if (reg.ctrl.regWrite) activeSignals.push('RegWrite=1');
          if (reg.ctrl.memRead) activeSignals.push('MemRead=1');
          if (reg.ctrl.memWrite) activeSignals.push('MemWrite=1');
          if (reg.ctrl.aluOp && reg.ctrl.aluOp !== 'NOP') activeSignals.push(`ALU=${reg.ctrl.aluOp}`);
          metaText = activeSignals.length > 0 ? activeSignals.join(' | ') : 'Control: Idle';
        }

        html += `
          <div class="stage-card stage-${s.name}">
            <div class="stage-card-title">
              <span style="color: var(${s.colorVar})">${s.name} Stage (${s.tag})</span>
              <span class="tag" style="background: rgba(255,255,255,0.08);">${pcText}</span>
            </div>
            <div class="stage-card-content" title="${asmText}">
              ${asmText}
            </div>
            <div class="stage-card-meta">${metaText}</div>
          </div>
        `;
      }

      this.stageCardsContainer.innerHTML = html;
    }

    /**
     * Render the Space-Time Diagram Matrix (Cycle vs Instruction)
     */
    renderSpaceTimeGrid(cpu) {
      if (!this.tableContainer) return;

      const totalCycles = cpu.cycleCount;
      if (totalCycles === 0) {
        this.tableContainer.innerHTML = `
          <div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            Simulation not started. Click <strong>"Step Cycle"</strong> or <strong>"Run Continuous"</strong> to trace pipeline execution.
          </div>
        `;
        return;
      }

      const rows = (this.viewMode === 'dynamic' && cpu.dynamicTrace && cpu.dynamicTrace.length > 0)
        ? cpu.dynamicTrace
        : (cpu.instructionGrid || []);

      let html = `<table class="space-time-table"><thead><tr>`;
      html += `<th class="inst-col">${this.viewMode === 'dynamic' ? 'Dynamic Execution Instance' : 'Instruction'}</th>`;

      // Cycle header columns
      for (let c = 1; c <= totalCycles; c++) {
        const isCurrent = c === totalCycles;
        const curStyle = isCurrent ? 'style="border-bottom: 2px solid var(--accent-cyan); color: #fff;"' : '';
        html += `<th ${curStyle}>C${c}</th>`;
      }
      html += `</tr></thead><tbody>`;

      // Instruction rows
      for (const row of rows) {
        const titleText = this.viewMode === 'dynamic'
          ? `Instance #${row.dynamicId} @ PC 0x${(row.pc || 0).toString(16)}`
          : `PC 0x${(row.pc || 0).toString(16)}`;
        const labelText = this.viewMode === 'dynamic'
          ? `[#${row.dynamicId}] ${row.rawAsm}`
          : `[0x${(row.pc || 0).toString(16).padStart(2, '0')}] ${row.rawAsm}`;

        html += `<tr>`;
        html += `<td class="inst-col" title="${titleText}">${labelText}</td>`;

        for (let c = 1; c <= totalCycles; c++) {
          const stage = row.stagesByCycle ? row.stagesByCycle[c] : null;
          if (stage) {
            let cellClass = `cell-${stage}`;
            let displayLabel = stage;
            let cellTitle = stage;

            if (stage === 'STALL') {
              displayLabel = 'STALL';
              cellClass = 'cell-STALL';
              cellTitle = 'Pipeline Stall Bubble (Data/Structural Hazard)';
            } else if (stage === 'FLUSH') {
              displayLabel = 'FLUSH';
              cellClass = 'cell-FLUSH';
              cellTitle = 'Speculative Fetch Flushed (Branch/Jump Penalty)';
            }

            html += `<td><span class="stage-cell ${cellClass}" title="${cellTitle}">${displayLabel}</span></td>`;
          } else {
            html += `<td>-</td>`;
          }
        }
        html += `</tr>`;
      }

      html += `</tbody></table>`;
      this.tableContainer.innerHTML = html;

      // Auto-scroll table to rightmost column
      this.tableContainer.scrollLeft = this.tableContainer.scrollWidth;
    }
  }

  exports.PipelineRenderer = PipelineRenderer;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.PipelineRendererModule = {}));
