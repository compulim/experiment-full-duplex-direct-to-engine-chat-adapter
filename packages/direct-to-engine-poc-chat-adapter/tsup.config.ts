import { defineConfig } from 'tsup';

export default defineConfig([
  {
    dts: true,
    entry: {
      'direct-to-engine-poc-chat-adapter': './src/index.ts'
    },
    format: ['cjs', 'esm'],
    sourcemap: true
  }
]);
