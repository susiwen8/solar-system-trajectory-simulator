const NEW_GAME_DIALOG_COPY = {
  title: '换一局？',
  content: '这会放弃当前盘面的填写进度，并生成一局新的同难度数独。',
  secondaryConfirmText: '我确认放弃当前盘面的填写进度，并立即换一局。',
  confirmText: '确认换局',
  cancelText: '取消'
};

function getNewGameDialogStep() {
  return { ...NEW_GAME_DIALOG_COPY };
}

function canConfirmNewGame(acknowledged) {
  return Boolean(acknowledged);
}

function toggleNewGameDialogAcknowledgement(acknowledged) {
  return !Boolean(acknowledged);
}

function createClosedNewGameDialogData() {
  return {
    newGameDialogVisible: false,
    newGameDialogAcknowledged: false,
    newGameDialogConfirmEnabled: false,
    newGameDialogTitle: '',
    newGameDialogContent: '',
    newGameDialogSecondaryConfirmText: '',
    newGameDialogConfirmText: '',
    newGameDialogCancelText: ''
  };
}

function createNewGameDialogData(options = {}) {
  const dialog = getNewGameDialogStep();
  const acknowledged = Boolean(options.acknowledged);

  return {
    newGameDialogVisible: true,
    newGameDialogAcknowledged: acknowledged,
    newGameDialogConfirmEnabled: canConfirmNewGame(acknowledged),
    newGameDialogTitle: dialog.title,
    newGameDialogContent: dialog.content,
    newGameDialogSecondaryConfirmText: dialog.secondaryConfirmText,
    newGameDialogConfirmText: dialog.confirmText,
    newGameDialogCancelText: dialog.cancelText
  };
}

module.exports = {
  canConfirmNewGame,
  createClosedNewGameDialogData,
  createNewGameDialogData,
  getNewGameDialogStep,
  toggleNewGameDialogAcknowledgement
};
