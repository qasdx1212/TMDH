// 관리자 이메일 목록 (여기만 고치면 전체 반영)
export const ADMIN_EMAILS = [
  'qasdx1212@gmail.com',
  'salgmls98@gmail.com',
]

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}
