// 사용자 입력 URL을 안전한 http(s) 링크로 정규화. 위험한 스킴(javascript:, data: 등)은 null.
// - 스킴이 없으면 https:// 를 붙임 (그 결과 javascript: 등은 파싱 실패 → null 이 되어 차단됨)
// - href 로 렌더하기 전 반드시 이걸 통과시킬 것 (저장형 XSS 방어)
export function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null
  const v = input.trim()
  if (!v) return null
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}
