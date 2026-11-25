// Node loader: lets the test runner resolve the app's extensionless relative
// imports ("./foo") to TypeScript sources, mirroring Vite's resolver.
import { register } from 'node:module';

register('./ts-resolve-hooks.mjs', import.meta.url);
