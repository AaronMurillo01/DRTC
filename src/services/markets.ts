// Markets radar — CoinGecko free tier (no key, CORS enabled).
import { getJSON } from './http'
import type { MarketTick } from '../types'

interface CoinRow {
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
}

const URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h'

export async function fetchMarkets(): Promise<{ ticks: MarketTick[]; latencyMs: number }> {
  const { data, latencyMs } = await getJSON<CoinRow[]>(URL)
  const ticks = (data ?? []).map<MarketTick>((c) => ({
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    price: c.current_price,
    changePct: c.price_change_percentage_24h ?? 0,
  }))
  return { ticks, latencyMs }
}
