import path from 'node:path'
import process from 'node:process'
import Uni from '@uni-helper/plugin-uni'
import UniComponents from '@uni-helper/vite-plugin-uni-components'
import UniLayouts from '@uni-helper/vite-plugin-uni-layouts'
import UniManifest from '@uni-helper/vite-plugin-uni-manifest'
import UniPages from '@uni-helper/vite-plugin-uni-pages'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig, loadEnv } from 'vite'
import { validateProductionGateway } from './vite-plugins/production-gateway'

// Based on unibest 4.4.1; retain its routing, manifest, layout and UnoCSS pipeline.
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, path.resolve(process.cwd(), 'env'))
  if (command === 'build' && mode === 'production' && process.env.UNI_PLATFORM === 'h5')
    validateProductionGateway(env.VITE_SERVER_BASEURL)
  return {
    envDir: './env',
    base: env.VITE_APP_PUBLIC_BASE,
    plugins: [
      UniLayouts(),
      UniManifest(),
      UniComponents({ extensions: ['vue'], deep: true, dts: 'src/types/components.d.ts' }),
      UniPages({
        exclude: ['**/components/**/**.*'],
        subPackages: ['src/pages-work'],
        dts: 'src/types/uni-pages.d.ts',
      }),
      Uni(),
      {
        name: 'fix-vite-plugin-vue',
        configResolved(config) {
          const plugin = config.plugins.find(p => p.name === 'vite:vue')
          if (plugin?.api?.options)
            plugin.api.options.devToolsEnabled = false
        },
      },
      UnoCSS(),
      AutoImport({
        imports: ['vue', 'uni-app'],
        dts: 'src/types/auto-import.d.ts',
        dirs: ['src/hooks'],
        vueTemplate: true,
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
        '@img': path.resolve(process.cwd(), 'src/static/images'),
      },
    },
    server: { host: '0.0.0.0', port: Number(env.VITE_APP_PORT || 9000) },
    build: { target: 'es6', sourcemap: false },
  }
})
