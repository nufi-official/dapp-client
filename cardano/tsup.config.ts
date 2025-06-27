import {esbuildPluginFilePathExtensions} from 'esbuild-plugin-file-path-extensions'
import {defineConfig} from 'tsup'

export default defineConfig([
  {
    entry: ['src/**/*.ts'],
    format: ['esm', 'cjs'],
    outDir: 'dist',
    sourcemap: true,
    clean: false,
    silent: true,
    dts: true,
    bundle: true,
    splitting: false,
    esbuildPlugins: [
      // Note that this plugin does not work when setting "bundle: false",
      // which does not seem to matter when using glob for entry.
      esbuildPluginFilePathExtensions({
        esmExtension: 'js',
      }),
    ],
  },
])
