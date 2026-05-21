import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

export const intentSchema = z.object({
  prompt: z.string().min(2).max(500).trim(),
})

export const orderSchema = z.object({
  searchId: z.string().uuid(),
  productId: z.string().uuid(),
  tokenId: z.string(),
  amount: z.number().positive().max(5000),
})

export const tokenSchema = z.object({
  amount: z.number().positive().max(5000),
  searchId: z.string().uuid(),
})

export const signalSchema = z.object({
  searchId: z.string().uuid(),
  monitorType: z.enum(['price_drop', 'availability', 'date']),
  targetPrice: z.number().positive().optional(),
  route: z.string().optional(),
  checkIntervalHours: z.number().int().min(1).max(24).default(4),
})

export const feedbackSchema = z.object({
  searchId: z.string().uuid(),
  resultIndex: z.number().int().min(0).max(49),
  action: z.enum(['like', 'dislike', 'skip']),
})

export const validateIntent = zValidator('json', intentSchema)
export const validateOrder = zValidator('json', orderSchema)
export const validateToken = zValidator('json', tokenSchema)
export const validateSignal = zValidator('json', signalSchema)
export const validateFeedback = zValidator('json', feedbackSchema)
