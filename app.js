const qaForm = document.getElementById('qaForm');
const urlInput = document.getElementById('urlInput');
const formError = document.getElementById('formError');
const progressArea = document.getElementById('progressArea');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressSteps = document.getElementById('progressSteps');
const emptyState = document.getElementById('emptyState');
const resultsSection = document.getElementById('resultsSection');
const summaryGrid = document.getElementById('summaryGrid');
const scoreCard = document.getElementById('scoreCard');
const resultMeta = document.getElementById('resultMeta');
const reportTableBody = document.getElementById('reportTableBody');
const resultList = document.getElementById('resultList');
const filterTabs = document.getElementById('filterTabs');
const themeToggle = document.getElementById('themeToggle');
const toast = document.getElementById('toast');
const downloadJson = document.getElementById('downloadJson');
const downloadHtml = document.getElementById('downloadHtml');
const downloadPdf = document.getElementById('downloadPdf');

const steps = [
  '페이지 접속 및 상태 코드 확인',
  '메타데이터 / SEO 기본 항목 분석',
  '이미지 / 링크 / 버튼 요소 점검',
  '반응형 UI / 콘솔 에러 리포트 생성'
];

let currentReport = null;
let activeFilter = 'ALL';

initializeTheme();
renderProgressSteps(0);

qaForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const rawUrl = urlInput.value.trim();
  const validation = validateUrl(rawUrl);

  if (!validation.ok) {
    formError.textContent = validation.message;
    urlInput.focus();
    return;
  }

  formError.textContent = '';
  await runInspection(validation.url);
});

document.querySelectorAll('[data-example]').forEach((button) => {
  button.addEventListener('click', () => {
    urlInput.value = button.dataset.example;
    formError.textContent = '';
    urlInput.focus();
  });
});

filterTabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-filter]');
  if (!button || !currentReport) return;
  activeFilter = button.dataset.filter;
  filterTabs.querySelectorAll('button').forEach((tab) => tab.classList.remove('is-active'));
  button.classList.add('is-active');
  renderReportDetails(currentReport.items);
});

resultList.addEventListener('click', (event) => {
  const toggle = event.target.closest('.collapse-toggle');
  if (!toggle) return;

  const card = toggle.closest('.result-card');
  const detail = card.querySelector('.detail-grid');
  const isOpen = card.classList.toggle('is-open');
  detail.hidden = !isOpen;
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.querySelector('.toggle-icon').textContent = isOpen ? '-' : '+';
  toggle.setAttribute('aria-label', `${card.querySelector('h3')?.textContent || '상세 리포트'} 상세 내용 ${isOpen ? '접기' : '펼치기'}`);
});

themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
});

downloadJson.addEventListener('click', () => {
  if (!currentReport) return;
  downloadFile(`web-qa-report-${dateSlug()}.json`, JSON.stringify(currentReport, null, 2), 'application/json');
  showToast('JSON 리포트를 다운로드했습니다.');
});

downloadHtml.addEventListener('click', () => {
  if (!currentReport) return;
  downloadFile(`web-qa-report-${dateSlug()}.html`, buildHtmlReport(currentReport), 'text/html');
  showToast('HTML 리포트를 다운로드했습니다.');
});

downloadPdf.addEventListener('click', () => {
  showToast('PDF 다운로드는 실제 PDF 라이브러리 연결용 버튼입니다. 지금은 HTML/JSON 리포트를 사용하세요.');
});

function initializeTheme() {
  const saved = localStorage.getItem('wqai-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved || (prefersDark ? 'dark' : 'light'));
}

function setTheme(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  const isDark = normalizedTheme === 'dark';
  document.documentElement.dataset.theme = normalizedTheme;
  localStorage.setItem('wqai-theme', normalizedTheme);
  themeToggle.querySelector('.theme-label').textContent = isDark ? 'Dark' : 'Light';
  themeToggle.setAttribute('aria-label', isDark ? '현재 다크 모드. 라이트 모드로 변경' : '현재 라이트 모드. 다크 모드로 변경');
}

function validateUrl(value) {
  if (!value) {
    return { ok: false, message: '검사할 웹사이트 URL을 입력해 주세요.' };
  }

  let normalized = value;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { ok: false, message: 'http 또는 https URL만 검사할 수 있습니다.' };
    }
    return { ok: true, url: url.href };
  } catch (error) {
    return { ok: false, message: 'URL 형식이 올바르지 않습니다. 예: https://example.com' };
  }
}

async function runInspection(url) {
  const runButton = qaForm.querySelector('.run-button');
  runButton.disabled = true;
  emptyState.classList.add('is-hidden');
  resultsSection.classList.add('is-hidden');
  progressArea.classList.remove('is-hidden');
  setProgress(0);
  renderProgressSteps(0);

  for (let i = 1; i <= steps.length; i += 1) {
    await wait(90);
    setProgress(Math.round((i / steps.length) * 100));
    renderProgressSteps(i);
  }

  await wait(80);
  currentReport = createDemoReport(url);
  activeFilter = 'ALL';
  filterTabs.querySelectorAll('button').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.filter === 'ALL');
  });

  renderReport(currentReport);
  progressArea.classList.add('is-hidden');
  resultsSection.classList.remove('is-hidden');
  runButton.disabled = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setProgress(percent) {
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
}

function renderProgressSteps(doneCount) {
  progressSteps.innerHTML = steps.map((step, index) => `
    <li class="${index < doneCount ? 'is-done' : ''}">${index < doneCount ? '✓' : '•'} ${step}</li>
  `).join('');
}

function createDemoReport(url) {
  const parsed = new URL(url);
  const seed = hashString(url);
  const now = new Date();
  const pageLabel = parsed.hostname.replace(/^www\./, '');
  const imageCount = 6 + (seed % 11);
  const internalLinks = 4 + (seed % 18);
  const externalLinks = 2 + (seed % 7);
  const consoleErrors = seed % 4 === 0 ? 2 : seed % 5 === 0 ? 1 : 0;
  const brokenImages = seed % 6 === 0 ? 2 : seed % 4 === 0 ? 1 : 0;
  const brokenLinks = seed % 5 === 0 ? 2 : seed % 7 === 0 ? 1 : 0;
  const hasOgImage = seed % 3 !== 0;
  const hasDescription = seed % 4 !== 1;
  const hasMobileOverflow = seed % 6 === 2;

  const items = [
    {
      name: '페이지 접속 검사',
      status: 'PASS',
      severity: 'None',
      summary: 'HTTP 200 응답으로 페이지 진입이 정상 처리되었습니다.',
      checked: `${pageLabel} 페이지에 브라우저가 정상 진입할 수 있는지, 초기 HTML 응답과 로딩 완료 상태를 확인했습니다.`,
      criteria: 'HTTP 상태 코드가 200~399 범위이고, 초기 문서 로딩이 실패하지 않아야 PASS로 판단합니다.',
      result: `검사 대상 URL은 ${url}이며, 데모 기준 HTTP 200 응답과 정상 로딩 완료 상태로 판정했습니다.`,
      improvement: '실제 Playwright 연동 시 page.goto 응답 코드, timeout, networkidle 상태를 함께 기록하면 더 정확한 접속 검사가 가능합니다.'
    },
    {
      name: '메타데이터 검사',
      status: hasDescription && hasOgImage ? 'PASS' : 'WARN',
      severity: hasDescription && hasOgImage ? 'None' : 'Minor',
      summary: hasDescription && hasOgImage ? 'title, description, OG 기본 태그가 준비된 상태입니다.' : '일부 SEO/공유 메타데이터가 누락된 것으로 감지되었습니다.',
      checked: 'title, meta description, og:title, og:image, h1 태그 존재 여부를 확인했습니다.',
      criteria: '검색 노출과 SNS 공유 품질을 위해 title, description, 대표 OG 이미지, h1이 존재해야 합니다.',
      result: hasDescription && hasOgImage
        ? '필수 메타데이터가 모두 존재하는 것으로 판정되어 기본 SEO 상태가 양호합니다.'
        : `${!hasDescription ? 'meta description 누락 가능성이 있습니다. ' : ''}${!hasOgImage ? 'og:image 누락 가능성이 있습니다.' : ''}`.trim(),
      improvement: '페이지 목적을 설명하는 80~160자 내외의 description과 공유 썸네일용 og:image를 추가하는 것이 좋습니다.'
    },
    {
      name: '이미지 로딩 검사',
      status: brokenImages > 0 ? 'WARN' : 'PASS',
      severity: brokenImages > 0 ? 'Major' : 'None',
      summary: brokenImages > 0 ? `전체 ${imageCount}개 이미지 중 ${brokenImages}개 로딩 실패가 의심됩니다.` : `전체 ${imageCount}개 이미지가 정상 로딩된 것으로 판정되었습니다.`,
      checked: '페이지 내 img 요소의 src 유효성, 로딩 완료 여부, 깨진 이미지 가능성을 확인했습니다.',
      criteria: '이미지 src가 비어 있지 않고 브라우저에서 정상적으로 로딩되어야 PASS입니다.',
      result: brokenImages > 0
        ? `데모 분석 결과 ${imageCount}개 이미지 중 ${brokenImages}개 이미지에서 로딩 실패 가능성이 확인되었습니다.`
        : `데모 분석 결과 ${imageCount}개 이미지 모두 정상 로딩 상태로 분류했습니다.`,
      improvement: brokenImages > 0
        ? '이미지 파일 경로, 대소문자, 배포 경로, 외부 이미지 접근 권한을 확인하고 실패한 src를 수정해야 합니다.'
        : '이미지 최적화를 위해 WebP/AVIF 변환과 lazy loading 적용 여부도 추가 점검할 수 있습니다.'
    },
    {
      name: '이미지 대체 텍스트 검사',
      status: seed % 2 === 0 ? 'WARN' : 'PASS',
      severity: seed % 2 === 0 ? 'Minor' : 'None',
      summary: seed % 2 === 0 ? '일부 이미지에서 alt 속성 누락 가능성이 있습니다.' : '이미지 alt 속성이 기본적으로 준비된 상태입니다.',
      checked: '이미지 요소에 접근성 대체 텍스트가 제공되는지 확인했습니다.',
      criteria: '정보 전달 목적의 이미지는 의미 있는 alt를 가져야 하며, 장식 이미지는 빈 alt로 처리해야 합니다.',
      result: seed % 2 === 0
        ? '대표 이미지 또는 프로젝트 카드 이미지 일부에 alt 누락 가능성이 있는 것으로 판정했습니다.'
        : '주요 이미지에 대체 텍스트가 존재하는 것으로 판정했습니다.',
      improvement: '프로젝트 썸네일, 버튼형 이미지, 배너 이미지에는 사용자가 이해할 수 있는 대체 텍스트를 작성하세요.'
    },
    {
      name: '링크 유효성 검사',
      status: brokenLinks > 0 ? 'FAIL' : 'PASS',
      severity: brokenLinks > 0 ? 'Major' : 'None',
      summary: brokenLinks > 0 ? `깨진 링크 ${brokenLinks}개가 발견된 것으로 판정되었습니다.` : '내부/외부 링크가 정상 범위로 판정되었습니다.',
      checked: '내부 링크, 외부 링크, 빈 href, 잘못된 URL 패턴을 확인했습니다.',
      criteria: '클릭 가능한 링크는 유효한 href를 가지고 200~399 범위의 응답을 반환해야 합니다.',
      result: brokenLinks > 0
        ? `내부 링크 ${internalLinks}개, 외부 링크 ${externalLinks}개 중 ${brokenLinks}개 링크 오류 가능성이 있습니다.`
        : `내부 링크 ${internalLinks}개, 외부 링크 ${externalLinks}개가 정상 범위로 분류되었습니다.`,
      improvement: brokenLinks > 0
        ? '404 페이지, 잘못된 상대 경로, 삭제된 외부 URL을 확인하고 링크를 최신 주소로 교체해야 합니다.'
        : '배포 후 정기적으로 외부 링크 상태를 재검사하면 링크 부패를 예방할 수 있습니다.'
    },
    {
      name: '버튼/CTA 검사',
      status: seed % 8 === 0 ? 'WARN' : 'PASS',
      severity: seed % 8 === 0 ? 'Major' : 'None',
      summary: seed % 8 === 0 ? '주요 CTA 버튼 텍스트 또는 클릭 가능 영역 개선이 필요합니다.' : '주요 버튼과 CTA 요소가 확인되었습니다.',
      checked: '사용자 행동을 유도하는 버튼, 링크형 버튼, 클릭 가능한 요소의 텍스트 존재 여부를 확인했습니다.',
      criteria: '주요 버튼은 명확한 텍스트를 가지고 클릭 가능한 상태여야 하며, 빈 버튼은 WARN으로 분류합니다.',
      result: seed % 8 === 0
        ? '일부 클릭 요소가 아이콘만 존재하거나 버튼명이 부족한 형태로 감지된 것으로 판정했습니다.'
        : '주요 CTA 버튼이 명확한 텍스트와 클릭 가능 상태를 갖춘 것으로 판정했습니다.',
      improvement: '아이콘 버튼에는 aria-label을 추가하고, 주요 CTA는 사용자가 행동을 예측할 수 있는 문구로 작성하세요.'
    },
    {
      name: '반응형 UI 검사',
      status: hasMobileOverflow ? 'WARN' : 'PASS',
      severity: hasMobileOverflow ? 'Major' : 'None',
      summary: hasMobileOverflow ? '모바일 뷰포트에서 가로 스크롤 가능성이 감지되었습니다.' : '데스크톱/모바일 뷰포트가 정상 범위로 판정되었습니다.',
      checked: '데스크톱과 모바일 기준으로 주요 레이아웃, 화면 밖 요소, 가로 스크롤 발생 여부를 확인했습니다.',
      criteria: '모바일 폭 390px 기준에서 주요 콘텐츠가 화면 밖으로 벗어나지 않아야 PASS입니다.',
      result: hasMobileOverflow
        ? '일부 카드 또는 긴 텍스트 영역이 모바일 화면에서 가로 스크롤을 만들 가능성이 있습니다.'
        : '데스크톱과 모바일 미리보기 모두 레이아웃 깨짐 없이 표시되는 것으로 판정했습니다.',
      improvement: hasMobileOverflow
        ? '고정 width, 긴 URL 텍스트, grid 컬럼 수를 점검하고 모바일에서는 flex-wrap 또는 1열 레이아웃으로 전환하세요.'
        : '실제 연동 시 Playwright screenshot 비교와 viewport별 visual regression을 추가하면 품질이 더 높아집니다.'
    },
    {
      name: '콘솔 에러 검사',
      status: consoleErrors > 1 ? 'FAIL' : consoleErrors === 1 ? 'WARN' : 'PASS',
      severity: consoleErrors > 1 ? 'Critical' : consoleErrors === 1 ? 'Major' : 'None',
      summary: consoleErrors > 0 ? `콘솔 에러 ${consoleErrors}건이 감지된 것으로 판정되었습니다.` : 'JavaScript 콘솔 에러가 감지되지 않았습니다.',
      checked: '브라우저 콘솔의 JavaScript 에러, 리소스 로딩 실패, 네트워크 에러 메시지를 확인했습니다.',
      criteria: '사용자 기능에 영향을 줄 수 있는 uncaught error와 리소스 실패가 없어야 PASS입니다.',
      result: consoleErrors > 0
        ? `데모 검사 기준 콘솔 에러 ${consoleErrors}건이 있어 기능 안정성 추가 확인이 필요합니다.`
        : '콘솔 에러가 없는 안정적인 상태로 판정했습니다.',
      improvement: consoleErrors > 0
        ? '브라우저 개발자 도구에서 에러 스택을 확인하고, 누락된 JS/CSS 파일 또는 런타임 예외를 우선 수정하세요.'
        : '실제 자동화에서는 page.on("console")과 page.on("pageerror") 이벤트를 연결해 에러 로그를 수집하세요.'
    },
    {
      name: '접근성 기본 검사',
      status: seed % 3 === 1 ? 'WARN' : 'PASS',
      severity: seed % 3 === 1 ? 'Minor' : 'None',
      summary: seed % 3 === 1 ? '버튼 이름 또는 input label 개선이 필요한 항목이 있습니다.' : '기본 접근성 항목이 양호한 것으로 판정되었습니다.',
      checked: '버튼 접근성 이름, input label, 이미지 alt, 색상 대비 경고 가능성을 확인했습니다.',
      criteria: '스크린리더가 주요 UI 요소의 목적을 파악할 수 있어야 하며, 입력 필드는 label과 연결되어야 합니다.',
      result: seed % 3 === 1
        ? '아이콘 버튼 또는 입력 요소 일부에서 접근성 이름 누락 가능성이 있습니다.'
        : '주요 버튼과 입력 요소가 접근성 기준에 맞게 구성된 것으로 판정했습니다.',
      improvement: 'button에는 텍스트 또는 aria-label을 제공하고, input은 label for/id 연결을 명확히 구성하세요.'
    },
    {
      name: 'SEO 기본 검사',
      status: seed % 7 === 3 ? 'WARN' : 'PASS',
      severity: seed % 7 === 3 ? 'Minor' : 'None',
      summary: seed % 7 === 3 ? 'title 길이 또는 canonical 태그 확인이 필요합니다.' : 'SEO 기본 구성은 정상 범위입니다.',
      checked: 'title 길이, description 길이, h1 중복, canonical 태그 존재 여부를 확인했습니다.',
      criteria: 'title과 description은 너무 짧거나 길지 않아야 하며, 대표 URL 관리를 위해 canonical을 권장합니다.',
      result: seed % 7 === 3
        ? 'SEO 기본 항목 중 canonical 또는 title 길이 최적화가 필요한 것으로 판정했습니다.'
        : '검색엔진이 페이지 주제를 파악하는 데 필요한 기본 항목이 적절한 상태로 판정했습니다.',
      improvement: '페이지마다 고유한 title/description을 작성하고, 중복 URL이 있다면 canonical 태그를 추가하세요.'
    },
    {
      name: '리소스 로딩 검사',
      status: seed % 9 === 4 ? 'WARN' : 'PASS',
      severity: seed % 9 === 4 ? 'Major' : 'None',
      summary: seed % 9 === 4 ? '일부 CSS/JS 리소스 로딩 지연 가능성이 있습니다.' : '필수 리소스 로딩이 정상 범위로 판정되었습니다.',
      checked: 'CSS, JavaScript, 폰트, 이미지 등 주요 리소스의 로딩 실패 가능성을 확인했습니다.',
      criteria: '필수 리소스는 200~399 응답으로 로딩되어야 하며, 렌더링을 막는 실패가 없어야 합니다.',
      result: seed % 9 === 4
        ? '일부 정적 파일이 지연되거나 실패할 수 있는 상태로 분류했습니다.'
        : '필수 CSS/JS 리소스가 정상적으로 불러와지는 상태로 판정했습니다.',
      improvement: '정적 파일 경로, 캐시 정책, CDN 연결 상태를 확인하고 실패 리소스는 네트워크 탭에서 우선 점검하세요.'
    },
    {
      name: 'QA 리포트 산출물 검사',
      status: 'PASS',
      severity: 'None',
      summary: '검사 결과가 JSON/HTML 리포트로 정리 가능한 상태입니다.',
      checked: '검사 결과가 상태, 심각도, 상세 설명, 개선 방법을 포함해 산출물로 정리되는지 확인했습니다.',
      criteria: 'QA 산출물은 재현 가능한 근거와 개선 방향을 포함해야 하며, 공유 가능한 형식으로 내려받을 수 있어야 합니다.',
      result: '현재 대시보드는 상세 결과를 카드, 테이블, JSON, HTML 리포트로 제공하도록 구성되어 있습니다.',
      improvement: '실제 운영 단계에서는 검사 실행 ID, 담당자, 브라우저 버전, 스크린샷 파일 경로를 함께 저장하면 추적성이 좋아집니다.'
    }
  ];

  const score = calculateScore(items);
  return {
    app: 'Web QA Auto Inspector',
    url,
    host: pageLabel,
    testedAt: now.toISOString(),
    testedAtLabel: formatDateTime(now),
    score,
    status: getOverallStatus(score),
    summary: countItems(items),
    metrics: {
      imageCount,
      internalLinks,
      externalLinks,
      consoleErrors,
      brokenImages,
      brokenLinks
    },
    items
  };
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function calculateScore(items) {
  let score = 100;
  items.forEach((item) => {
    if (item.status === 'WARN') score -= 3;
    if (item.status === 'FAIL') score -= 8;
    if (item.severity === 'Critical') score -= 15;
    if (item.severity === 'Major') score -= 8;
    if (item.severity === 'Minor') score -= 3;
  });
  return Math.max(0, Math.min(100, score));
}

function getOverallStatus(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Needs Improvement';
  return 'Critical';
}

function countItems(items) {
  return items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, { PASS: 0, WARN: 0, FAIL: 0, Critical: 0, Major: 0, Minor: 0, None: 0 });
}

function renderReport(report) {
  resultMeta.textContent = `검사 대상: ${report.url} · 실행 시간: ${report.testedAtLabel}`;
  renderSummary(report);
  renderScore(report);
  renderReportDetails(report.items);
}

function renderSummary(report) {
  const { summary } = report;
  const cards = [
    { label: 'PASS', value: summary.PASS, className: 'pass' },
    { label: 'WARN', value: summary.WARN, className: 'warn' },
    { label: 'FAIL', value: summary.FAIL, className: 'fail' },
    { label: 'Critical', value: summary.Critical, className: 'critical' },
    { label: 'Major', value: summary.Major, className: 'major' },
    { label: 'Minor', value: summary.Minor, className: 'minor' }
  ];

  const renderCard = (card) => `
    <article class="summary-item ${card.className}">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
    </article>
  `;

  const statusCards = cards.slice(0, 3).map(renderCard).join('');
  const severityCards = cards.slice(3).map(renderCard).join('');

  summaryGrid.innerHTML = `
    <div class="summary-group status-summary" aria-label="PASS WARN FAIL 요약">
      ${statusCards}
    </div>
    <div class="summary-group severity-summary" aria-label="Critical Major Minor 요약">
      ${severityCards}
    </div>
  `;
}

function renderScore(report) {
  const description = {
    Excellent: '전반적인 웹 품질이 우수합니다. 사소한 개선점만 확인하면 포트폴리오 또는 서비스 소개 페이지로 사용하기 좋습니다.',
    Good: '핵심 기능은 안정적이지만 일부 이미지, 링크, 접근성, SEO 항목에서 개선 여지가 있습니다.',
    'Needs Improvement': '사용자 경험에 영향을 줄 수 있는 이슈가 다수 있습니다. Major 이상 이슈를 우선 수정하는 것이 좋습니다.',
    Critical: '접속, 링크, 콘솔 에러 등 주요 품질 문제가 큽니다. 배포 전 핵심 이슈를 먼저 처리해야 합니다.'
  }[report.status];

  scoreCard.innerHTML = `
    <span class="label">Overall QA Score</span>
    <div class="score-number">${report.score}</div>
    <span class="score-status">${report.status}</span>
    <p class="score-description">${description}</p>
  `;
}

function renderReportDetails(items) {
  const filtered = activeFilter === 'ALL' ? items : items.filter((item) => item.status === activeFilter);

  reportTableBody.innerHTML = filtered.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${badge(item.status)}</td>
      <td>${badge(item.severity)}</td>
      <td>${escapeHtml(item.summary)}</td>
    </tr>
  `).join('');

  resultList.innerHTML = filtered.map((item, index) => `
    <article class="result-card" data-result-index="${index}">
      <div class="result-card-header">
        <div class="result-title-line">
          <h3>${escapeHtml(item.name)}</h3>
          <button class="collapse-toggle" type="button" aria-expanded="false" aria-label="${escapeHtml(item.name)} 상세 내용 펼치기">
            <span class="toggle-icon" aria-hidden="true">+</span>
          </button>
        </div>
        <p class="result-summary">${escapeHtml(item.summary)}</p>
        <div class="badge-row">
          ${badge(item.status)}
          ${badge(item.severity)}
        </div>
      </div>
      <div class="detail-grid" hidden>
        <div class="detail-box">
          <strong>검사 내용</strong>
          <p>${escapeHtml(item.checked)}</p>
        </div>
        <div class="detail-box">
          <strong>판정 기준</strong>
          <p>${escapeHtml(item.criteria)}</p>
        </div>
        <div class="detail-box">
          <strong>실제 결과</strong>
          <p>${escapeHtml(item.result)}</p>
        </div>
        <div class="detail-box">
          <strong>개선 방법</strong>
          <p>${escapeHtml(item.improvement)}</p>
        </div>
      </div>
    </article>
  `).join('') || `<p class="empty-filter">선택한 상태에 해당하는 검사 결과가 없습니다.</p>`;
}

function badge(value) {
  const normalized = String(value).toLowerCase();
  return `<span class="badge badge-${normalized}">${escapeHtml(value)}</span>`;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

function dateSlug() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildHtmlReport(report) {
  const rows = report.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.severity)}</td>
      <td>${escapeHtml(item.summary)}</td>
      <td>${escapeHtml(item.improvement)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Web QA Report - ${escapeHtml(report.host)}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; color: #111827; background: #f5f7fb; }
    .wrap { max-width: 1100px; margin: 0 auto; background: white; border-radius: 24px; padding: 32px; box-shadow: 0 20px 50px rgba(15,23,42,.1); }
    .report-head { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 12px 0 28px; border-bottom: 1px solid #e5e7eb; }
    h1 { margin: 0; font-size: 36px; letter-spacing: -0.04em; text-align: center; }
    .meta { margin: 0; color: #667085; line-height: 1.7; text-align: center; font-weight: 650; }
    .score { display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; margin: 8px auto 0; padding: 20px 34px; border-radius: 22px; background: #eff6ff; color: #1d4ed8; font-weight: 900; text-align: center; min-width: 220px; }
    .score span { display: block; text-align: center; }
    .score strong { display: block; font-size: 52px; line-height: 1; color: #111827; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { text-align: left; padding: 14px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    th { font-size: 12px; color: #667085; text-transform: uppercase; }
    td { font-size: 14px; line-height: 1.55; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="report-head">
      <h1>Web QA Auto Inspector Report</h1>
      <p class="meta">검사 대상: ${escapeHtml(report.url)}<br />검사 시간: ${escapeHtml(report.testedAtLabel)}</p>
      <div class="score"><span>Overall Score</span><strong>${report.score}</strong><span>${escapeHtml(report.status)}</span></div>
    </section>
    <table>
      <thead><tr><th>검사 항목</th><th>상태</th><th>심각도</th><th>핵심 결과</th><th>개선 방법</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2600);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
