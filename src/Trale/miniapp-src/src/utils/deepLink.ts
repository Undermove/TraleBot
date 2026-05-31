export interface DeepLinkParams {
  moduleId: string
  lessonId: number
}

export function parseDeepLinkParams(search: string): DeepLinkParams | null {
  const params = new URLSearchParams(search)
  const moduleId = params.get('moduleId')
  const lessonId = params.get('lessonId')
  if (!moduleId || !lessonId) return null
  const lessonIdNum = parseInt(lessonId, 10)
  if (isNaN(lessonIdNum)) return null
  return { moduleId, lessonId: lessonIdNum }
}
