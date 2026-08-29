import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/** Flat config — eslint-config-next 16 ships these natively, no FlatCompat. */
const config = [
  ...coreWebVitals,
  ...typescript,
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  {
    rules: {
      // R3F scene graphs are built from three.js intrinsics eslint can't know.
      'react/no-unknown-property': 'off',
    },
  },
]

export default config
