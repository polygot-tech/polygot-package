// rollup.config.js
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts', // Change input to .ts or .tsx
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs', // CommonJS for Node.js environments
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm', // ES Modules for modern browsers
      sourcemap: true,
    },
    {
      file: 'dist/index.min.js',
      format: 'cjs',
      sourcemap: true,
      plugins: [terser()], // Minified version
    },
  ],
  plugins: [
    resolve({ extensions: ['.js', '.jsx', '.ts', '.tsx'] }), // Add .ts, .tsx extensions
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      extensions: ['.js', '.jsx', '.ts', '.tsx'], // Add .ts, .tsx extensions
    }),
  ],
  external: ['react', 'react-dom'], // Mark React as an external dependency
};