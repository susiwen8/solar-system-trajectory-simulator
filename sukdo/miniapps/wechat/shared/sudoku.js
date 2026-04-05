const { BOARD_SIZE, BOX_SIZE, DIGITS, DIFFICULTY_GIVENS } = require('./constants.js');

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function assertBoardShape(board) {
  const validShape =
    Array.isArray(board) &&
    board.length === BOARD_SIZE &&
    board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === BOARD_SIZE &&
        row.every((value) => Number.isInteger(value) && value >= 0 && value <= 9)
    );

  if (!validShape) {
    throw new Error('Sudoku board must be a 9x9 grid of integers between 0 and 9');
  }
}

function addConflictReason(conflictMap, row, col, reason) {
  const key = `${row}:${col}`;
  const existing = conflictMap.get(key) ?? {
    row,
    col,
    reasons: []
  };

  if (!existing.reasons.includes(reason)) {
    existing.reasons.push(reason);
    existing.reasons.sort();
  }

  conflictMap.set(key, existing);
}

function collectDuplicateConflicts(cells, reason, conflictMap) {
  const cellsByValue = new Map();

  for (const cell of cells) {
    if (cell.value === 0) {
      continue;
    }

    const matches = cellsByValue.get(cell.value) ?? [];
    matches.push(cell);
    cellsByValue.set(cell.value, matches);
  }

  for (const matches of cellsByValue.values()) {
    if (matches.length < 2) {
      continue;
    }

    for (const { row, col } of matches) {
      addConflictReason(conflictMap, row, col, reason);
    }
  }
}

function shuffle(values) {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function isValidPlacement(board, row, col, value) {
  if (value < 1 || value > 9) {
    return false;
  }

  for (let index = 0; index < BOARD_SIZE; index += 1) {
    if (index !== col && board[row][index] === value) {
      return false;
    }

    if (index !== row && board[index][col] === value) {
      return false;
    }
  }

  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;

  for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
    for (let colOffset = 0; colOffset < BOX_SIZE; colOffset += 1) {
      const targetRow = boxRow + rowOffset;
      const targetCol = boxCol + colOffset;

      if (targetRow === row && targetCol === col) {
        continue;
      }

      if (board[targetRow][targetCol] === value) {
        return false;
      }
    }
  }

  return true;
}

function serializeBoard(board) {
  assertBoardShape(board);
  return board.flat().map((value) => (value === 0 ? '.' : String(value))).join('');
}

function parseBoardInput(text) {
  if (typeof text !== 'string') {
    throw new Error('Sudoku input must be a string');
  }

  const values = [];

  for (const char of text) {
    if (char >= '1' && char <= '9') {
      values.push(Number(char));
      continue;
    }

    if (char === '0' || char === '.') {
      values.push(0);
      continue;
    }

    if (/\s/.test(char) || /[|,+-]/.test(char)) {
      continue;
    }

    throw new Error(`Invalid character "${char}" in Sudoku input`);
  }

  if (values.length !== BOARD_SIZE * BOARD_SIZE) {
    throw new Error('Sudoku input must describe exactly 81 cells');
  }

  const board = createEmptyBoard();

  for (let index = 0; index < values.length; index += 1) {
    board[Math.floor(index / BOARD_SIZE)][index % BOARD_SIZE] = values[index];
  }

  return board;
}

function validateBoard(board) {
  assertBoardShape(board);

  const conflictMap = new Map();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    collectDuplicateConflicts(
      board[row].map((value, col) => ({ row, col, value })),
      'row',
      conflictMap
    );
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    collectDuplicateConflicts(
      board.map((row, rowIndex) => ({
        row: rowIndex,
        col,
        value: row[col]
      })),
      'column',
      conflictMap
    );
  }

  for (let boxRow = 0; boxRow < BOARD_SIZE; boxRow += BOX_SIZE) {
    for (let boxCol = 0; boxCol < BOARD_SIZE; boxCol += BOX_SIZE) {
      const cells = [];

      for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
        for (let colOffset = 0; colOffset < BOX_SIZE; colOffset += 1) {
          const row = boxRow + rowOffset;
          const col = boxCol + colOffset;
          cells.push({ row, col, value: board[row][col] });
        }
      }

      collectDuplicateConflicts(cells, 'box', conflictMap);
    }
  }

  return {
    valid: conflictMap.size === 0,
    conflicts: [...conflictMap.values()]
  };
}

function getCandidates(board, row, col) {
  if (board[row][col] !== 0) {
    return [];
  }

  return DIGITS.filter((value) => isValidPlacement(board, row, col, value));
}

function findBestEmptyCell(board) {
  let bestCell = null;
  let bestCandidates = null;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] !== 0) {
        continue;
      }

      const candidates = getCandidates(board, row, col);

      if (candidates.length === 0) {
        return {
          row,
          col,
          candidates
        };
      }

      if (!bestCandidates || candidates.length < bestCandidates.length) {
        bestCell = {
          row,
          col,
          candidates
        };
        bestCandidates = candidates;
      }
    }
  }

  return bestCell;
}

function solveMutable(board, randomize = false) {
  const cell = findBestEmptyCell(board);

  if (!cell) {
    return true;
  }

  if (cell.candidates.length === 0) {
    return false;
  }

  const candidates = randomize ? shuffle(cell.candidates) : cell.candidates;

  for (const value of candidates) {
    board[cell.row][cell.col] = value;

    if (solveMutable(board, randomize)) {
      return true;
    }

    board[cell.row][cell.col] = 0;
  }

  return false;
}

function countSolutionsMutable(board, limit, currentCount = 0) {
  if (currentCount >= limit) {
    return currentCount;
  }

  const cell = findBestEmptyCell(board);

  if (!cell) {
    return currentCount + 1;
  }

  if (cell.candidates.length === 0) {
    return currentCount;
  }

  let total = currentCount;

  for (const value of cell.candidates) {
    board[cell.row][cell.col] = value;
    total = countSolutionsMutable(board, limit, total);
    board[cell.row][cell.col] = 0;

    if (total >= limit) {
      return total;
    }
  }

  return total;
}

function applySingleCandidateSteps(board, steps) {
  while (true) {
    let forcedMove = null;

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (board[row][col] !== 0) {
          continue;
        }

        const candidates = getCandidates(board, row, col);

        if (candidates.length === 1) {
          forcedMove = {
            row,
            col,
            value: candidates[0],
            candidates
          };
          break;
        }
      }

      if (forcedMove) {
        break;
      }
    }

    if (!forcedMove) {
      return;
    }

    board[forcedMove.row][forcedMove.col] = forcedMove.value;
    steps.push({
      type: 'single',
      row: forcedMove.row,
      col: forcedMove.col,
      value: forcedMove.value,
      candidates: forcedMove.candidates
    });
  }
}

function solveMutableWithTrace(board, steps) {
  const cell = findBestEmptyCell(board);

  if (!cell) {
    return true;
  }

  if (cell.candidates.length === 0) {
    return false;
  }

  for (const value of cell.candidates) {
    board[cell.row][cell.col] = value;
    steps.push({
      type: 'guess',
      row: cell.row,
      col: cell.col,
      value,
      candidates: [...cell.candidates]
    });

    if (solveMutableWithTrace(board, steps)) {
      return true;
    }

    board[cell.row][cell.col] = 0;
    steps.push({
      type: 'backtrack',
      row: cell.row,
      col: cell.col,
      value
    });
  }

  return false;
}

function solveBoard(board) {
  const workingBoard = cloneBoard(board);

  if (!solveMutable(workingBoard)) {
    return null;
  }

  return workingBoard;
}

function countSolutions(board, limit = 2) {
  return countSolutionsMutable(cloneBoard(board), limit);
}

function analyzeBoard(board) {
  assertBoardShape(board);

  const validation = validateBoard(board);

  if (!validation.valid) {
    return {
      status: 'invalid',
      solution: null,
      steps: [],
      conflicts: validation.conflicts
    };
  }

  const solutionCount = countSolutions(board, 2);

  if (solutionCount === 0) {
    return {
      status: 'unsolvable',
      solution: null,
      steps: [],
      conflicts: []
    };
  }

  if (solutionCount > 1) {
    return {
      status: 'multiple-solutions',
      solution: null,
      steps: [],
      conflicts: []
    };
  }

  const workingBoard = cloneBoard(board);
  const steps = [];

  applySingleCandidateSteps(workingBoard, steps);

  if (findBestEmptyCell(workingBoard) && !solveMutableWithTrace(workingBoard, steps)) {
    return {
      status: 'unsolvable',
      solution: null,
      steps: [],
      conflicts: []
    };
  }

  return {
    status: 'solved',
    solution: workingBoard,
    steps,
    conflicts: []
  };
}

function createSolvedBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  solveMutable(board, true);
  return board;
}

function createCellOrder() {
  return shuffle(
    Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
      row: Math.floor(index / BOARD_SIZE),
      col: index % BOARD_SIZE
    }))
  );
}

function getTargetGivens(difficulty) {
  return DIFFICULTY_GIVENS[difficulty] ?? DIFFICULTY_GIVENS.medium;
}

function generatePuzzle(difficulty = 'medium') {
  const targetGivens = getTargetGivens(difficulty);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const solution = createSolvedBoard();
    const puzzle = cloneBoard(solution);
    let givens = BOARD_SIZE * BOARD_SIZE;

    for (const { row, col } of createCellOrder()) {
      if (givens <= targetGivens) {
        break;
      }

      const previousValue = puzzle[row][col];
      puzzle[row][col] = 0;

      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[row][col] = previousValue;
        continue;
      }

      givens -= 1;
    }

    if (givens === targetGivens) {
      return {
        difficulty,
        givens,
        puzzle,
        solution
      };
    }
  }

  throw new Error(`Unable to generate a unique ${difficulty} puzzle`);
}

module.exports = {
  analyzeBoard,
  cloneBoard,
  countSolutions,
  generatePuzzle,
  getCandidates,
  isValidPlacement,
  parseBoardInput,
  serializeBoard,
  solveBoard,
  validateBoard
};
