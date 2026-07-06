/**
 * Supabase / 네트워크 에러를 사용자 친화적인 한국어 메시지로 변환합니다.
 * 순수 함수 — 부수효과 없음. 컴포넌트에서 `alert(toUserMessage(error))` 형태로 사용.
 */

const DEFAULT_MESSAGE = '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';

interface PostgrestLike {
  code?: unknown;
  message?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractCode(error: unknown): string | undefined {
  if (isObject(error)) {
    const { code } = error as PostgrestLike;
    if (typeof code === 'string') return code;
    if (typeof code === 'number') return String(code);
  }
  return undefined;
}

function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (isObject(error)) {
    const { message } = error as PostgrestLike;
    if (typeof message === 'string') return message;
  }
  return '';
}

export function toUserMessage(error: unknown): string {
  if (error === null || error === undefined) {
    return DEFAULT_MESSAGE;
  }

  const code = extractCode(error);
  const message = extractMessage(error);
  const lowerMessage = message.toLowerCase();

  // 1) PostgrestError / Postgres 코드 기반 매핑
  switch (code) {
    case '23505': // unique_violation
      return '이미 사용 중이거나 분양된 항목이에요.';
    case '23503': // foreign_key_violation
      return '연결된 데이터를 찾을 수 없어요.';
    case 'PGRST116': // no rows returned
      return '데이터를 찾을 수 없어요.';
    case '42501': // insufficient_privilege (RLS)
      return '권한이 없어요. 로그인 상태를 확인해 주세요.';
    default:
      break;
  }

  // 2) 메시지 내용 기반 매핑
  if (
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch')
  ) {
    return '네트워크 연결을 확인해 주세요.';
  }

  if (
    lowerMessage.includes('jwt') ||
    lowerMessage.includes('token') ||
    lowerMessage.includes('expired')
  ) {
    return '로그인 세션이 만료됐어요. 다시 로그인해 주세요.';
  }

  // RLS 관련 메시지 (코드가 없는 경우 대비)
  if (
    lowerMessage.includes('row-level security') ||
    lowerMessage.includes('rls') ||
    lowerMessage.includes('permission denied')
  ) {
    return '권한이 없어요. 로그인 상태를 확인해 주세요.';
  }

  // 3) 그 외 / 알 수 없음
  return DEFAULT_MESSAGE;
}
