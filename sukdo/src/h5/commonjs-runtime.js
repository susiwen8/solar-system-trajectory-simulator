function defaultResolve(specifier, parentUrl) {
  return new URL(specifier, parentUrl).toString();
}

function collectRequireSpecifiers(source) {
  const matches = source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g);
  const specifiers = [];

  for (const match of matches) {
    specifiers.push(match[1]);
  }

  return [...new Set(specifiers)];
}

async function defaultReadText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load CommonJS module: ${url}`);
  }

  return response.text();
}

export function createCommonJsRuntime(options = {}) {
  const readText = options.readText ?? defaultReadText;
  const resolve = options.resolve ?? defaultResolve;
  const moduleCache = new Map();
  const loadingCache = new Map();

  async function loadModule(moduleUrl) {
    const resolvedUrl = String(moduleUrl);

    if (moduleCache.has(resolvedUrl)) {
      return moduleCache.get(resolvedUrl);
    }

    if (loadingCache.has(resolvedUrl)) {
      return loadingCache.get(resolvedUrl);
    }

    const loadingPromise = (async () => {
      const source = await readText(resolvedUrl);
      const dependencies = collectRequireSpecifiers(source).map((specifier) =>
        resolve(specifier, resolvedUrl)
      );

      await Promise.all(dependencies.map((dependencyUrl) => loadModule(dependencyUrl)));

      const module = { exports: {} };
      const wrapped = new Function(
        'require',
        'module',
        'exports',
        `${source}\n//# sourceURL=${resolvedUrl}`
      );
      const require = (specifier) => {
        const dependencyUrl = resolve(specifier, resolvedUrl);

        if (!moduleCache.has(dependencyUrl)) {
          throw new Error(`CommonJS dependency not loaded: ${dependencyUrl}`);
        }

        return moduleCache.get(dependencyUrl);
      };

      wrapped(require, module, module.exports);
      moduleCache.set(resolvedUrl, module.exports);
      return module.exports;
    })();

    loadingCache.set(resolvedUrl, loadingPromise);

    try {
      return await loadingPromise;
    } finally {
      loadingCache.delete(resolvedUrl);
    }
  }

  return {
    loadModule
  };
}

export async function loadCommonJsModule(moduleUrl, options = {}) {
  const runtime = createCommonJsRuntime(options);
  return runtime.loadModule(moduleUrl);
}
