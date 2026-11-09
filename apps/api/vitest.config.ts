import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    // Her dosyada şema sıfırlanıp bütün göçler uygulanır (test/setup.ts); göç arttıkça 10 sn yetmiyor
    hookTimeout: 60_000,
    setupFiles: ['./test/setup.ts'],
  },
});
