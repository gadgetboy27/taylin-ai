import { AccessibilityInfo, type AccessibilityRole } from 'react-native'

export async function announce(message: string): Promise<void> {
  AccessibilityInfo.announceForAccessibility(message)
}

export async function isScreenReaderActive(): Promise<boolean> {
  return AccessibilityInfo.isScreenReaderEnabled()
}

export function makeAccessibleButton(params: {
  label: string
  hint?: string
  onPress: () => void
  disabled?: boolean
}) {
  return {
    accessible: true,
    accessibilityLabel: params.label,
    accessibilityHint: params.hint,
    accessibilityRole: 'button' as AccessibilityRole,
    accessibilityState: { disabled: params.disabled ?? false },
    onPress: params.onPress,
  }
}

// Ensures touch targets are at least 44x44pt (Apple HIG)
export const MIN_TOUCH_TARGET = 44
