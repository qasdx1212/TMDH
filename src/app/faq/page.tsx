'use client'

import { useState } from 'react'

const FAQS = [
  {
    category: '서비스 소개',
    emoji: '🏠',
    items: [
      { q: '집.zip이 뭔가요?', a: '집.zip은 400×200 격자 위에 디지털 공간(집)을 분양받아 꾸밀 수 있는 인터넷 부동산 플랫폼입니다. 총 80,000칸의 공간이 있으며(1칸 = 10×10 픽셀), 각 칸에 이름·소개글·이미지·링크를 등록할 수 있어요.' },
      { q: '어떤 용도로 사용할 수 있나요?', a: '개인 소개, 브랜드 홍보, 취향 기록, 비즈니스 광고 등 자유롭게 활용할 수 있어요. 집 주소를 명함에 넣거나 SNS 바이오에 링크로 걸어두는 분들도 많아요!' },
      { q: '왜 "기부 증서"인가요?', a: '집.zip 입주 수익의 일부는 디지털 문화 발전 기금으로 기부됩니다. 입주자분들은 단순 구매자가 아닌 인터넷 역사에 이름을 남기는 기여자가 됩니다.' },
      { q: '지도 어디에 입주하는 게 좋나요?', a: '집.zip은 하나로 이어진 단일 지도예요. 빈 칸이라면 어디든 자유롭게 입주할 수 있고, 이미 입주한 이웃들을 둘러보며 마음에 드는 자리를 고르시면 됩니다. 향후 중심 구역은 가격이 조금 더 높게 책정될 수 있어요.' },
    ],
  },
  {
    category: '입주 관련',
    emoji: '🏗️',
    items: [
      { q: '어떻게 입주 신청을 하나요?', a: '지도에서 빈 칸을 클릭하거나, "범위 선택" 버튼으로 원하는 크기의 영역을 지정하세요. 집 정보 입력 → 이미지 등록 → 신청 확인 → 결제 순서로 진행됩니다.' },
      { q: '입주 기간은 어떻게 되나요?', a: '집.zip의 입주는 영구입니다. 한 번 구매한 칸은 만료나 갱신 없이 계속 유지돼요. 별도의 이용료가 추가로 부과되지 않습니다.' },
      { q: '원하는 위치를 선택할 수 있나요?', a: '네! 지도 위 빈 칸이라면 누구나 자유롭게 선택할 수 있어요. 인기 구역은 가격이 조금 더 높을 수 있으니 구역별 안내를 확인해 주세요.' },
      { q: '여러 칸을 동시에 구매할 수 있나요?', a: '네! 지도에서 드래그해 원하는 크기의 영역을 선택할 수 있어요. 단, 이미 입주된 칸과 겹치는 선택은 불가합니다.' },
      { q: '입주 완료까지 얼마나 걸리나요?', a: '결제 후 입주하기 버튼을 누르면 AI 콘텐츠 검사(약 2~3초)를 거쳐 즉시 지도에 반영됩니다.' },
    ],
  },
  {
    category: '수정 및 관리',
    emoji: '✏️',
    items: [
      { q: '입주 후 집 정보를 수정할 수 있나요?', a: '네! 내 집 보기에서 집 이름·소개글·이미지·링크·이펙트를 언제든 수정할 수 있습니다.' },
      { q: '비공개 설정이란 무엇인가요?', a: '비공개로 설정하면 다른 사람에게 집의 내용이 보이지 않아요. 공간은 유지되지만 방문자에게는 "비공개 집"으로 표시됩니다. 언제든 공개로 전환할 수 있어요.' },
      { q: '퇴거 신청은 어떻게 하나요?', a: '내 집 보기에서 해당 집의 퇴거 버튼을 눌러주세요. 퇴거 즉시 공간이 초기화되며, 이 작업은 되돌릴 수 없어요.' },
      { q: '집 크기나 위치를 변경할 수 있나요?', a: '위치와 크기는 입주 후 변경이 불가합니다. 원하는 위치와 크기를 신중하게 선택해 주세요.' },
    ],
  },
  {
    category: '결제 및 환불',
    emoji: '💳',
    items: [
      { q: '결제 수단은 무엇이 있나요?', a: '신용/체크카드와 카카오페이를 지원합니다. 결제는 포트원(PortOne)을 통해 안전하게 처리되며, 카드 정보는 당사에 저장되지 않습니다. (현재 테스트 모드 운영 중이며 실제 결제가 이루어지지 않습니다.)' },
      { q: '환불이 가능한가요?', a: '집.zip의 픽셀 구매는 디지털 콘텐츠에 해당하여, 결제 완료 즉시 입주 처리가 시작되는 특성상 단순 변심에 의한 환불은 불가합니다(전자상거래법 제17조 제2항 제5호). 단, 이중결제·시스템 오류·서비스 귀책 입주 실패의 경우 전액 환불됩니다. 자세한 내용은 환불정책 페이지를 확인해 주세요.' },
      { q: '이펙트 추가금은 얼마인가요?', a: '네온 테두리 등 이펙트를 선택하면 기본 이용료에 1,000원이 추가됩니다. 결제 화면에 합산되어 표시되니 확인 후 결제해 주세요.' },
      { q: '결제 내역은 어디서 확인하나요?', a: '내 집 보기 드로어 하단의 결제 내역 버튼을 통해 확인하실 수 있습니다.' },
    ],
  },
  {
    category: '신고 및 제재',
    emoji: '🚨',
    items: [
      { q: '부적절한 집을 신고하려면?', a: '해당 집의 팝업창 하단에 있는 신고하기 버튼을 눌러 신고 이유를 선택하고 접수해 주세요. 신고는 로그인한 사용자만 가능합니다.' },
      { q: '신고 후 어떻게 처리되나요?', a: '관리자가 검토 후 부적절하다고 판단되면 해당 집을 비공개 처리하거나 강제 퇴거 조치합니다. 처리까지 1~3 영업일이 소요될 수 있어요.' },
      { q: '내 집이 신고를 받으면?', a: '신고 접수만으로는 즉시 제재가 이루어지지 않아요. 관리자 검토 후 운영정책 위반으로 판단될 경우에만 조치가 취해집니다.' },
    ],
  },
  {
    category: '기타',
    emoji: '💡',
    items: [
      { q: '기부증서는 무엇인가요?', a: '내 집 보기에서 발급받을 수 있는 디지털 소유 증서입니다. PNG로 다운로드하거나 SNS에 공유할 수 있어요.' },
      { q: '방문자 수는 어떻게 측정되나요?', a: '집 팝업창을 열 때마다 1회 방문으로 카운트됩니다.' },
      { q: '좋아요는 취소할 수 있나요?', a: '네! 팝업창의 하트 버튼을 다시 누르면 취소됩니다. 로그인한 사용자만 좋아요를 남길 수 있어요.' },
      { q: '문의 및 제안은 어떻게 하나요?', a: '현재 별도 문의 채널은 준비 중입니다. 불편사항은 신고하기 기능을 통해 접수해 주세요.' },
    ],
  },
]

export default function FaqPage() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  const toggle = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#f4f3f1', color: '#1a1a1a' }}>
      {/* 헤더 */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e9e7e4', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 60, maxWidth: 800, margin: '0 auto' }}>
          <a href="/" style={{ color: '#1a1a1a', textDecoration: 'none', fontSize: 13, padding: '7px 14px', border: '1px solid #e0ddd9', borderRadius: 10, background: '#ffffff', fontWeight: 600 }}>← 지도</a>
          <div style={{ width: 1, height: 20, background: '#e9e7e4' }} />
          <div style={{ fontSize: 16, fontWeight: 700 }}>자주 묻는 질문</div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        {/* 히어로 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>자주 묻는 질문</div>
          <div style={{ fontSize: 14, color: '#6f6d6a' }}>집.zip 서비스에 대한 궁금한 점들을 모았어요</div>
        </div>

        {/* FAQ 목록 */}
        {FAQS.map(section => (
          <div key={section.category} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6f6d6a', marginBottom: 12, paddingLeft: 2 }}>
              {section.category}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {section.items.map((item, i) => {
                const key = `${section.category}-${i}`
                const isOpen = openItems.has(key)
                return (
                  <div
                    key={key}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e9e7e4',
                      borderRadius: 14,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => toggle(key)}
                      style={{
                        width: '100%', padding: '16px 18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: '#1a1a1a', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{item.q}</span>
                      <span style={{ fontSize: 13, color: '#97948f', flexShrink: 0 }}>{isOpen ? '▴' : '▾'}</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 18px 16px', borderTop: '1px solid #f0efec' }}>
                        <div style={{ paddingTop: 12, fontSize: 13.5, color: '#575654', lineHeight: 1.9 }}>
                          {item.a}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* 하단 */}
        <div style={{ marginTop: 36, padding: '24px', background: '#ffffff', border: '1px solid #e9e7e4', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#575654', lineHeight: 1.9 }}>
            더 궁금한 점이 있으신가요?<br />
            <a href="/" style={{ color: '#1a1a1a', textDecoration: 'underline', fontWeight: 600 }}>지도로 돌아가서</a> 직접 체험해보세요!
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: '#97948f', textAlign: 'center' }}>
          © 2025 집.zip (zipzipworld.com) — All rights reserved.
        </div>
      </div>
    </div>
  )
}
