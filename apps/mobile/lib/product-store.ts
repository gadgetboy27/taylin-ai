import type { Product } from '@/components/ResultCard'

const store = new Map<string, Product>()

export function storeProduct(product: Product) {
  store.set(product.id, product)
}

export function getProduct(id: string): Product | undefined {
  return store.get(id)
}
