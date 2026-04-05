import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'miniapps', 'shared');
const runtimeTargets = [
  path.join(projectRoot, 'miniapps', 'wechat', 'shared'),
  path.join(projectRoot, 'miniapps', 'alipay', 'shared')
];

const sharedRuntimeFiles = [
  'constants.js',
  'game-controller.js',
  'game-state.js',
  'game-view.js',
  'new-game-flow.js',
  'solver-controller.js',
  'solver-image-import.js',
  'solver-view.js',
  'storage.js',
  'sudoku.js'
];

for (const targetDir of runtimeTargets) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of sharedRuntimeFiles) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
  }
}
