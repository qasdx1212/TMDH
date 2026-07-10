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
            backgroundColor: '#f4f3f1',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e9e7e4',
              borderRadius: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              padding: '36px 32px',
              maxWidth: 360,
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#dc2626',
                backgroundColor: '#fdecec',
                border: '1px solid #f5d5d5',
                borderRadius: 999,
                padding: '5px 14px',
                marginBottom: '18px',
              }}
            >
              오류
            </div>
            <h1
              style={{
                margin: '0 0 12px',
                fontSize: '20px',
                fontWeight: 700,
                color: '#1a1a1a',
              }}
            >
              일시적인 문제가 발생했어요
            </h1>
            <p
              style={{
                margin: '0 0 26px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#575654',
              }}
            >
              잠시 후 다시 시도해 주세요
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  appearance: 'none',
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: '#1c1c1e',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 600,
                  padding: '12px 28px',
                  borderRadius: 10,
                }}
              >
                새로고침
              </button>
              <a
                href="/"
                style={{
                  color: '#8c8a87',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'underline',
                }}
              >
                지도로 돌아가기
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
