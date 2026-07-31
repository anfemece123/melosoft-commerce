import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vercel resolves physical files before applying rewrites. Publishing an
 * index.html therefore prevents the crawler-only rewrite for "/" from ever
 * reaching the storefront SEO function. Development remains unchanged, while
 * production publishes the SPA document as app.html for the fallback rewrite.
 */
function publishSpaAsAppHtml(): Plugin {
  return {
    name: 'publish-spa-as-app-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const indexAsset = bundle['index.html'];
      if (!indexAsset) {
        this.error('Vite did not generate index.html.');
        return;
      }
      if (indexAsset.type !== 'asset') {
        this.error('Vite generated index.html as an unexpected chunk.');
        return;
      }
      this.emitFile({
        type: 'asset',
        fileName: 'app.html',
        source: indexAsset.source,
      });
      delete bundle['index.html'];
    },
  };
}

function serveAppHtmlInPreview(): Plugin {
  return {
    name: 'use-app-html-in-preview',
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        const requestUrl = request.url ?? '/';
        const queryIndex = requestUrl.indexOf('?');
        const pathname = queryIndex >= 0 ? requestUrl.slice(0, queryIndex) : requestUrl;
        const query = queryIndex >= 0 ? requestUrl.slice(queryIndex) : '';
        const isFile = /\/[^/]+\.[^/]+$/.test(pathname);

        if (!isFile && !pathname.startsWith('/api/')) {
          request.url = `/app.html${query}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), publishSpaAsAppHtml(), serveAppHtmlInPreview()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
