# Web QA Auto Inspector

URL 기반 웹사이트 자동 QA 리포트 생성 대시보드입니다.

## 프로젝트 개요

공개 웹페이지 URL을 입력하면 페이지 접속 상태, 메타데이터, 이미지, 링크, 버튼/CTA, 반응형 UI, 콘솔 에러, 접근성, SEO 기본 항목을 자동 점검하는 포트폴리오용 QA 자동화 웹 애플리케이션입니다.

현재 버전은 서버 없이 동작하는 데모 검사 엔진으로 구성되어 있으며, 추후 Playwright 기반 실제 검사 로직을 연결하기 쉽도록 결과 데이터 구조를 분리했습니다.

## 주요 기능

- URL 입력 및 형식 검증
- 예시 URL 버튼 제공
- QA 검사 진행 상태 표시
- PASS / WARN / FAIL 결과 표시
- Critical / Major / Minor 심각도 분류
- 전체 QA 점수 자동 산정
- 항목별 상세 리포트 제공
- JSON 결과 다운로드
- HTML 리포트 다운로드
- 다크모드 지원
- 모바일 반응형 UI 지원

## 실행 방법

별도 설치 없이 `index.html` 파일을 브라우저에서 열면 됩니다.

로컬 서버로 실행하고 싶다면 아래 명령어를 사용할 수 있습니다.

```bash
npx serve .
```

또는 VS Code의 Live Server 확장 프로그램으로 실행해도 됩니다.

## 파일 구조

```text
web_qa_auto_inspector/
├─ index.html
├─ styles.css
├─ app.js
├─ package.json
├─ README.md
└─ assets/
   └─ favicon.svg
```

## 추후 Playwright 연동 방향

현재 `app.js`의 `createDemoReport(url)` 함수가 데모 QA 결과를 생성합니다.
실제 자동화 검사로 확장할 때는 이 함수를 Node.js + Express API로 분리하고, 서버에서 Playwright를 실행해 동일한 형태의 JSON을 반환하도록 구성하면 됩니다.

예시 확장 구조:

```text
server/
├─ index.js
├─ playwrightRunner.js
└─ reportMapper.js
```

검사 흐름:

1. 프론트엔드에서 URL 입력
2. `/api/inspect`로 URL 전달
3. 서버에서 Playwright 실행
4. 페이지 접속, 콘솔 에러, 이미지/링크, SEO/접근성 항목 수집
5. 현재 리포트 JSON 스키마로 변환
6. 프론트엔드 대시보드에 표시

## 포트폴리오 설명 문구

Web QA Auto Inspector는 공개 웹페이지 URL을 기준으로 페이지 접속, 이미지, 링크, 버튼, 반응형 UI, 콘솔 에러, SEO 및 접근성 기본 항목을 자동 점검하는 QA 자동화 대시보드입니다. 반복적인 웹 검수 업무를 자동화하고, 검사 결과를 PASS/WARN/FAIL 및 이슈 심각도 기준으로 정리하여 QA 리포트 형태로 제공합니다.

## UI Update v2

- 라이트/다크 모드 표시 로직 수정: 현재 모드가 버튼에 그대로 표시됩니다.
- SaaS 대시보드 스타일 UI polish 적용
- 카드 hover, 버튼 shine, 진행바 animation, 다크모드 구분감 효과 추가
- 라이트/다크 테마별 배경, 카드, 텍스트 대비 개선
- 모바일 레이아웃 및 토글 버튼 스타일 보완

## v3 수정 사항

- 히어로 영역을 가로로 넓게 재배치했습니다.
- 검사 시작하기 / 검사항목 보기 버튼을 긴 가로형 버튼으로 정리했습니다.
- Demo Score 영역을 히어로 문구 아래에 배치했습니다.
- 다크모드에서 카드·테이블·상세 리포트·입력창의 박스 구분이 더 명확하게 보이도록 대비와 테두리를 강화했습니다.
- 이 zip은 압축 해제 시 프로젝트 파일이 바로 보이도록 루트 구조로 패키징했습니다.
