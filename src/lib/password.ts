/* ─── 집 비밀번호 규칙: 영문 + 숫자 + 특수문자 포함 10자 이상 ─── */
export function pwdChecks(p: string) {
  return {
    len: p.length >= 10,
    alpha: /[A-Za-z]/.test(p),
    num: /[0-9]/.test(p),
    special: /[^A-Za-z0-9]/.test(p),
  }
}

export function isPwdValid(p: string): boolean {
  const c = pwdChecks(p)
  return c.len && c.alpha && c.num && c.special
}
