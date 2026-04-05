import { loadCommonJsModule } from './commonjs-runtime.js';
import { getBootstrapErrorMessage, queryRequiredElements } from './page-bootstrap.js';
import { getQueryPuzzle } from './platform.js';
import {
  renderGuideControls,
  renderSolverBoard,
  renderSolverSteps
} from './dom-helpers.js';

const SHARED_SOLVER_CONTROLLER_URL = new URL('../../miniapps/shared/solver-controller.js', import.meta.url).toString();

let controller = null;
let currentData = null;
let elements = null;

function getElements() {
  return queryRequiredElements(
    {
      board: '#h5-solver-board',
      solveButton: '#h5-solver-solve',
      clearButton: '#h5-solver-clear',
      stepCount: '#h5-solver-step-count',
      progress: '#h5-solver-progress',
      guideControls: '#h5-solver-guide-controls',
      steps: '#h5-solver-steps'
    },
    { pageName: 'H5 解题页' }
  );
}

function render(nextData = currentData) {
  if (!nextData) {
    return;
  }

  currentData = nextData;
  elements.board.innerHTML = renderSolverBoard(nextData.cells);
  elements.stepCount.textContent = nextData.stepCountText;
  elements.progress.textContent = nextData.guideAvailable
    ? nextData.guideProgressText
    : `${nextData.stepCountText} 条`;
  elements.guideControls.innerHTML = renderGuideControls(nextData);
  elements.steps.innerHTML = renderSolverSteps(nextData);
  scrollActiveGuideStepIntoView();
}

function scrollActiveGuideStepIntoView() {
  const activeStep = elements.steps.querySelector('.solver-step.active');

  if (!activeStep || typeof activeStep.scrollIntoView !== 'function') {
    return;
  }

  activeStep.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest'
  });
}

function commit(action) {
  render(action());
}

function bindEvents() {
  elements.board.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-row][data-col]');

    if (!cell) {
      return;
    }

    commit(() => controller.selectCell(Number(cell.dataset.row), Number(cell.dataset.col)));
  });

  elements.solveButton.addEventListener('click', () => {
    commit(() => controller.solve());
  });

  elements.clearButton.addEventListener('click', () => {
    commit(() => controller.clear());
  });

  elements.guideControls.addEventListener('click', (event) => {
    const button = event.target.closest('button');

    if (!button || button.disabled) {
      return;
    }

    switch (button.id) {
      case 'h5-guide-start':
        commit(() => controller.startGuide());
        break;
      case 'h5-guide-prev':
        commit(() => controller.prevGuideStep());
        break;
      case 'h5-guide-next':
        commit(() => controller.nextGuideStep());
        break;
      case 'h5-guide-solution':
        commit(() => controller.showGuideSolution());
        break;
      default:
        break;
    }
  });

  elements.steps.addEventListener('click', (event) => {
    const item = event.target.closest('[data-step-index]');

    if (!item) {
      return;
    }

    commit(() => controller.jumpToGuideStep(Number(item.dataset.stepIndex)));
  });
}

function getOrCreateFatalErrorElement() {
  const existing = document.querySelector('.solver-fatal-error');

  if (existing) {
    return existing;
  }

  const hero = document.querySelector('.solver-hero');

  if (!hero) {
    return null;
  }

  const errorElement = document.createElement('p');
  errorElement.className = 'message solver-fatal-error';
  errorElement.setAttribute('role', 'alert');
  hero.append(errorElement);
  return errorElement;
}

function renderFatalError(error) {
  const messageElement = getOrCreateFatalErrorElement();
  const message = getBootstrapErrorMessage(error, 'H5 解题页初始化失败，请刷新页面后重试。');

  if (messageElement) {
    messageElement.textContent = message;
  }

  console.error(error);
}

async function bootstrap() {
  elements = getElements();

  const { createSolverController } = await loadCommonJsModule(SHARED_SOLVER_CONTROLLER_URL);

  controller = createSolverController({
    queryPuzzle: getQueryPuzzle()
  });
  bindEvents();
  render(controller.init());
}

bootstrap().catch(renderFatalError);
