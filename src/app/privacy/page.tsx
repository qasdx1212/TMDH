import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '개인정보처리방침 — 집.zip',
  description: '집.zip(zipzipworld.com) 개인정보처리방침',
}

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f0906',
        fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
        color: '#fdf6e3',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          background: 'linear-gradient(180deg,#2c1a08,#1e1005)',
          borderBottom: '3px solid #6b4c2a',
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
              color: '#c8a96e',
              textDecoration: 'none',
              fontSize: 13,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #4a3010',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            ← 지도로 돌아가기
          </a>
          <div style={{ width: 1, height: 20, background: '#4a3010' }} />
          <div style={{ fontSize: 18, fontWeight: 900 }}>개인정보처리방침</div>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 64px' }}>
        {/* 타이틀 */}
        <div style={{ marginBottom: 40, paddingBottom: 24, borderBottom: '2px solid #3d2a08' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fdf6e3', marginBottom: 10 }}>
            개인정보처리방침
          </div>
          <div style={{ fontSize: 13, color: '#7a5c3a', lineHeight: 1.8 }}>
            스트릿애드(StreetAd)가 운영하는 집.zip(zipzipworld.com)은 이용자의 개인정보를 소중히
            여기며, 「개인정보 보호법」 등 관련 법령을 준수합니다.
          </div>
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              background: '#1a0f05',
              border: '1px solid #4a3010',
              borderRadius: 8,
              fontSize: 12,
              color: '#8b6914',
            }}
          >
            시행일: 2026년 7월 1일
          </div>
        </div>

        {/* 섹션 공통 스타일 helper — inline으로 반복 사용 */}

        {/* 1. 개인정보의 수집 및 이용 목적 */}
        <Section title="제1조 개인정보의 수집 및 이용 목적">
          <p>회사는 다음의 목적을 위하여 개인정보를 처리합니다.</p>
          <Table
            headers={['목적', '수집 항목', '비고']}
            rows={[
              ['회원가입 및 본인 확인', '이메일 주소', 'Supabase Auth를 통한 인증'],
              [
                '서비스 이용 (집 입주 및 관리)',
                '닉네임, 집 이름, 소개글, 이미지, 링크 URL',
                '이용자가 직접 입력·업로드',
              ],
              ['결제 처리', '결제 수단 정보', '토스페이먼츠가 직접 처리 (당사 미보관)'],
              ['서비스 부정 이용 방지 및 운영', '서비스 이용 기록, 접속 IP', ''],
            ]}
          />
        </Section>

        {/* 2. 수집하는 개인정보 항목 */}
        <Section title="제2조 수집하는 개인정보 항목">
          <SubTitle>필수 항목</SubTitle>
          <BulletList
            items={[
              '이메일 주소 (회원가입 및 로그인)',
            ]}
          />
          <SubTitle>서비스 이용 시 이용자가 직접 입력하는 항목</SubTitle>
          <BulletList
            items={[
              '닉네임',
              '집 이름, 소개글',
              '이미지 파일',
              '링크 URL',
            ]}
          />
          <SubTitle>결제 시</SubTitle>
          <p>
            결제 처리는 토스페이먼츠(주)가 담당합니다. 카드번호, 유효기간 등 카드 정보는 당사 서버에
            저장되지 않으며, 토스페이먼츠의 개인정보처리방침이 적용됩니다.
          </p>
          <SubTitle>자동 수집 항목</SubTitle>
          <BulletList
            items={[
              '서비스 이용 기록, 접속 일시',
              'IP 주소',
              '쿠키 (제7조 참고)',
            ]}
          />
        </Section>

        {/* 3. 보유 및 이용기간 */}
        <Section title="제3조 개인정보의 보유 및 이용기간">
          <p>
            회사는 이용자가 회원 탈퇴를 요청하거나 개인정보 수집·이용 목적이 달성된 경우 지체 없이
            해당 개인정보를 파기합니다. 단, 관계 법령에 따라 아래와 같이 일정 기간 보관합니다.
          </p>
          <Table
            headers={['근거 법령', '보유 항목', '보유 기간']}
            rows={[
              ['전자상거래 등에서의 소비자보호에 관한 법률', '계약·청약철회 기록', '5년'],
              ['전자상거래 등에서의 소비자보호에 관한 법률', '대금결제·공급 기록', '5년'],
              ['전자상거래 등에서의 소비자보호에 관한 법률', '소비자 불만·분쟁 처리 기록', '3년'],
              ['통신비밀보호법', '접속 로그', '3개월'],
            ]}
          />
        </Section>

        {/* 4. 제3자 제공 */}
        <Section title="제4조 개인정보의 제3자 제공">
          <p>
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 서비스 제공을 위해
            아래와 같이 최소한의 범위에서 제3자에게 제공합니다.
          </p>
          <Table
            headers={['제공 받는 자', '제공 목적', '제공 항목', '보유 및 이용기간']}
            rows={[
              [
                '토스페이먼츠(주)',
                '결제 처리',
                '결제 관련 정보 (토스페이먼츠가 직접 수집)',
                '결제 완료 후 5년 (법령에 따름)',
              ],
              [
                'Supabase Inc.',
                '데이터베이스 서비스 (서버: 미국)',
                '이메일, 서비스 이용 데이터',
                '회원 탈퇴 시 또는 위탁 계약 종료 시',
              ],
            ]}
          />
          <p style={{ marginTop: 12, fontSize: 13, color: '#a08060' }}>
            ※ Supabase는 EU-US 데이터 프라이버시 프레임워크 인증 사업자이며, 이용자 데이터는 암호화되어
            전송·저장됩니다.
          </p>
        </Section>

        {/* 5. 처리 위탁 */}
        <Section title="제5조 개인정보 처리의 위탁">
          <p>회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁합니다.</p>
          <Table
            headers={['수탁 업체', '위탁 업무', '위탁 기간']}
            rows={[
              ['Supabase Inc.', '회원 인증, 데이터 저장·관리', '서비스 운영 기간 또는 위탁 계약 종료 시'],
              ['토스페이먼츠(주)', '결제 대행', '서비스 운영 기간 또는 위탁 계약 종료 시'],
            ]}
          />
          <p style={{ marginTop: 12, fontSize: 13, color: '#a08060' }}>
            회사는 위탁 계약 체결 시 개인정보 보호법에 따라 위탁업무 수행 목적 외 개인정보 처리 금지,
            기술적·관리적 보호조치, 재위탁 제한 등에 관한 사항을 계약서에 명시합니다.
          </p>
        </Section>

        {/* 6. 이용자 권리 */}
        <Section title="제6조 이용자의 권리 및 행사 방법">
          <p>이용자는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
          <BulletList
            items={[
              '개인정보 열람 요구',
              '오류 등이 있을 경우 정정 요구',
              '삭제 요구',
              '처리 정지 요구',
            ]}
          />
          <p>
            위 권리 행사는 이메일(
            <a href="mailto:qasdx1212@gmail.com" style={{ color: '#c8a96e', textDecoration: 'none' }}>
              qasdx1212@gmail.com
            </a>
            )로 요청하시면 지체 없이 처리하겠습니다. 이용자가 개인정보의 오류 등에 대한 정정 또는
            삭제를 요청한 경우에는 정정 또는 삭제를 완료할 때까지 해당 개인정보를 이용하거나 제공하지
            않습니다.
          </p>
          <p style={{ marginTop: 8, fontSize: 13, color: '#a08060' }}>
            ※ 만 14세 미만 아동의 경우, 법정대리인이 아동의 개인정보에 대한 열람·정정·삭제·처리 정지를
            요청할 수 있습니다.
          </p>
        </Section>

        {/* 7. 쿠키 */}
        <Section title="제7조 쿠키(Cookie) 사용 안내">
          <p>
            서비스는 이용자에게 원활한 서비스를 제공하기 위하여 쿠키(Cookie)를 사용합니다. 쿠키는
            웹사이트가 이용자의 브라우저에 저장하는 소량의 텍스트 파일입니다.
          </p>
          <SubTitle>쿠키 사용 목적</SubTitle>
          <BulletList
            items={[
              '로그인 세션 유지',
              '서비스 이용 환경 설정 저장',
            ]}
          />
          <SubTitle>쿠키 설정 거부 방법</SubTitle>
          <p>
            이용자는 브라우저 설정을 통해 쿠키 허용 여부를 선택할 수 있습니다. 쿠키 저장을 거부할 경우
            로그인이 필요한 서비스 이용이 어려울 수 있습니다.
          </p>
          <BulletList
            items={[
              'Chrome: 설정 → 개인정보 및 보안 → 쿠키 및 기타 사이트 데이터',
              'Safari: 환경설정 → 개인정보 보호 → 쿠키 및 웹사이트 데이터 차단',
              'Firefox: 설정 → 개인정보 및 보안 → 쿠키와 사이트 데이터',
            ]}
          />
        </Section>

        {/* 8. 개인정보 보호책임자 */}
        <Section title="제8조 개인정보 보호책임자">
          <p>
            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의
            불만 처리 및 피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <div
            style={{
              marginTop: 12,
              padding: '16px 20px',
              background: '#1a0f05',
              border: '1.5px solid #4a3010',
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 2,
            }}
          >
            <div>
              <span style={{ color: '#8b6914', fontWeight: 700 }}>상호명</span>
              <span style={{ color: '#7a5c3a', margin: '0 8px' }}>|</span>
              스트릿애드 (StreetAd)
            </div>
            <div>
              <span style={{ color: '#8b6914', fontWeight: 700 }}>서비스명</span>
              <span style={{ color: '#7a5c3a', margin: '0 8px' }}>|</span>
              집.zip (zipzipworld.com)
            </div>
            <div>
              <span style={{ color: '#8b6914', fontWeight: 700 }}>대표자명</span>
              <span style={{ color: '#7a5c3a', margin: '0 8px' }}>|</span>
              이승원
            </div>
            <div>
              <span style={{ color: '#8b6914', fontWeight: 700 }}>사업자등록번호</span>
              <span style={{ color: '#7a5c3a', margin: '0 8px' }}>|</span>
              593-17-02833
            </div>
            <div>
              <span style={{ color: '#8b6914', fontWeight: 700 }}>주소</span>
              <span style={{ color: '#7a5c3a', margin: '0 8px' }}>|</span>
              경기도 의정부시 태평로 13, 14층 1401호
            </div>
            <div>
              <span style={{ color: '#8b6914', fontWeight: 700 }}>전화</span>
              <span style={{ color: '#7a5c3a', margin: '0 8px' }}>|</span>
              0502-1946-1697
            </div>
            <div>
              <span style={{ color: '#8b6914', fontWeight: 700 }}>통신판매업신고번호</span>
              <span style={{ color: '#7a5c3a', margin: '0 8px' }}>|</span>
              신고 중
            </div>
            <div>
              <span style={{ color: '#8b6914', fontWeight: 700 }}>개인정보 보호책임자</span>
              <span style={{ color: '#7a5c3a', margin: '0 8px' }}>|</span>
              대표자
            </div>
            <div>
              <span style={{ color: '#8b6914', fontWeight: 700 }}>이메일</span>
              <span style={{ color: '#7a5c3a', margin: '0 8px' }}>|</span>
              <a
                href="mailto:qasdx1212@gmail.com"
                style={{ color: '#c8a96e', textDecoration: 'none' }}
              >
                qasdx1212@gmail.com
              </a>
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: '#a08060' }}>
            이용자는 개인정보 보호 관련 문의, 불만 처리, 피해 구제 등에 관한 사항을 위 연락처로
            문의하실 수 있습니다. 회사는 이용자의 문의에 지체 없이 답변 및 처리할 것입니다.
          </p>
        </Section>

        {/* 9. 권익 침해 구제 */}
        <Section title="제9조 개인정보 침해 신고 및 권익 구제">
          <p>
            개인정보 침해로 인한 신고나 상담이 필요하신 경우, 아래 기관에 문의하실 수 있습니다.
          </p>
          <BulletList
            items={[
              '개인정보 침해 신고센터: privacy.kisa.or.kr / 국번 없이 118',
              '개인정보 분쟁조정위원회: www.kopico.go.kr / 1833-6972',
              '경찰청 사이버범죄 신고시스템: ecrm.cyber.go.kr',
              '대검찰청 사이버수사과: www.spo.go.kr / 국번 없이 1301',
            ]}
          />
        </Section>

        {/* 10. 방침 변경 */}
        <Section title="제10조 개인정보처리방침의 변경">
          <p>
            이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가·삭제 및
            정정이 있는 경우에는 변경사항의 시행일로부터 7일 전에 서비스 공지사항을 통하여 고지합니다.
            단, 이용자의 중요한 권리에 영향을 미치는 사항의 경우에는 시행일로부터 30일 전에 고지합니다.
          </p>
        </Section>

        {/* 하단 */}
        <div
          style={{
            marginTop: 48,
            padding: '20px 24px',
            background: '#1a0f05',
            border: '1.5px solid #3d2a08',
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: '#7a5c3a', lineHeight: 1.9 }}>
            본 방침은 <strong style={{ color: '#c8a96e' }}>2026년 7월 1일</strong>부터 시행됩니다.
            <br />
            문의사항은{' '}
            <a
              href="mailto:qasdx1212@gmail.com"
              style={{ color: '#c8a96e', textDecoration: 'none', fontWeight: 700 }}
            >
              qasdx1212@gmail.com
            </a>
            으로 연락주세요.
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: '#3d2a08', textAlign: 'center' }}>
          © 2026 집.zip (zipzipworld.com) · 스트릿애드(StreetAd) — All rights reserved.
        </div>
      </div>
    </div>
  )
}

/* ─── 재사용 컴포넌트 ─────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: '#c8a96e',
          marginBottom: 16,
          paddingBottom: 10,
          borderBottom: '2px solid #3d2a08',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#a08060',
          lineHeight: 1.9,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: '#8b6914',
        marginTop: 8,
        marginBottom: -4,
      }}
    >
      {children}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 13, color: '#a08060', lineHeight: 1.8 }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

function Table({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
          background: '#130b03',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <thead>
          <tr style={{ background: '#2a1a08' }}>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  color: '#c8a96e',
                  fontWeight: 700,
                  fontSize: 12,
                  border: '1px solid #3d2a08',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid #2a1a08' }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '10px 14px',
                    color: '#a08060',
                    border: '1px solid #2a1a08',
                    lineHeight: 1.7,
                    verticalAlign: 'top',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
