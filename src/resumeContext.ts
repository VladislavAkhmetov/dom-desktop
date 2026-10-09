import type { OpenResult, Resource } from './types'

export interface ResumeFailure { id: string; name: string; error: string }
export interface ResumeResult { successfulIds: string[]; failures: ResumeFailure[] }

// Only retry failures from this attempt; launching a document never authorizes closing another.
export async function resumeDocuments(documents: Resource[], open: (resource: Resource) => Promise<OpenResult>, successfulIds: string[] = []): Promise<ResumeResult> {
  const successful = new Set(successfulIds)
  const failures: ResumeFailure[] = []
  for (const document of documents) {
    if (successful.has(document.id)) continue
    try {
      const result = await open(document)
      if (result.ok) successful.add(document.id)
      else failures.push({ id: document.id, name: document.name, error: result.error || 'Не удалось открыть документ.' })
    } catch (error) {
      failures.push({ id: document.id, name: document.name, error: error instanceof Error ? error.message : 'Не удалось открыть документ.' })
    }
  }
  return { successfulIds: [...successful], failures }
}
