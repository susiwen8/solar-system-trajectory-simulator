const { createSolverController } = require('../../shared/solver-controller.js');
const { recognizeSudokuFromImage } = require('../../shared/solver-image-import.js');

const CANVAS_SELECTOR = '#solver-upload-canvas';
const MAX_IMPORT_IMAGE_EDGE = 720;

function syncPage(page, data) {
  page.setData(data);
}

function callWx(api, options = {}) {
  return new Promise((resolve, reject) => {
    api({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

function getChosenImagePath(result) {
  return result?.tempFilePaths?.[0] ?? '';
}

function getClueCount(board) {
  return board.flat().filter(Boolean).length;
}

Page({
  data: {
    cells: [],
    steps: [],
    inputText: '',
    message: '',
    resultSolved: false,
    stepCountText: '0',
    guideScrollTargetId: ''
  },
  onLoad(options) {
    const queryPuzzle = options?.puzzle ? decodeURIComponent(options.puzzle) : '';
    this.controller = createSolverController({ queryPuzzle });
    syncPage(this, this.controller.init());
  },
  async getCanvasNode() {
    if (this.canvasNode) {
      return this.canvasNode;
    }

    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query.select(CANVAS_SELECTOR).fields({ node: true, size: true }).exec((result) => {
        const entry = result && result[0];

        if (!entry || !entry.node) {
          reject(new Error('当前环境暂时无法处理上传图片。'));
          return;
        }

        this.canvasNode = entry.node;
        resolve(this.canvasNode);
      });
    });
  },
  async extractImageData(filePath) {
    const canvas = await this.getCanvasNode();
    const context = canvas.getContext('2d');
    const imageInfo = await callWx(wx.getImageInfo, { src: filePath });
    const scale = Math.min(
      1,
      MAX_IMPORT_IMAGE_EDGE / Math.max(imageInfo.width, imageInfo.height)
    );
    const targetWidth = Math.max(1, Math.round(imageInfo.width * scale));
    const targetHeight = Math.max(1, Math.round(imageInfo.height * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.clearRect(0, 0, targetWidth, targetHeight);

    return new Promise((resolve, reject) => {
      const image = canvas.createImage();

      image.onload = () => {
        try {
          context.clearRect(0, 0, targetWidth, targetHeight);
          context.drawImage(image, 0, 0, targetWidth, targetHeight);
          const imageData = context.getImageData(0, 0, targetWidth, targetHeight);

          resolve({
            width: targetWidth,
            height: targetHeight,
            data: imageData.data
          });
        } catch (error) {
          reject(error);
        }
      };

      image.onerror = () => {
        reject(new Error('读取图片失败，请换一张清晰的数独图片再试。'));
      };

      image.src = filePath;
    });
  },
  handleCellTap(event) {
    const { row, col } = event.currentTarget.dataset;
    syncPage(this, this.controller.selectCell(Number(row), Number(col)));
  },
  async handleUploadImage() {
    try {
      wx.showLoading({
        title: '识别中',
        mask: true
      });

      const chooseResult = await callWx(wx.chooseImage, {
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });
      const filePath = getChosenImagePath(chooseResult);

      if (!filePath) {
        throw new Error('没有拿到可识别的图片，请重新选择。');
      }

      const imageData = await this.extractImageData(filePath);
      const board = recognizeSudokuFromImage(imageData);

      syncPage(this, this.controller.importRecognizedBoard(board));
      this.setData({
        message: `已从图片识别出 ${getClueCount(board)} 个数字，可以直接开始求解。`
      });
    } catch (error) {
      if (error && /cancel/i.test(String(error.errMsg || error.message || ''))) {
        return;
      }

      this.setData({
        message:
          error instanceof Error
            ? error.message
            : '图片识别失败，请换一张更清晰的数独图片再试。'
      });
    } finally {
      wx.hideLoading();
    }
  },
  handleSolve() {
    syncPage(this, this.controller.solve());
  },
  handleStartGuide() {
    syncPage(this, this.controller.startGuide());
  },
  handlePrevGuideStep() {
    syncPage(this, this.controller.prevGuideStep());
  },
  handleNextGuideStep() {
    syncPage(this, this.controller.nextGuideStep());
  },
  handleJumpToGuideStep(event) {
    const { stepIndex } = event.currentTarget.dataset;
    syncPage(this, this.controller.jumpToGuideStep(Number(stepIndex)));
  },
  handleShowGuideSolution() {
    syncPage(this, this.controller.showGuideSolution());
  },
  handleSample() {
    syncPage(this, this.controller.loadSample());
  }
});
