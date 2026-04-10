import Link from 'next/link';

export default function SalesManualPage() {
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">영업 시스템 사용 매뉴얼</h1>
              <p className="text-sm text-slate-500 mt-1">개별 스캔, 전체 스캔, 이메일 생성까지 한 번에 정리</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/ws_media_miner.zip"
                download
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold whitespace-nowrap"
              >
                ⬇ adminer 다운로드
              </a>
              <Link
                href="/sales"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold whitespace-nowrap"
              >
                대시보드로 돌아가기
              </Link>
            </div>
          </div>

          <div className="px-6 py-6 space-y-6 text-sm text-slate-700 leading-relaxed">
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h2 className="text-base font-bold text-slate-900 mb-2">Ad Miner(adminer) 설치 방법</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>이 페이지 상단의 <strong>⬇ adminer 다운로드</strong> 버튼으로 파일을 다운로드합니다.</li>
                <li>ZIP 압축을 해제합니다.</li>
                <li>크롬 확장 페이지로 이동합니다: <a href="chrome://extensions" className="text-blue-700 underline">chrome://extensions</a></li>
                <li>오른쪽 상단 <strong>개발자 모드</strong>를 켭니다.</li>
                <li><strong>압축해제된 확장 프로그램을 로드합니다.</strong> 버튼을 눌러 압축 해제 폴더를 선택합니다.</li>
                <li>설치 후 확장 아이콘에서 로그인해 사용합니다.</li>
              </ol>
              <div className="mt-3 text-xs text-slate-600">
                참고 링크:
                {' '}
                <a
                  href="https://support.google.com/chrome_webstore/answer/2664769?hl=ko"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline"
                >
                  Chrome 확장 설치/관리 가이드
                </a>
              </div>
            </section>

            <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h2 className="text-base font-bold text-slate-900 mb-2">Ad Miner 빠른 시작</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>YouTube Shorts 페이지에서 확장 아이콘을 열고 로그인합니다. (웹앱과 동일 아이디/비밀번호)</li>
                <li><strong>채굴 ON</strong>, <strong>자동 스크롤 ON</strong> 상태에서 광고 탐색을 시작합니다.</li>
                <li>수집이 쌓이면 <strong>서버 전송(AI 분석)</strong> 버튼으로 일괄 동기화합니다.</li>
                <li>동기화 성공 건은 <strong>sent</strong> 상태로 바뀌고, 웹 대시보드 리드에 반영됩니다.</li>
              </ol>
              <ul className="list-disc pl-5 space-y-1 mt-3">
                <li><strong>동기화 실패가 반복</strong>되면: 확장프로그램 로그아웃 후 재로그인, 확장 새로고침, 페이지 새로고침 순서로 점검하세요.</li>
                <li><strong>성공 0 / 실패 N</strong>이 계속되면 서버 인증(401) 또는 API 주소 불일치 가능성이 큽니다.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2">1. 기본 흐름</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>스캔 대상 선택 후 <strong>개별 스캔</strong> 또는 <strong>전체 스캔</strong> 실행</li>
                <li>광고주 후보를 선택해 기사/회사 정보 확인</li>
                <li>필요 시 <strong>홈페이지 크롤링</strong>으로 정보 보강</li>
                <li><strong>AI 초안 생성</strong> 후 복사 또는 mailto 발송</li>
              </ol>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2">2. 스캔 버튼 안내</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>개별 스캔</strong>: 선택한 소스(전체/네이버/RSS)만 즉시 스캔</li>
                <li><strong>RSS 선택 시</strong>: 특정 RSS 피드를 개별 선택해 해당 피드만 스캔 가능</li>
                <li><strong>전체 스캔</strong>: 소스를 순차로 모두 스캔 (중간 중단 가능)</li>
                <li><strong>스마트 큐 처리</strong>: 큐 누적 항목을 빠르게 소진</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2">3. 점수 로직</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>최종 점수는 AI 평가 점수를 그대로 사용합니다 (0~100점).</li>
                <li>평가 우선순위는 <strong>포커스미디어 엘리베이터TV 적합성</strong>이며, 특히 <strong>지역 타게팅 중요도</strong>를 최우선으로 봅니다.</li>
                <li>최소 점수 기본값은 <strong>50점</strong>입니다.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2">4. 이메일 작성 팁</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>먼저 홈페이지 크롤링으로 기업 소개/서비스 정보를 보강하세요.</li>
                <li>메일 본문에는 확인된 사실 기반 문장을 1~2개 반영하세요.</li>
                <li>복사 버튼을 사용하면 제목/본문 줄바꿈이 정리된 형태로 복사됩니다.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2">5. 크롬 확장 설치</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>이 페이지 상단의 <strong>⬇ adminer 다운로드</strong> 버튼으로 파일을 다운로드합니다.</li>
                <li>파일 압축을 해제합니다.</li>
                <li>크롬 주소창에 <code>chrome://extensions</code> 입력 후 이동합니다.</li>
                <li>우측 상단 <strong>개발자 모드</strong>를 켭니다.</li>
                <li><strong>압축해제된 확장 프로그램을 로드합니다.</strong>를 눌러 압축 해제 폴더를 선택합니다.</li>
                <li>설치 후 확장 아이콘에서 로그인해 사용합니다.</li>
              </ol>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
