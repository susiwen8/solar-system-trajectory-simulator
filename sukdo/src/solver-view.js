function createConflictIndex(conflicts) {
  const index = new Map();

  for (const conflict of conflicts) {
    index.set(`${conflict.row}:${conflict.col}`, [...conflict.reasons].sort());
  }

  return index;
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
      return `已找到唯一解，共记录 ${result.steps.length} 步。`;
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
