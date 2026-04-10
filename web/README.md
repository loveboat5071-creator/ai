# 포커스미디어 딸깍 견적봇

주소/지역명 입력 → 반경 내 포커스미디어 엘리베이터TV 가동 단지 자동 검색 및 견적서 생성

🔗 **서비스**: https://ws-focus.vercel.app  
🤖 **텔레그램 봇**: https://t.me/wsmedia_ai_bot

## 주요 기능

- **반경 검색**: 0.5km ~ 5km 반경 단지 검색 (다중 반경 지원)
- **견적서 Excel**: 요약 + 반경별 가동리스트 시트 자동 생성
- **견적서 PDF**: 견적 요약 + 가동리스트 + 지도(반경 원/마커) 포함
- **지도 표시**: 카카오맵 기반 반경 원, 중심 마커, 단지 마커
- **텔레그램 봇**: 주소 전송 시 자동 견적 조회 및 Excel 전송
- **관리자**: 설치리스트 엑셀 업로드 (헤더 자동감지)

## 기술 스택

- **Framework**: Next.js 15 (App Router)
- **배포**: Vercel
- **지도**: Kakao Maps SDK
- **Excel**: ExcelJS
- **데이터**: Vercel Blob + 번들 JSON

## 환경변수

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오 JavaScript 키 |
| `KAKAO_API_KEY` | 카카오 REST API 키 (지오코딩) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 토큰 |
| `TELEGRAM_BOT_TOKEN` | 텔레그램 봇 토큰 |
| `TELEGRAM_WEBHOOK_SECRET` | 텔레그램 웹훅 비밀 토큰 (`X-Telegram-Bot-Api-Secret-Token`) |
| `API_SECRET` | 관리용 API 비밀 키 (`x-api-secret`) |
| `ADMIN_ID` | 관리자 ID |
| `ADMIN_PW` | 관리자 비밀번호 |
| `ADMIN_SESSION_SECRET` | 관리자 세션 서명 키 |
| `ACTIVITY_LOG_STORAGE` | 활동 로그 저장소 (`blob`, `local`, `disabled`) |

## 보안 메모

- 관리자 인증 환경변수(`ADMIN_ID`, `ADMIN_PW`, `ADMIN_SESSION_SECRET`)는 필수입니다.
- 활동 로그를 Blob에 저장할 경우 private Blob store를 사용하세요.
- 운영 환경에서 `ACTIVITY_LOG_STORAGE`를 지정하지 않으면 로그 저장은 기본적으로 비활성화됩니다.

## 로컬 개발

```bash
cd web
cp .env.example .env  # 환경변수 설정
npm install
npm run dev
```

## 데이터 현황

- 전체 4,621건 단지 좌표 보정 완료
- 관리자 페이지(`/admin`)에서 설치리스트 업로드 가능
