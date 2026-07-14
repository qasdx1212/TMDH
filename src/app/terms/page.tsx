import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '이용약관 및 환불정책 — 집.zip',
  description: '집.zip(zipzipworld.com) 서비스 이용약관 및 환불정책 안내',
}

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function TermsPage({ searchParams }: Props) {
  const params = await searchParams
  const activeTab = params.tab === 'refund' ? 'refund' : 'terms'

  return (
    <div
      style={{
        height: '100vh',
        overflowY: 'auto',
        background: '#f4f3f1',
        color: '#1a1a1a',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e9e7e4',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            height: 60,
            maxWidth: 800,
            margin: '0 auto',
          }}
        >
          <a
            href="/"
            style={{
              color: '#1a1a1a',
              textDecoration: 'none',
              fontSize: 13,
              padding: '7px 14px',
              border: '1px solid #e0ddd9',
              borderRadius: 10,
              background: '#ffffff',
              fontWeight: 600,
            }}
          >
            ← 지도로 돌아가기
          </a>
          <div style={{ width: 1, height: 20, background: '#e9e7e4' }} />
          <div style={{ fontSize: 16, fontWeight: 700 }}>이용약관</div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        {/* 히어로 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>
            집.zip 이용약관
          </div>
          <div style={{ fontSize: 13.5, color: '#6f6d6a' }}>
            zipzipworld.com 서비스 이용에 관한 약관 및 환불정책을 안내합니다
          </div>
        </div>

        {/* 탭 */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 28,
            borderBottom: '1px solid #e9e7e4',
          }}
        >
          <a
            href="/terms?tab=terms"
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 0',
              fontSize: 14,
              fontWeight: activeTab === 'terms' ? 700 : 500,
              textDecoration: 'none',
              color: activeTab === 'terms' ? '#1a1a1a' : '#6f6d6a',
              borderBottom: activeTab === 'terms' ? '2px solid #1a1a1a' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            이용약관
          </a>
          <a
            href="/terms?tab=refund"
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 0',
              fontSize: 14,
              fontWeight: activeTab === 'refund' ? 700 : 500,
              textDecoration: 'none',
              color: activeTab === 'refund' ? '#1a1a1a' : '#6f6d6a',
              borderBottom: activeTab === 'refund' ? '2px solid #1a1a1a' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            환불정책
          </a>
        </div>

        {/* ─────────── 이용약관 탭 ─────────── */}
        {activeTab === 'terms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Section title="제1조 (목적)">
              <p>
                이 약관은 스트릿애드(이하 &quot;회사&quot;)가 운영하는 집.zip
                서비스(zipzipworld.com, 이하 &quot;서비스&quot;)의 이용에 관한 조건 및 절차,
                회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
              </p>
            </Section>

            <Section title="제2조 (서비스 소개 및 이용 조건)">
              <p>
                집.zip은 400×200 격자(총 <Strong>80,000칸</Strong>) 지도 위에서 칸(1칸 = 10×10
                픽셀)을 구매하여 자신만의 디지털 공간(이하 &quot;집&quot;)을 꾸밀 수 있는 인터넷
                서비스입니다.
              </p>
              <ul>
                <li>서비스는 만 14세 이상인 자가 이용할 수 있습니다.</li>
                <li>
                  이용자는 이 약관에 동의함으로써 서비스를 이용할 수 있습니다. 약관에 동의하지
                  않을 경우 서비스 이용이 제한됩니다.
                </li>
                <li>
                  회사는 서비스 품질 향상을 위해 약관을 변경할 수 있으며, 변경 시 서비스 내
                  공지를 통해 사전 고지합니다.
                </li>
              </ul>
            </Section>

            <Section title="제3조 (계정)">
              <p>
                서비스는 Supabase 기반 이메일 인증 로그인 방식을 사용합니다.
              </p>
              <ul>
                <li>이용자는 하나의 이메일 주소로 하나의 계정만 생성할 수 있습니다.</li>
                <li>계정 정보(이메일, 비밀번호 등)의 관리 책임은 이용자 본인에게 있습니다.</li>
                <li>
                  타인의 정보를 도용하여 계정을 생성하거나 서비스를 이용하는 행위는 금지됩니다.
                </li>
                <li>
                  계정 도용 또는 부정 이용이 확인된 경우, 회사는 해당 계정을 즉시 정지하거나
                  삭제할 수 있습니다.
                </li>
              </ul>
            </Section>

            <Section title="제4조 (픽셀 구매)">
              <p>
                이용자는 지도 위의 빈 칸을 선택하여 디지털 공간을 구매할 수 있습니다.
              </p>
              <ul>
                <li>
                  가격은 <Strong>칸(픽셀)당 1,000원</Strong>이며, 최종 결제 금액은 선택한 칸 수에
                  따라 산정됩니다.
                </li>
                <li>
                  구매한 칸은 <Strong>영구적으로</Strong> 이용자에게 귀속되며, 별도의 이용기간
                  만료나 갱신 절차가 없습니다.
                </li>
                <li>
                  <Strong>이펙트 추가금</Strong>: 네온 테두리 등 이펙트를 선택하는 경우 기본 이용료
                  외에 <Strong>추가금(현재 1,000원)</Strong>이 부과됩니다. 추가금은 결제 화면에
                  합산되어 표시됩니다.
                </li>
                <li>
                  결제 수단: 신용카드·체크카드, 카카오페이 (<Strong>포트원(PortOne)</Strong> 결제
                  시스템 이용)
                </li>
                <li>
                  결제 완료 후 &quot;입주하기&quot; 버튼을 클릭하면 AI 콘텐츠 검수를 거쳐 지도에
                  즉시 반영됩니다.
                </li>
                <li>
                  이미 타인이 구매한 칸은 구매할 수 없으며, 구매한 칸의 위치·크기는 이후 변경이
                  불가합니다.
                </li>
                <li>
                  픽셀 구매는 디지털 콘텐츠 구매에 해당하며, 관련 환불 정책은 환불정책 탭을
                  참고해 주세요.
                </li>
              </ul>
            </Section>

            <Section title="제5조 (콘텐츠 정책)">
              <p>
                이용자는 집에 등록하는 모든 콘텐츠(이름, 소개글, 이미지, 링크 등)에 대한 책임을
                집니다.
              </p>
              <p>다음에 해당하는 콘텐츠는 등록이 금지됩니다.</p>
              <ul>
                <li>불법적인 콘텐츠 (저작권 침해, 개인정보 무단 공개 등)</li>
                <li>음란·성적 콘텐츠 (성인 사이트 링크 포함)</li>
                <li>혐오 발언·차별적 표현 (인종, 성별, 종교, 장애 등을 이유로 한 혐오)</li>
                <li>타인을 비방·명예훼손하는 콘텐츠</li>
                <li>스팸·피싱·악성코드 배포를 목적으로 하는 링크</li>
                <li>기타 관련 법령을 위반하는 콘텐츠</li>
              </ul>
              <p>
                모든 콘텐츠는 입주 시 AI 자동 검수 과정을 거치며, 정책 위반이 확인된 경우 입주가
                제한되거나 기 입주된 집이 비공개 처리될 수 있습니다.
              </p>
            </Section>

            <Section title="제6조 (금지 행위)">
              <p>이용자는 서비스 이용 시 다음 행위를 해서는 안 됩니다.</p>
              <ul>
                <li>타인의 계정을 무단으로 사용하는 행위</li>
                <li>서비스 서버·시스템에 과부하를 유발하거나 정상적인 운영을 방해하는 행위</li>
                <li>서비스를 역설계(리버스 엔지니어링)하거나 소스 코드를 무단 복제하는 행위</li>
                <li>자동화 도구(봇, 크롤러 등)를 이용하여 픽셀을 대량 구매하는 행위</li>
                <li>허위 정보를 이용한 결제 또는 환불 시도</li>
                <li>기타 법령 또는 이 약관을 위반하는 행위</li>
              </ul>
              <p>
                위 행위가 확인된 경우, 회사는 경고 없이 해당 계정을 정지하거나 법적 조치를 취할
                수 있습니다.
              </p>
            </Section>

            <Section title="제7조 (서비스 변경·중단)">
              <ul>
                <li>
                  회사는 서비스 개선, 기술적 필요 등 합리적인 이유로 서비스 내용을 변경하거나
                  일시 중단할 수 있습니다.
                </li>
                <li>
                  계획된 점검이나 중단은 최소 24시간 전 서비스 내 공지를 통해 안내합니다.
                </li>
                <li>
                  회사의 귀책사유로 서비스가 장기간(7일 이상 연속) 중단되어 이용자에게 실질적인
                  피해가 발생한 경우, 이용자는 회사에 합리적인 보상을 요청할 수 있습니다.
                </li>
                <li>
                  천재지변, 서비스 제공업체(Supabase, 포트원(PortOne) 등)의 장애 등 불가항력적
                  사유로 인한 서비스 중단에 대해서는 회사가 책임을 지지 않습니다.
                </li>
              </ul>
            </Section>

            <Section title="제8조 (면책 조항)">
              <ul>
                <li>
                  회사는 이용자가 서비스를 통해 게시한 콘텐츠의 정확성, 적법성에 대해 보증하지
                  않습니다.
                </li>
                <li>
                  이용자 간 또는 이용자와 제3자 간의 분쟁에 대해 회사는 개입하지 않으며, 이로
                  인한 손해를 배상할 의무가 없습니다.
                </li>
                <li>
                  회사는 서비스 이용으로 발생한 이익 손실, 간접 손해, 특별 손해에 대해 책임을
                  지지 않습니다.
                </li>
                <li>
                  픽셀 구매는 디지털 공간 이용권의 구매이며, 실물 자산이나 투자 상품이 아닙니다.
                </li>
              </ul>
            </Section>

            <Section title="제9조 (준거법 및 분쟁 해결)">
              <p>
                이 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련한 분쟁은 회사 소재지
                관할 법원을 전속 관할 법원으로 합니다.
              </p>
            </Section>

            <Section title="제10조 (사업자 정보)">
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                  color: '#575654',
                }}
              >
                <tbody>
                  {[
                    ['상호명', '스트릿애드 (StreetAd)'],
                    ['대표자', '이승원'],
                    ['사업자등록번호', '593-17-02833'],
                    ['통신판매업신고번호', '신고 중'],
                    ['주소', '경기도 의정부시 태평로 13, 14층 1401호'],
                    ['전화', '0502-1946-1697'],
                    ['이메일', 'qasdx1212@gmail.com'],
                    ['서비스 도메인', 'zipzipworld.com'],
                    ['약관 시행일', '2026년 7월 1일'],
                  ].map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: '1px solid #f0efec' }}>
                      <td
                        style={{
                          padding: '11px 12px',
                          color: '#1a1a1a',
                          fontWeight: 600,
                          width: '40%',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </td>
                      <td style={{ padding: '11px 12px' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
        )}

        {/* ─────────── 환불정책 탭 ─────────── */}
        {activeTab === 'refund' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 핵심 요약 배너 */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e9e7e4',
                borderRadius: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                padding: '20px 22px',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#6f6d6a',
                  marginBottom: 10,
                }}
              >
                핵심 요약
              </div>
              <div style={{ fontSize: 13.5, color: '#575654', lineHeight: 2 }}>
                집.zip의 픽셀 구매는 <StrongDark>디지털 콘텐츠</StrongDark>에 해당합니다.<br />
                결제 완료 후 입주가 즉시 처리되는 특성상,{' '}
                <StrongDark>원칙적으로 취소·환불이 불가</StrongDark>합니다.<br />
                단, <StrongDark>시스템 오류·이중결제·서비스 귀책 실패</StrongDark>의 경우 전액 환불됩니다.
              </div>
            </div>

            <Section title="제1조 (환불 원칙)">
              <p>
                집.zip 서비스의 픽셀(칸) 구매는{' '}
                <Strong>전자상거래 등에서의 소비자보호에 관한 법률(이하 전자상거래법) 제17조 제2항
                제5호</Strong>
                에 따라, 소비자의 주문에 의해 개별적으로 생산·제공되는 디지털 콘텐츠로서{' '}
                <Strong>청약철회가 제한</Strong>됩니다.
              </p>
              <p>
                구체적으로, 결제 완료와 동시에 해당 픽셀 좌표가 이용자에게 즉시 배정(입주 처리)
                되어 해당 공간에 대한 타인의 구매가 제한되는 특성상, 단순 변심에 의한 취소·환불은
                불가합니다.
              </p>
            </Section>

            <Section title="제2조 (환불 가능 사유)">
              <p>다음 사유에 해당하는 경우에 한해 전액 환불이 가능합니다.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <RefundCase
                  num="①"
                  title="이중결제"
                  desc="동일 거래에 대해 결제가 2회 이상 승인된 경우, 중복 결제된 금액 전액을 환불합니다."
                />
                <RefundCase
                  num="②"
                  title="서비스 귀책 입주 실패"
                  desc="결제는 완료되었으나 회사의 시스템 오류로 인해 입주 처리가 정상적으로 이루어지지 않은 경우 전액 환불합니다."
                />
                <RefundCase
                  num="③"
                  title="결제 오류"
                  desc="결제 시스템(포트원(PortOne))의 기술적 오류로 인해 승인 금액이 표시 금액과 다를 경우 차액 또는 전액을 환불합니다."
                />
              </div>
            </Section>

            <Section title="제3조 (환불 불가 사유)">
              <p>다음의 경우에는 환불이 제한됩니다.</p>
              <ul>
                <li>단순 변심 (구매 후 마음이 바뀐 경우)</li>
                <li>이용자 본인의 실수로 인한 잘못된 위치·크기 선택</li>
                <li>AI 콘텐츠 검수에서 정책 위반으로 입주 거부된 경우 (콘텐츠 수정 후 재입주 가능)</li>
                <li>이용자의 약관 위반으로 계정이 정지된 경우</li>
                <li>이용자 기기·네트워크 환경 문제로 인한 서비스 이용 불편</li>
              </ul>
            </Section>

            <Section title="제4조 (환불 요청 방법)">
              <p>환불 사유가 발생한 경우 아래 방법으로 요청해 주세요.</p>
              <div
                style={{
                  background: '#faf9f7',
                  border: '1px solid #e9e7e4',
                  borderRadius: 10,
                  padding: '16px 18px',
                  marginTop: 8,
                  fontSize: 13,
                  color: '#575654',
                  lineHeight: 2,
                }}
              >
                <div>
                  환불 요청 이메일:{' '}
                  <a
                    href="mailto:qasdx1212@gmail.com"
                    style={{ color: '#1a1a1a', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    qasdx1212@gmail.com
                  </a>
                </div>
                <div style={{ marginTop: 8 }}>
                  이메일 제목: <Strong>[환불 요청] 집.zip 결제 건</Strong>
                </div>
                <div style={{ marginTop: 8 }}>
                  필수 기재사항:
                  <ul style={{ marginTop: 4, marginBottom: 0 }}>
                    <li>가입 이메일 주소</li>
                    <li>결제 일시 및 결제 금액</li>
                    <li>환불 사유 (구체적으로 기재)</li>
                    <li>주문 번호 (결제 완료 이메일 또는 포트원(PortOne) 결제 영수증 참고)</li>
                  </ul>
                </div>
              </div>
            </Section>

            <Section title="제5조 (환불 처리 기간)">
              <ul>
                <li>
                  환불 요청 확인 후 <Strong>영업일 기준 1~2일 내</Strong> 환불 여부를 이메일로
                  안내합니다.
                </li>
                <li>
                  환불 승인 후 실제 계좌·카드 환입까지는 결제 수단에 따라{' '}
                  <Strong>영업일 기준 3~5일</Strong>이 소요될 수 있습니다.
                </li>
                <li>
                  카드 결제의 경우 카드사 정책에 따라 환불 기간이 상이할 수 있으며, 이 경우 해당
                  카드사에 직접 문의해 주세요.
                </li>
              </ul>
            </Section>

            <Section title="제6조 (법적 근거)">
              <p>
                본 환불정책은 다음 법령에 근거합니다.
              </p>
              <ul>
                <li>
                  전자상거래 등에서의 소비자보호에 관한 법률 제17조 (청약철회 등)
                </li>
                <li>
                  동법 제17조 제2항 제5호: &quot;소비자의 주문에 따라 개별적으로 생산되는 재화
                  등 또는 이에 준하는 디지털 콘텐츠&quot;에 대한 청약철회 제한
                </li>
                <li>
                  콘텐츠산업 진흥법 제28조 (콘텐츠 이용자 보호)
                </li>
              </ul>
              <p style={{ color: '#6f6d6a', fontSize: 12.5, marginTop: 8 }}>
                * 소비자 분쟁이 발생한 경우 공정거래위원회의 소비자분쟁해결기준에 따라 처리됩니다.
                한국소비자원(1372) 또는 전자거래분쟁조정위원회(1661-5714)에 분쟁 조정을 신청할 수
                있습니다.
              </p>
            </Section>

            {/* 문의 안내 */}
            <div
              style={{
                marginTop: 4,
                padding: '20px 22px',
                background: '#ffffff',
                border: '1px solid #e9e7e4',
                borderRadius: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13.5, color: '#575654', lineHeight: 2 }}>
                환불 관련 문의는{' '}
                <a
                  href="mailto:qasdx1212@gmail.com"
                  style={{ color: '#1a1a1a', textDecoration: 'underline', fontWeight: 600 }}
                >
                  qasdx1212@gmail.com
                </a>
                으로 연락해 주세요.<br />
                영업일 기준 24시간 내 답변드립니다.
              </div>
            </div>
          </div>
        )}

        {/* 하단 공통 */}
        <div style={{ marginTop: 40, fontSize: 12, color: '#97948f', textAlign: 'center' }}>
          © 2026 집.zip (zipzipworld.com) — 스트릿애드 (StreetAd) · All rights reserved.
        </div>
      </div>
    </div>
  )
}

/* ─── 재사용 컴포넌트 ─── */

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e9e7e4',
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}
    >
      {/* 섹션 헤더 */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid #f0efec',
          fontSize: 14,
          fontWeight: 700,
          color: '#1a1a1a',
        }}
      >
        {title}
      </div>
      {/* 섹션 바디 */}
      <div
        style={{
          padding: '16px 20px',
          fontSize: 13,
          color: '#575654',
          lineHeight: 2,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{children}</span>
  )
}

function StrongDark({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: '#1a1a1a', fontWeight: 700 }}>{children}</span>
  )
}

function RefundCase({
  num,
  title,
  desc,
}: {
  num: string
  title: string
  desc: string
}) {
  return (
    <div
      style={{
        background: '#faf9f7',
        border: '1px solid #e9e7e4',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          color: '#1a1a1a',
          fontWeight: 700,
          fontSize: 15,
          flexShrink: 0,
          lineHeight: 1.8,
        }}
      >
        {num}
      </span>
      <div>
        <div style={{ color: '#1a1a1a', fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <div style={{ color: '#575654', fontSize: 13, lineHeight: 1.9 }}>{desc}</div>
      </div>
    </div>
  )
}
