import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isStatic = process.env.BUILD_ADAPTER === 'static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: isStatic
      ? adapterStatic({
          pages: 'build',
          assets: 'build',
          fallback: 'index.html',
          precompress: false,
          strict: true,
        })
      : adapterNode({
          out: 'build',
          precompress: false,
        }),
    alias: {
      $lib: 'src/lib',
      '@harmony/shared': '../shared',
    },
  },
};

export default config;
