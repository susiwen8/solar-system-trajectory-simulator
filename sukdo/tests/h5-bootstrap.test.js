import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBootstrapErrorMessage,
  queryRequiredElements
} from '../src/h5/page-bootstrap.js';

test('queryRequiredElements returns the selected DOM nodes when the page structure is complete', () => {
  const board = { id: 'board' };
  const message = { id: 'message' };

  global.document = {
    querySelector(selector) {
      return {
        '#board': board,
        '#message': message
      }[selector] ?? null;
    }
  };

  const elements = queryRequiredElements(
    {
      board: '#board',
      message: '#message'
    },
    { pageName: 'H5 解题页' }
  );

  assert.equal(elements.board, board);
  assert.equal(elements.message, message);
});

test('queryRequiredElements throws a readable refresh hint when the DOM structure is incomplete', () => {
  global.document = {
    querySelector(selector) {
      return selector === '#message' ? { id: 'message' } : null;
    }
  };

  assert.throws(
    () =>
      queryRequiredElements(
        {
          board: '#board',
          message: '#message'
        },
        { pageName: 'H5 解题页' }
      ),
    /H5 解题页结构不完整，请刷新页面后重试。/
  );
});

test('getBootstrapErrorMessage hides internal runtime errors behind a stable fallback', () => {
  assert.equal(
    getBootstrapErrorMessage(
      new TypeError("Cannot read properties of null (reading 'addEventListener')"),
      'H5 解题页初始化失败，请刷新页面后重试。'
    ),
    'H5 解题页初始化失败，请刷新页面后重试。'
  );
});

test('getBootstrapErrorMessage keeps readable page-structure errors intact', () => {
  assert.equal(
    getBootstrapErrorMessage(
      new Error('H5 解题页结构不完整，请刷新页面后重试。'),
      'H5 解题页初始化失败，请刷新页面后重试。'
    ),
    'H5 解题页结构不完整，请刷新页面后重试。'
  );
});
