import { loadCommonJsModule } from './commonjs-runtime.js';
import { getBootstrapErrorMessage, queryRequiredElements } from './page-bootstrap.js';
import { buildSolverHref, createGamePlatform } from './platform.js';
import {
  renderDifficultyButtons,
  renderDigitKeypad,
  renderGameActionGrid,
  renderGameBoard,
  renderNewGameDialog,
  renderStatusMessage
} from './dom-helpers.js';

const SHARED_GAME_CONTROLLER_URL = new URL('../../miniapps/shared/game-controller.js', import.meta.url).toString();
const SHARED_NEW_GAME_FLOW_URL = new URL('../../miniapps/shared/new-game-flow.js', import.meta.url).toString();

let controller = null;
let currentData = null;
let elements = null;
let dialogState = {
  newGameDialogVisible: false
};
let newGameFlow = null;

function getElements() {
  return queryRequiredElements(
    {
      timer: '#h5-timer',
      difficultyLabel: '#h5-difficulty-label',
      statusPill: '#h5-status-pill',
      board: '#h5-game-board',
      difficultyButtons: '#h5-difficulty-buttons',
      keypad: '#h5-game-keypad',
      actions: '#h5-action-grid',
      message: '#h5-game-message',
      solverLink: '#h5-solver-link',
      dialog: '#h5-new-game-dialog'
    },
    { pageName: 'H5 数独页' }
  );
}

function render(nextData = currentData) {
  if (!nextData) {
    return;
  }

  currentData = nextData;
  elements.timer.textContent = nextData.timerText;
  elements.difficultyLabel.textContent = nextData.difficultyLabel;
  elements.statusPill.textContent = nextData.statusPillText;
  elements.statusPill.classList.toggle('completed', nextData.statusPillCompleted);
  elements.board.innerHTML = renderGameBoard(nextData.cells);
  elements.difficultyButtons.innerHTML = renderDifficultyButtons(nextData.difficultyOptions);
  elements.keypad.innerHTML = renderDigitKeypad(nextData.keypadDigits, {
    subtle: true,
    activeDigit: nextData.activeDigit
  });
  elements.actions.innerHTML = renderGameActionGrid(nextData);
  elements.message.innerHTML = renderStatusMessage(nextData.message);
  elements.dialog.innerHTML = renderNewGameDialog(dialogState);

  if (elements.solverLink) {
    elements.solverLink.href = buildSolverHref('./solver.html', nextData.solverPuzzle);
  }
}

function setDialogState(nextDialogState) {
  dialogState = nextDialogState;
  render();
}

function commit(action) {
  render(action());
}

function handleAction(action) {
  switch (action) {
    case 'notes':
      commit(() => controller.toggleNotesMode());
      break;
    case 'prefill':
      commit(() => controller.togglePrefillMode());
      break;
    case 'locate-prefill':
      commit(() => controller.locateFirstWrongPrefill());
      break;
    case 'hint':
      commit(() => controller.applyHint());
      break;
    case 'clear':
      commit(() => controller.clearCell());
      break;
    case 'reset':
      commit(() => controller.resetGame());
      break;
    case 'refresh':
      setDialogState(newGameFlow.createNewGameDialogData());
      break;
    case 'solver':
      controller.openSolver();
      break;
    default:
      break;
  }
}

function bindEvents() {
  elements.board.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-row][data-col]');

    if (!cell) {
      return;
    }

    commit(() => controller.selectCell(Number(cell.dataset.row), Number(cell.dataset.col)));
  });

  elements.difficultyButtons.addEventListener('click', (event) => {
    const button = event.target.closest('[data-difficulty]');

    if (!button) {
      return;
    }

    commit(() => controller.startNewGame(button.dataset.difficulty));
  });

  elements.keypad.addEventListener('click', (event) => {
    const button = event.target.closest('[data-digit]');

    if (!button) {
      return;
    }

    commit(() => controller.enterDigit(Number(button.dataset.digit)));
  });

  elements.actions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');

    if (!button) {
      return;
    }

    handleAction(button.dataset.action);
  });

  elements.dialog.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dialog-action]');

    if (!button) {
      return;
    }

    switch (button.dataset.dialogAction) {
      case 'cancel':
        setDialogState(newGameFlow.createClosedNewGameDialogData());
        break;
      case 'toggle-confirm':
        setDialogState(
          newGameFlow.createNewGameDialogData({
            acknowledged: newGameFlow.toggleNewGameDialogAcknowledgement(
              dialogState.newGameDialogAcknowledged
            )
          })
        );
        break;
      case 'confirm':
        if (!newGameFlow.canConfirmNewGame(dialogState.newGameDialogAcknowledged)) {
          return;
        }

        dialogState = newGameFlow.createClosedNewGameDialogData();
        commit(() => controller.restartCurrentGame());
        break;
      default:
        break;
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      commit(() => controller.enterDigit(Number(event.key)));
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault();
      commit(() => controller.clearCell());
      return;
    }

    const actionByKey = {
      n: 'notes',
      N: 'notes',
      g: 'prefill',
      G: 'prefill',
      l: 'locate-prefill',
      L: 'locate-prefill',
      h: 'hint',
      H: 'hint',
      r: 'reset',
      R: 'reset'
    };

    if (actionByKey[event.key]) {
      event.preventDefault();
      handleAction(actionByKey[event.key]);
    }
  });

  window.addEventListener('pagehide', () => {
    controller?.stop();
  });
}

function renderFatalError(error) {
  const messageElement = elements?.message ?? document.querySelector('#h5-game-message');
  const message = getBootstrapErrorMessage(error, 'H5 页面初始化失败，请刷新页面后重试。');

  if (messageElement) {
    messageElement.textContent = message;
  }

  console.error(error);
}

async function bootstrap() {
  elements = getElements();

  const [{ createGameController }, loadedNewGameFlow] = await Promise.all([
    loadCommonJsModule(SHARED_GAME_CONTROLLER_URL),
    loadCommonJsModule(SHARED_NEW_GAME_FLOW_URL)
  ]);

  newGameFlow = loadedNewGameFlow;
  dialogState = newGameFlow.createClosedNewGameDialogData();
  controller = createGameController(
    createGamePlatform({
      onData: render
    })
  );
  bindEvents();
  render(controller.init());
}

bootstrap().catch(renderFatalError);
