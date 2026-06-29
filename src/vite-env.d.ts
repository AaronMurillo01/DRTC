/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional NASA api.nasa.gov key; falls back to the shared DEMO_KEY. */
  readonly VITE_NASA_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
