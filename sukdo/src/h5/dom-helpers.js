function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function joinClasses(values) {
  return values.filter(Boolean).join(' ');
}

function renderNotes(notes) {
  return `
    <div class="notes-grid">
      ${notes
        .map(
          (note) => `<span class="note">${escapeHtml(note.label)}</span>`
        )
        .join('')}
    </div>
  `;
}

export function renderGameBoard(cells) {
  return cells
    .map((cell) => {
      const classes = joinClasses([
        'cell',
        cell.fixed && 'fixed',
        cell.playerEntry && 'player-entry',
        cell.prefillEntry && 'prefill-entry',
        cell.selected && 'selected',
        cell.related && 'related',
        cell.sameValue && 'same-value',
        cell.traceOrigin && 'trace-origin',
        cell.completed && 'completed',
        cell.boxRight && 'box-right',
        cell.boxBottom && 'box-bottom'
      ]);
      const content = cell.displayValue
        ? `<div class="cell-content">${escapeHtml(cell.displayValue)}</div>`
        : renderNotes(cell.notes);

      return `
        <button
          type="button"
          class="${classes}"
          data-row="${cell.row}"
          data-col="${cell.col}"
          aria-label="第 ${cell.row + 1} 行第 ${cell.col + 1} 列"
        >${content}</button>
      `;
    })
    .join('');
}

export function renderDifficultyButtons(options) {
  return `
    <div class="difficulty-row">
      ${options
        .map(
          (option) => `
            <button
              type="button"
              data-difficulty="${escapeHtml(option.value)}"
              class="${joinClasses(['difficulty-pill', option.active && 'active'])}"
            >${escapeHtml(option.label)}</button>
          `
        )
        .join('')}
    </div>
  `;
}

export function renderDigitKeypad(digits, options = {}) {
  const extraButtons = options.extraButtons ?? [];
  const subtle = options.subtle ?? false;
  const extraClass = subtle ? 'subtle' : '';
  const activeDigit = options.activeDigit ?? null;

  return `
    <div class="${escapeHtml(options.className ?? 'keypad')}">
      ${digits
        .map(
          (digit) => `
            <button
              type="button"
              data-digit="${digit}"
              class="${joinClasses([
                'keypad-button',
                'control-chip',
                extraClass,
                activeDigit === digit && 'active'
              ])}"
            >${digit}</button>
          `
        )
        .join('')}
      ${extraButtons
        .map(
          (button) => `
            <button
              type="button"
              data-action="${escapeHtml(button.action)}"
              class="${joinClasses(['keypad-button', 'control-chip', button.className])}"
            >${escapeHtml(button.label)}</button>
          `
        )
        .join('')}
    </div>
  `;
}

export function renderGameActionGrid(data) {
  const actions = [
    { action: 'notes', label: '笔记', className: data.notesMode ? 'primary' : '' },
    { action: 'prefill', label: '试填', className: data.prefillMode ? 'primary' : '' },
    { action: 'locate-prefill', label: '纠错', className: '' },
    { action: 'hint', label: '提示', className: '' },
    { action: 'clear', label: '清空', className: '' },
    { action: 'reset', label: '重置', className: '' },
    { action: 'refresh', label: '换一局', className: 'accent' },
    { action: 'solver', label: '解题', className: '' }
  ];

  return `
    <div class="action-grid">
      ${actions
        .map(
          (action) => `
            <button
              type="button"
              data-action="${action.action}"
              class="${joinClasses(['action-button', 'control-chip', action.className])}"
            >${action.label}</button>
          `
        )
        .join('')}
    </div>
  `;
}

export function renderGameControls(data) {
  return [
    renderDifficultyButtons(data.difficultyOptions),
    renderDigitKeypad(data.keypadDigits, { subtle: true, activeDigit: data.activeDigit }),
    renderGameActionGrid(data)
  ].join('');
}

export function renderNewGameDialog(data) {
  if (!data?.newGameDialogVisible) {
    return '';
  }

  return `
    <div class="new-game-dialog-mask">
      <div class="new-game-dialog-card">
        <div class="new-game-dialog-title">${escapeHtml(data.newGameDialogTitle)}</div>
        <div class="new-game-dialog-content">${escapeHtml(data.newGameDialogContent)}</div>
        <button
          type="button"
          data-dialog-action="toggle-confirm"
          class="${joinClasses([
            'new-game-confirm-check',
            data.newGameDialogAcknowledged && 'checked'
          ])}"
        >
          <span class="new-game-confirm-indicator">${data.newGameDialogAcknowledged ? '✓' : ''}</span>
          <span class="new-game-confirm-label">${escapeHtml(
            data.newGameDialogSecondaryConfirmText
          )}</span>
        </button>
        <div class="new-game-dialog-actions">
          <button type="button" data-dialog-action="cancel" class="new-game-dialog-button secondary">
            ${escapeHtml(data.newGameDialogCancelText)}
          </button>
          <button
            type="button"
            data-dialog-action="confirm"
            class="${joinClasses([
              'new-game-dialog-button',
              'accent',
              !data.newGameDialogConfirmEnabled && 'disabled'
            ])}"
          >
            ${escapeHtml(data.newGameDialogConfirmText)}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderSolverBoard(cells) {
  return cells
    .map((cell) => {
      const classes = joinClasses([
        'cell',
        cell.fixed && 'fixed',
        cell.playerEntry && 'player-entry',
        cell.conflict && 'conflict',
        cell.selected && 'selected',
        cell.guideFocus && 'guide-focus',
        cell.boxRight && 'box-right',
        cell.boxBottom && 'box-bottom'
      ]);

      return `
        <button
          type="button"
          class="${classes}"
          data-row="${cell.row}"
          data-col="${cell.col}"
          aria-label="第 ${cell.row + 1} 行第 ${cell.col + 1} 列"
        ><div class="cell-content">${escapeHtml(cell.displayValue)}</div></button>
      `;
    })
    .join('');
}

export function renderSolverSteps(data) {
  if (!data.steps.length) {
    return '<li class="solver-step empty">求解后会在这里列出关键步骤。</li>';
  }

  return data.steps
    .map(
      (step) => `
        <li
          id="${escapeHtml(step.key)}"
          class="${joinClasses(['solver-step', step.active && 'active', step.done && 'done'])}"
          data-step-index="${step.index}"
        >${escapeHtml(step.text)}</li>
      `
    )
    .join('');
}

export function renderGuideControls(data) {
  const controls = [
    { id: 'h5-guide-start', label: '从头引导', disabled: !data.guideAvailable },
    { id: 'h5-guide-prev', label: '上一步', disabled: !data.guideCanGoPrev },
    { id: 'h5-guide-next', label: '下一步', disabled: !data.guideCanGoNext },
    { id: 'h5-guide-solution', label: '最终答案', disabled: !data.guideAvailable }
  ];

  return controls
    .map(
      (control) => `
        <button
          type="button"
          id="${control.id}"
          class="${joinClasses(['action-button', 'control-chip', control.disabled && 'disabled'])}"
          ${control.disabled ? 'disabled' : ''}
        >${control.label}</button>
      `
    )
    .join('');
}

export function renderStatusMessage(text) {
  return escapeHtml(text);
}

export { escapeHtml };
