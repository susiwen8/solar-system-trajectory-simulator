function createConflictIndex(conflicts) {
  const index = new Map();

  for (const conflict of conflicts) {
    index.set(`${conflict.row}:${conflict.col}`, [...conflict.reasons].sort());
  }

  return index;
}

function getStepLabel(step) {
  return `第 ${step.row + 1} 行第 ${step.col + 1} 列`;
}

function formatCandidateList(candidates) {
  return Array.isArray(candidates) && candidates.length ? candidates.join(' / ') : '';
}

function getGuideStepTitle(step, index) {
  const order = `第 ${index + 1} 步`;

  switch (step.type) {
    case 'single':
      return `${order} · 唯一候选`;
    case 'guess':
      return `${order} · 试填验证`;
    case 'backtrack':
      return `${order} · 回退修正`;
    default:
      return `${order} · 推进一格`;
  }
}

function applyGuideStep(board, step) {
  if (step.type === 'backtrack') {
    board[step.row][step.col] = 0;
    return;
  }

  board[step.row][step.col] = step.value;
}

export function buildSolverCells(board, conflicts = []) {
  const conflictIndex = createConflictIndex(conflicts);
  const cells = [];

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const value = board[row][col];
      const reasons = conflictIndex.get(`${row}:${col}`) ?? [];

      cells.push({
        row,
        col,
        value,
        empty: value === 0,
        conflict: reasons.length > 0,
        reasons
      });
    }
  }

  return cells;
}

export function buildSolverBoardCells(
  board,
  {
    conflicts = [],
    selectedCell = null,
    displayBoard = null,
    guideStep = null
  } = {}
) {
  const conflictIndex = createConflictIndex(conflicts);
  const cells = [];
  const visibleBoard = displayBoard ?? board;

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const originalValue = board[row][col];
      const value = visibleBoard[row][col];
      const reasons = conflictIndex.get(`${row}:${col}`) ?? [];

      cells.push({
        key: `${row}-${col}`,
        row,
        col,
        value,
        displayValue: value === 0 ? '' : String(value),
        empty: value === 0,
        fixed: originalValue !== 0,
        playerEntry: originalValue === 0 && value !== 0,
        conflict: reasons.length > 0,
        reasons,
        selected: selectedCell?.row === row && selectedCell?.col === col,
        guideFocus: guideStep?.row === row && guideStep?.col === col,
        boxRight: (col + 1) % 3 === 0 && col !== 8,
        boxBottom: (row + 1) % 3 === 0 && row !== 8
      });
    }
  }

  return cells;
}

export function buildGuideTimeline(board, steps) {
  const workingBoard = board.map((row) => [...row]);

  return steps.map((step, index) => {
    applyGuideStep(workingBoard, step);

    return {
      key: `guide-step-${index}`,
      index,
      row: step.row,
      col: step.col,
      value: step.value,
      type: step.type,
      text: formatSolverStep(step, index),
      title: getGuideStepTitle(step, index),
      candidateText: formatCandidateList(step.candidates),
      board: workingBoard.map((row) => [...row])
    };
  });
}

export function buildSolverStepItems(timeline, activeIndex) {
  return timeline.map((step, index) => ({
    key: step.key,
    index,
    text: step.text,
    title: step.title,
    active: activeIndex === index,
    done: activeIndex > index,
    type: step.type
  }));
}

export function getSolverMessage(result) {
  if (!result) {
    return '输入一个题目后，就可以直接求解。';
  }

  switch (result.status) {
    case 'invalid':
      return '当前题目有冲突，请先修正高亮格子。';
    case 'unsolvable':
      return '这个题目当前无解，无法补出完整答案。';
    case 'multiple-solutions':
      return '这个题目存在多个解，不能给出唯一答案。';
    case 'solved':
      return `已找到唯一解，共记录 ${result.steps.length} 步。可以点击步骤回看每一步。`;
    default:
      return '输入一个题目后，就可以直接求解。';
  }
}

export function formatSolverStep(step, index) {
  const label = `第 ${step.row + 1} 行第 ${step.col + 1} 列`;
  const order = `${index + 1}. `;

  switch (step.type) {
    case 'single':
      return `${order}${label}只能填 ${step.value}。`;
    case 'guess':
      return `${order}尝试在${label}填入 ${step.value}。`;
    case 'backtrack':
      return `${order}${label}填入 ${step.value} 后走不通，回退。`;
    default:
      return `${order}${label}填入 ${step.value}。`;
  }
}
