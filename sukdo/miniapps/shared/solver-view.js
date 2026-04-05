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

function getGuideStepDescription(step) {
  const label = getStepLabel(step);
  const candidateText = formatCandidateList(step.candidates);

  switch (step.type) {
    case 'single':
      return candidateText
        ? `${label} 当前候选只剩 ${candidateText}，所以可以确定填入 ${step.value}。`
        : `${label} 当前只剩一个合法数字，所以可以确定填入 ${step.value}。`;
    case 'guess':
      return candidateText
        ? `${label} 暂时还不能直接唯一确定，需要先在 ${candidateText} 里试填 ${step.value}，再继续验证整盘是否自洽。`
        : `${label} 暂时还不能直接唯一确定，所以先试填 ${step.value}，再继续验证整盘是否自洽。`;
    case 'backtrack':
      return `${label} 之前的试填 ${step.value} 没能走通，这一步把它撤回，回到上一个分支重新判断。`;
    default:
      return `${label} 填入 ${step.value}。`;
  }
}

function applyGuideStep(board, step) {
  if (step.type === 'backtrack') {
    board[step.row][step.col] = 0;
    return;
  }

  board[step.row][step.col] = step.value;
}

function buildGuideTimeline(board, steps) {
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
      description: getGuideStepDescription(step),
      board: workingBoard.map((row) => [...row])
    };
  });
}

function clampGuideStepIndex(index, timelineLength) {
  if (!timelineLength) {
    return -1;
  }

  return Math.min(Math.max(index, 0), timelineLength - 1);
}

function buildSolverCells(board, conflicts = [], selectedCell = null, solvedBoard = null, guideStep = null) {
  const conflictIndex = createConflictIndex(conflicts);
  const cells = [];
  const displayBoard = solvedBoard ?? board;

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const originalValue = board[row][col];
      const value = displayBoard[row][col];
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

function getSolverMessage(result) {
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
      return `已找到唯一解，共记录 ${result.steps.length} 步。可以从头跟着看每一步。`;
    default:
      return '输入一个题目后，就可以直接求解。';
  }
}

function formatSolverStep(step, index) {
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

function buildSolverPageData(state) {
  const message = state.parseError
    ? state.parseError
    : !state.validation.valid
      ? getSolverMessage({ status: 'invalid' })
      : getSolverMessage(state.analysis);
  const solved = state.analysis?.status === 'solved';
  const guideTimeline = solved ? buildGuideTimeline(state.board, state.analysis.steps) : [];
  const guideAvailable = guideTimeline.length > 0;
  const guideStepIndex = guideAvailable
    ? clampGuideStepIndex(state.guideStepIndex, guideTimeline.length)
    : -1;
  const activeGuideStep = guideStepIndex >= 0 ? guideTimeline[guideStepIndex] : null;
  const visibleBoard =
    solved && activeGuideStep
      ? activeGuideStep.board
      : solved
        ? state.analysis.solution
        : null;

  return {
    cells: buildSolverCells(
      state.board,
      state.validation.conflicts,
      state.selectedCell,
      visibleBoard,
      activeGuideStep
    ),
    inputText: state.inputText,
    message,
    resultSolved: solved,
    guideAvailable,
    guideStepIndex,
    guideStepTitle: activeGuideStep?.title ?? '',
    guideStepDescription: activeGuideStep?.description ?? '',
    guideScrollTargetId: activeGuideStep?.key ?? '',
    guideProgressText: activeGuideStep ? `${guideStepIndex + 1} / ${guideTimeline.length}` : '',
    guideCanGoPrev: activeGuideStep ? guideStepIndex > 0 : false,
    guideCanGoNext: activeGuideStep ? guideStepIndex < guideTimeline.length - 1 : false,
    steps: guideTimeline.map((step, index) => ({
      key: step.key,
      index,
      text: step.text,
      title: step.title,
      active: guideStepIndex === index,
      done: guideStepIndex > index,
      type: step.type
    })),
    stepCountText: solved ? String(state.analysis.steps.length) : '0'
  };
}

module.exports = {
  buildSolverCells,
  buildSolverPageData,
  formatSolverStep,
  getGuideStepDescription,
  getGuideStepTitle,
  getSolverMessage
};
