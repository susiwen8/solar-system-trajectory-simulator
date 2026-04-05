export function queryRequiredElements(selectorMap, options = {}) {
  const pageName = options.pageName ?? '页面';
  const elements = {};
  const missingSelectors = [];

  for (const [key, selector] of Object.entries(selectorMap)) {
    const element = globalThis.document?.querySelector?.(selector) ?? null;

    if (!element) {
      missingSelectors.push(selector);
      continue;
    }

    elements[key] = element;
  }

  if (missingSelectors.length > 0) {
    throw new Error(`${pageName}结构不完整，请刷新页面后重试。`);
  }

  return elements;
}

export function getBootstrapErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && /结构不完整，请刷新页面后重试。$/.test(error.message)) {
    return error.message;
  }

  return fallbackMessage;
}
