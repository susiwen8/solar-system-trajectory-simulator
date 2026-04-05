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

const NORMALIZED_COLS = 5;
const NORMALIZED_ROWS = 7;
const MAX_IMAGE_EDGE = 720;

function assertImageShape(image) {
  const validShape =
    image &&
    Number.isInteger(image.width) &&
    Number.isInteger(image.height) &&
    image.width > 0 &&
    image.height > 0 &&
    image.data &&
    typeof image.data.length === 'number' &&
    image.data.length >= image.width * image.height * 4;

  if (!validShape) {
    throw new Error('图片数据无效，无法识别数独。');
  }
}

function resizeRgbaImage(image) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));

  if (scale === 1) {
    return image;
  }

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor(x / scale));
      const sourceY = Math.min(image.height - 1, Math.floor(y / scale));
      const sourceOffset = (sourceY * image.width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;

      data[targetOffset] = image.data[sourceOffset];
      data[targetOffset + 1] = image.data[sourceOffset + 1];
      data[targetOffset + 2] = image.data[sourceOffset + 2];
      data[targetOffset + 3] = image.data[sourceOffset + 3];
    }
  }

  return { width, height, data };
}

function buildGrayscale(image) {
  const grayscale = new Uint8ClampedArray(image.width * image.height);

  for (let index = 0; index < grayscale.length; index += 1) {
    const offset = index * 4;
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    grayscale[index] = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
  }

  return grayscale;
}

function computeOtsuThreshold(grayscale) {
  const histogram = new Uint32Array(256);

  for (const value of grayscale) {
    histogram[value] += 1;
  }

  const total = grayscale.length;
  let totalWeight = 0;

  for (let value = 0; value < histogram.length; value += 1) {
    totalWeight += value * histogram[value];
  }

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestThreshold = 127;
  let bestVariance = -1;

  for (let threshold = 0; threshold < histogram.length; threshold += 1) {
    backgroundWeight += histogram[threshold];

    if (backgroundWeight === 0) {
      continue;
    }

    const foregroundWeight = total - backgroundWeight;

    if (foregroundWeight === 0) {
      break;
    }

    backgroundSum += threshold * histogram[threshold];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (totalWeight - backgroundSum) / foregroundWeight;
    const betweenVariance =
      backgroundWeight *
      foregroundWeight *
      (backgroundMean - foregroundMean) *
      (backgroundMean - foregroundMean);

    if (betweenVariance > bestVariance) {
      bestVariance = betweenVariance;
      bestThreshold = threshold;
    }
  }

  return Math.max(40, Math.min(bestThreshold + 10, 220));
}

function buildBinaryMask(grayscale, threshold) {
  const binary = new Uint8Array(grayscale.length);

  for (let index = 0; index < grayscale.length; index += 1) {
    binary[index] = grayscale[index] <= threshold ? 1 : 0;
  }

  return binary;
}

function findLargestDarkComponent(binary, width, height) {
  const visited = new Uint8Array(binary.length);
  let bestBounds = null;
  let bestCount = 0;

  for (let index = 0; index < binary.length; index += 1) {
    if (!binary[index] || visited[index]) {
      continue;
    }

    const queue = [index];
    let head = 0;
    visited[index] = 1;
    let count = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (head < queue.length) {
      const current = queue[head];
      head += 1;
      count += 1;

      const x = current % width;
      const y = Math.floor(current / width);

      if (x < minX) {
        minX = x;
      }

      if (x > maxX) {
        maxX = x;
      }

      if (y < minY) {
        minY = y;
      }

      if (y > maxY) {
        maxY = y;
      }

      if (x > 0) {
        const left = current - 1;

        if (binary[left] && !visited[left]) {
          visited[left] = 1;
          queue.push(left);
        }
      }

      if (x < width - 1) {
        const right = current + 1;

        if (binary[right] && !visited[right]) {
          visited[right] = 1;
          queue.push(right);
        }
      }

      if (y > 0) {
        const up = current - width;

        if (binary[up] && !visited[up]) {
          visited[up] = 1;
          queue.push(up);
        }
      }

      if (y < height - 1) {
        const down = current + width;

        if (binary[down] && !visited[down]) {
          visited[down] = 1;
          queue.push(down);
        }
      }
    }

    if (count > bestCount) {
      bestCount = count;
      bestBounds = {
        minX,
        maxX,
        minY,
        maxY
      };
    }
  }

  if (!bestBounds || bestCount < Math.max(64, Math.floor(width * height * 0.01))) {
    throw new Error('没有识别到清晰的数独网格，请换一张正视、清楚的图片再试。');
  }

  return bestBounds;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function makeSquareBounds(bounds, width, height) {
  const componentWidth = bounds.maxX - bounds.minX + 1;
  const componentHeight = bounds.maxY - bounds.minY + 1;
  const side = Math.min(
    Math.max(componentWidth, componentHeight),
    Math.min(width, height)
  );
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  let minX = Math.round(centerX - side / 2);
  let minY = Math.round(centerY - side / 2);

  minX = clamp(minX, 0, width - side);
  minY = clamp(minY, 0, height - side);

  return {
    minX,
    minY,
    maxX: minX + side - 1,
    maxY: minY + side - 1,
    side
  };
}

function createEmptyBoard() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function countDarkPixels(binary, width, bounds) {
  let count = 0;

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      count += binary[y * width + x];
    }
  }

  return count;
}

function findDigitBounds(binary, width, bounds) {
  let minX = bounds.maxX;
  let maxX = bounds.minX;
  let minY = bounds.maxY;
  let maxY = bounds.minY;
  let found = false;

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (!binary[y * width + x]) {
        continue;
      }

      found = true;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (!found) {
    return null;
  }

  return {
    minX,
    maxX,
    minY,
    maxY
  };
}

function normalizeDigitBitmap(binary, width, bounds) {
  const bitmap = [];
  const digitWidth = bounds.maxX - bounds.minX + 1;
  const digitHeight = bounds.maxY - bounds.minY + 1;

  for (let row = 0; row < NORMALIZED_ROWS; row += 1) {
    let rowBits = '';
    const startY = bounds.minY + Math.floor((row * digitHeight) / NORMALIZED_ROWS);
    const endY = bounds.minY + Math.floor(((row + 1) * digitHeight) / NORMALIZED_ROWS) - 1;

    for (let col = 0; col < NORMALIZED_COLS; col += 1) {
      const startX = bounds.minX + Math.floor((col * digitWidth) / NORMALIZED_COLS);
      const endX = bounds.minX + Math.floor(((col + 1) * digitWidth) / NORMALIZED_COLS) - 1;
      let darkCount = 0;
      let total = 0;

      for (let y = startY; y <= Math.max(startY, endY); y += 1) {
        for (let x = startX; x <= Math.max(startX, endX); x += 1) {
          total += 1;
          darkCount += binary[y * width + x];
        }
      }

      rowBits += darkCount / Math.max(total, 1) >= 0.3 ? '1' : '0';
    }

    bitmap.push(rowBits);
  }

  return bitmap;
}

function scoreDigitBitmap(bitmap, digit) {
  const template = DIGIT_BITMAPS[digit];
  let sameBits = 0;
  let overlap = 0;
  let union = 0;
  let filledPixels = 0;

  for (let row = 0; row < NORMALIZED_ROWS; row += 1) {
    for (let col = 0; col < NORMALIZED_COLS; col += 1) {
      const predicted = bitmap[row][col];
      const expected = template[row][col];

      if (predicted === expected) {
        sameBits += 1;
      }

      if (predicted === '1') {
        filledPixels += 1;
      }

      if (predicted === '1' || expected === '1') {
        union += 1;
      }

      if (predicted === '1' && expected === '1') {
        overlap += 1;
      }
    }
  }

  const similarity = sameBits / (NORMALIZED_COLS * NORMALIZED_ROWS);
  const iou = overlap / Math.max(union, 1);
  const densityPenalty = Math.abs(
    filledPixels -
      template.join('').split('').filter((value) => value === '1').length
  );

  return similarity * 0.6 + iou * 0.4 - densityPenalty * 0.01;
}

function recognizeDigit(binary, width, bounds) {
  const bitmap = normalizeDigitBitmap(binary, width, bounds);
  let bestDigit = 0;
  let bestScore = -Infinity;
  let secondScore = -Infinity;

  for (let digit = 1; digit <= 9; digit += 1) {
    const score = scoreDigitBitmap(bitmap, digit);

    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestDigit = digit;
      continue;
    }

    if (score > secondScore) {
      secondScore = score;
    }
  }

  if (bestScore < 0.42 || bestScore - secondScore < 0.04) {
    throw new Error('图片中的数字不够清晰，暂时无法稳定识别。');
  }

  return bestDigit;
}

function recognizeSudokuFromImage(image) {
  assertImageShape(image);

  const normalizedImage = resizeRgbaImage(image);
  const grayscale = buildGrayscale(normalizedImage);
  const threshold = computeOtsuThreshold(grayscale);
  const binary = buildBinaryMask(grayscale, threshold);
  const componentBounds = findLargestDarkComponent(binary, normalizedImage.width, normalizedImage.height);
  const boardBounds = makeSquareBounds(componentBounds, normalizedImage.width, normalizedImage.height);
  const board = createEmptyBoard();
  const cellSize = boardBounds.side / 9;

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const cellMinX = Math.floor(boardBounds.minX + col * cellSize);
      const cellMaxX = Math.ceil(boardBounds.minX + (col + 1) * cellSize) - 1;
      const cellMinY = Math.floor(boardBounds.minY + row * cellSize);
      const cellMaxY = Math.ceil(boardBounds.minY + (row + 1) * cellSize) - 1;
      const trimX = Math.max(1, Math.floor((cellMaxX - cellMinX + 1) * 0.2));
      const trimY = Math.max(1, Math.floor((cellMaxY - cellMinY + 1) * 0.2));
      const innerBounds = {
        minX: cellMinX + trimX,
        maxX: cellMaxX - trimX,
        minY: cellMinY + trimY,
        maxY: cellMaxY - trimY
      };
      const darkPixels = countDarkPixels(binary, normalizedImage.width, innerBounds);
      const area =
        (innerBounds.maxX - innerBounds.minX + 1) *
        (innerBounds.maxY - innerBounds.minY + 1);

      if (darkPixels / Math.max(area, 1) < 0.025) {
        board[row][col] = 0;
        continue;
      }

      const digitBounds = findDigitBounds(binary, normalizedImage.width, innerBounds);

      if (!digitBounds) {
        board[row][col] = 0;
        continue;
      }

      board[row][col] = recognizeDigit(binary, normalizedImage.width, digitBounds);
    }
  }

  const clueCount = board.flat().filter(Boolean).length;

  if (clueCount < 17) {
    throw new Error('没有识别到有效的数独盘面，请换一张更清晰的图片再试。');
  }

  return board;
}

module.exports = {
  recognizeSudokuFromImage
};
