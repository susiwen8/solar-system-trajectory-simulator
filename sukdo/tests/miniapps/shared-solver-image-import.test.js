import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { recognizeSudokuFromImage } = require('../../miniapps/shared/solver-image-import.js');

const DIGIT_BITMAPS = {
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100']
};

function createRgbaImage(width, height, fill = 255) {
  return new Uint8ClampedArray(Array.from({ length: width * height * 4 }, (_, index) => {
    const channel = index % 4;
    return channel === 3 ? 255 : fill;
  }));
}

function setPixel(data, width, x, y, value) {
  const offset = (y * width + x) * 4;
  data[offset] = value;
  data[offset + 1] = value;
  data[offset + 2] = value;
  data[offset + 3] = 255;
}

function fillRect(data, width, x, y, rectWidth, rectHeight, value) {
  for (let row = y; row < y + rectHeight; row += 1) {
    for (let col = x; col < x + rectWidth; col += 1) {
      setPixel(data, width, col, row, value);
    }
  }
}

function drawDigit(data, imageWidth, x, y, cellSize, digit) {
  const bitmap = DIGIT_BITMAPS[digit];

  if (!bitmap) {
    return;
  }

  const pixelWidth = Math.floor(cellSize * 0.5 / 5);
  const pixelHeight = Math.floor(cellSize * 0.65 / 7);
  const offsetX = x + Math.floor((cellSize - pixelWidth * 5) / 2);
  const offsetY = y + Math.floor((cellSize - pixelHeight * 7) / 2);

  for (let row = 0; row < bitmap.length; row += 1) {
    for (let col = 0; col < bitmap[row].length; col += 1) {
      if (bitmap[row][col] !== '1') {
        continue;
      }

      fillRect(
        data,
        imageWidth,
        offsetX + col * pixelWidth,
        offsetY + row * pixelHeight,
        pixelWidth,
        pixelHeight,
        0
      );
    }
  }
}

function createSudokuImage(board) {
  const cellSize = 24;
  const margin = 18;
  const boardSize = cellSize * 9;
  const width = boardSize + margin * 2;
  const height = boardSize + margin * 2;
  const data = createRgbaImage(width, height, 255);

  for (let line = 0; line <= 9; line += 1) {
    const thickness = line % 3 === 0 ? 3 : 1;
    const x = margin + line * cellSize - Math.floor(thickness / 2);
    const y = margin + line * cellSize - Math.floor(thickness / 2);

    fillRect(data, width, margin, y, boardSize, thickness, 0);
    fillRect(data, width, x, margin, thickness, boardSize, 0);
  }

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const digit = board[row][col];

      if (digit === 0) {
        continue;
      }

      drawDigit(data, width, margin + col * cellSize, margin + row * cellSize, cellSize, digit);
    }
  }

  return { width, height, data };
}

test('recognizeSudokuFromImage restores a clean sudoku board from an uploaded image', () => {
  const board = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9]
  ];

  const image = createSudokuImage(board);
  const recognized = recognizeSudokuFromImage(image);

  assert.deepEqual(recognized, board);
});

test('recognizeSudokuFromImage rejects images without a detectable sudoku grid', () => {
  const blank = {
    width: 80,
    height: 80,
    data: createRgbaImage(80, 80, 255)
  };

  assert.throws(() => recognizeSudokuFromImage(blank), /数独|识别/);
});
