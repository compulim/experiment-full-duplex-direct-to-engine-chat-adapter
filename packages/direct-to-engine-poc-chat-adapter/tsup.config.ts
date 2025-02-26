import { defineConfig } from 'tsup';

export default defineConfig([
  {
    define: {
      npm_package_name: JSON.stringify(process.env.npm_package_name || ''),
      npm_package_version: JSON.stringify(process.env.npm_package_version || '')
    },
    dts: true,
    entry: {
      'direct-to-engine-poc-chat-adapter': './src/index.ts'
    },
    format: ['cjs', 'esm'],
    sourcemap: true
  }
]);
