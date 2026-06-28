declare module 'mgrs' {
  /** [lon, lat] → MGRS string. Throws outside ±80°/84° latitude. */
  export function forward(ll: [number, number], accuracy?: number): string
  export function inverse(mgrs: string): [number, number, number, number]
  export function toPoint(mgrs: string): [number, number]
}
