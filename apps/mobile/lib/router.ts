/**
 * Intent router — classifies a parsed brief to the right search path.
 * This runs client-side to decide which loading state / icon to show.
 * Actual routing logic lives in packages/api/src/routes/search.ts
 */

export type SearchPath = 'retail' | 'flights' | 'hotels' | 'food' | 'marketplace' | 'grocery'

export type RouteDecision = {
  path: SearchPath
  icon: string
  label: string
  estimatedMs: number
}

const ROUTE_MAP: Record<SearchPath, RouteDecision> = {
  retail:      { path: 'retail',      icon: '🛍️',  label: 'Searching stores...',     estimatedMs: 1200 },
  flights:     { path: 'flights',     icon: '✈️',  label: 'Checking flights...',      estimatedMs: 2000 },
  hotels:      { path: 'hotels',      icon: '🏨',  label: 'Finding hotels...',        estimatedMs: 1500 },
  food:        { path: 'food',        icon: '🍜',  label: 'Checking restaurants...', estimatedMs: 800  },
  marketplace: { path: 'marketplace', icon: '🏪',  label: 'Searching listings...',   estimatedMs: 1000 },
  grocery:     { path: 'grocery',     icon: '🛒',  label: 'Checking groceries...',   estimatedMs: 900  },
}

export function getRouteDecision(category: string): RouteDecision {
  return ROUTE_MAP[category as SearchPath] ?? ROUTE_MAP.retail
}
