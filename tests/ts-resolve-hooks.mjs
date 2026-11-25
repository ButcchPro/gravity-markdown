// Resolve/load hooks used by tests/ts-resolve.mjs: appends .ts (or /index.ts)
// to relative specifiers that have no extension — like the bundler does — and
// teaches Node the module kinds the app imports but Node cannot evaluate on
// its own: stylesheets, JSON without import attributes, and package subpaths
// that point at a directory.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(specifier);

  if (isRelative && !hasExtension && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    for (const suffix of CANDIDATES) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }
  }

  // Package subpaths that point at a directory (`pkg/lib/x`) need the index file.
  if (!isRelative && !specifier.startsWith('node:') && !hasExtension) {
    try {
      return await nextResolve(`${specifier}/index.js`, context);
    } catch {
      // fall through to the default resolution
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (/\.(css|scss|sass|less)$/.test(url)) {
    return { format: 'module', source: 'export default {};', shortCircuit: true };
  }
  if (/\.json$/.test(url)) {
    const json = readFileSync(fileURLToPath(url), 'utf8');
    return { format: 'module', source: `export default ${json};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
