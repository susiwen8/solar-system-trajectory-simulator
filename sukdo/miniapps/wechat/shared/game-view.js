const { serializeBoard } = require('./sudoku.js');

const DIFFICULTY_LABELS = {
  easy: '简单',
  medium: '中等',
  hard: '困难'
};

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function buildNotesCells(notes) {
  const cells = [];

  for (let value = 1; value <= 9; value += 1) {
    cells.push({
      value,
      label: notes.includes(value) ? String(value) : ''
    });
  }

  return cells;
}

function isPeerCell(first, second) {
  if (!first || !second) {
    return false;
  }

  if (first.row === second.row || first.col === second.col) {
    return true;
  }

  return (
    Math.floor(first.row / 3) === Math.floor(second.row / 3) &&
    Math.floor(first.col / 3) === Math.floor(second.col / 3)
  );
}

function getMessage(state) {
  if (state.completed) {
    return `完成啦，用时 ${formatTime(state.elapsedSeconds)}。点上方难度按钮可以立刻开下一局。`;
  }

  if (state.traceCell) {
    return '已经定位到当前试填链路里最早出错的空位，你可以从这里回退或改写。';
  }

  if (state.prefillMode) {
    return '试填模式开启中：输入会作为暂时填写保留，旧笔记不会丢失，可用“定位试错”回到最早错误点。';
  }

  if (state.notesMode) {
    return '笔记模式开启中，再点一次按钮即可关闭。';
  }

  const selectedFixed = state.puzzle[state.selectedCell.row][state.selectedCell.col] !== 0;

  if (selectedFixed) {
    return '这是题目自带的数字，不能修改。请选择一个空格继续。';
  }

  return '点击格子后再点数字盘即可填数，也可以切换笔记、试填、提示等操作。';
}

function buildGamePageData(state, bestTimes) {
  const activeDigit =
    Number.isInteger(state.activeDigit) && state.activeDigit >= 1 && state.activeDigit <= 9
      ? state.activeDigit
      : state.board[state.selectedCell.row][state.selectedCell.col];
  const cells = [];

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const value = state.board[row][col];
      const notes = state.notes[row][col];
      const fixed = state.puzzle[row][col] !== 0;
      const playerEntry = value !== 0 && !fixed;
      const prefillEntry = state.prefills[row][col] > 0;
      const selected = state.selectedCell.row === row && state.selectedCell.col === col;
      const related = !selected && isPeerCell(state.selectedCell, { row, col });
      const sameValue = activeDigit !== 0 && activeDigit !== null && !selected && value === activeDigit;
      const traceOrigin = state.traceCell?.row === row && state.traceCell?.col === col;

      cells.push({
        key: `${row}-${col}`,
        row,
        col,
        value,
        displayValue: value === 0 ? '' : String(value),
        notes: buildNotesCells(notes),
        fixed,
        playerEntry,
        prefillEntry,
        selected,
        related,
        sameValue,
        traceOrigin,
        completed: state.completed,
        boxRight: (col + 1) % 3 === 0 && col !== 8,
        boxBottom: (row + 1) % 3 === 0 && row !== 8
      });
    }
  }

  return {
    cells,
    keypadDigits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    activeDigit: activeDigit || null,
    timerText: formatTime(state.elapsedSeconds),
    bestTimeText:
      bestTimes[state.difficulty] === null ? '--:--' : formatTime(bestTimes[state.difficulty]),
    hintCountText: String(state.hintsUsed),
    difficultyLabel: DIFFICULTY_LABELS[state.difficulty],
    statusPillText: state.completed
      ? '本局完成'
      : state.prefillMode
        ? '试填模式'
        : state.notesMode
          ? '笔记模式'
          : '继续挑战',
    statusPillCompleted: state.completed,
    message: getMessage(state),
    notesMode: state.notesMode,
    prefillMode: state.prefillMode,
    solverPuzzle: serializeBoard(state.puzzle),
    difficultyOptions: [
      { value: 'easy', label: '简单', active: state.difficulty === 'easy' },
      { value: 'medium', label: '中等', active: state.difficulty === 'medium' },
      { value: 'hard', label: '困难', active: state.difficulty === 'hard' }
    ]
  };
}

module.exports = {
  buildGamePageData,
  formatTime
};
