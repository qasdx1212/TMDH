'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 개발 중 디버깅을 위한 로깅 (부수효과는 여기서만)
    console.error('ErrorBoundary가 에러를 포착했습니다:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f0906',
            padding: '24px',
            textAlign: 'center',
            fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: '56px', lineHeight: 1, marginBottom: '20px' }}>
            🏚️
          </div>
          <h1
            style={{
              margin: '0 0 12px',
              fontSize: '22px',
              fontWeight: 700,
              color: '#ef4444',
            }}
          >
            일시적인 문제가 발생했어요
          </h1>
          <p
            style={{
              margin: '0 0 28px',
              fontSize: '15px',
              lineHeight: 1.6,
              color: '#a08060',
            }}
          >
            잠시 후 다시 시도해 주세요
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#c8a96e',
                color: '#0f0906',
                fontSize: '15px',
                fontWeight: 700,
                padding: '12px 28px',
                borderRadius: '10px',
                fontFamily: 'inherit',
              }}
            >
              새로고침
            </button>
            <a
              href="/"
              style={{
                color: '#a08060',
                fontSize: '14px',
                textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              지도로 돌아가기
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
