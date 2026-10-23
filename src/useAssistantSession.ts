import { useEffect, useState } from 'react'
import { defaultAssistantPreferences, type AssistantRole } from './assistantModel'
import type { AIContext } from './types'

export function useAssistantSession(role: AssistantRole | undefined) {
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantDraft, setAssistantDraft] = useState('')
  const [assistantContexts, setAssistantContexts] = useState<AIContext[]>([])
  const [assistantPreferences, setAssistantPreferences] = useState(defaultAssistantPreferences)
  useEffect(() => {
    if (role) setAssistantPreferences(previous => previous.role === role ? previous : { ...previous, role })
  }, [role])
  return { assistantOpen, setAssistantOpen, assistantDraft, setAssistantDraft, assistantContexts, setAssistantContexts, assistantPreferences, setAssistantPreferences }
}
