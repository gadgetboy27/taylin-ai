import { Platform } from 'react-native'

/** Standard card shadow — iOS shadow + Android elevation */
export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  android: { elevation: 2 },
  default: {},
})

/** Heavier shadow for floating elements (prompt bar, modals) */
export const floatShadow = Platform.select({
  ios: {
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
  default: {},
})
