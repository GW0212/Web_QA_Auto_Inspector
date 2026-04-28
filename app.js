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
const copySummary = document.getElementById('copySummary');
const priorityCard = document.getElementById('priorityCard');

const steps = [
  '입력한 주소로 페이지가 열리는지 확인',
  '검색/공유에 필요한 기본 설명 확인',
  '이미지, 링크, 버튼이 정상인지 확인',
  'PC/모바일 화면 깨짐과 페이지 오류 확인',
  '속도, 보안 연결, 기본 보안 설정 확인',
  '키보드 조작, 입력칸 안내, 검색 수집 정보 확인'
];

let currentReport = null;
let activeFilter = 'ALL';

initializeTheme();
renderProgressSteps(0);
setupSmoothNavigation();

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

copySummary.addEventListener('click', async () => {
  if (!currentReport) return;
  const text = buildPlainSummary(currentReport);
  try {
    await navigator.clipboard.writeText(text);
    showToast('QA 요약을 클립보드에 복사했습니다.');
  } catch (error) {
    downloadFile(`web-qa-summary-${dateSlug()}.txt`, text, 'text/plain');
    showToast('클립보드 접근이 제한되어 TXT 파일로 저장했습니다.');
  }
});

downloadPdf.addEventListener('click', () => {
  if (!currentReport) return;
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    showToast('팝업이 차단되어 HTML 리포트로 저장합니다.');
    downloadFile(`web-qa-report-${dateSlug()}.html`, buildHtmlReport(currentReport), 'text/html');
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(buildHtmlReport(currentReport));
  reportWindow.document.close();
  reportWindow.focus();
  window.setTimeout(() => reportWindow.print(), 350);
  showToast('인쇄 창에서 PDF로 저장할 수 있습니다.');
});


function setupSmoothNavigation() {
  const navigableLinks = document.querySelectorAll('.nav-links a[href^="#"], .hero-actions a[href^="#"], .brand[href^="#"]');

  navigableLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;
      event.preventDefault();
      scrollToTarget(targetId);
      setActiveNav(targetId.replace('#', ''));
    });
  });

  window.addEventListener('scroll', throttle(updateActiveNavigation, 120), { passive: true });
  window.addEventListener('resize', throttle(updateActiveNavigation, 160));
  updateActiveNavigation();
}

function scrollToTarget(targetId) {
  if (targetId === '#top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveNav('dashboard');
    return;
  }

  const target = document.querySelector(targetId);
  if (!target) return;

  const header = document.querySelector('.site-header');
  const headerRect = header ? header.getBoundingClientRect() : { height: 0 };
  const stickyTop = header ? parseFloat(getComputedStyle(header).top) || 0 : 0;
  const safeGap = window.innerWidth <= 760 ? 18 : 24;
  const targetTop = target.getBoundingClientRect().top + window.pageYOffset;
  const top = Math.max(0, targetTop - headerRect.height - stickyTop - safeGap);

  window.scrollTo({ top, behavior: 'smooth' });
}

function updateActiveNavigation() {
  const header = document.querySelector('.site-header');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const marker = headerBottom + 36;
  const sections = ['dashboard', 'test-items', 'report']
    .map((id) => ({ id, element: document.getElementById(id) }))
    .filter((section) => section.element);

  let active = 'dashboard';
  sections.forEach((section) => {
    const rect = section.element.getBoundingClientRect();
    if (rect.top <= marker) active = section.id;
  });
  setActiveNav(active);
}

function setActiveNav(activeId) {
  document.querySelectorAll('.nav-links a[href^="#"]').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href') === `#${activeId}`);
  });
}

function throttle(callback, delay) {
  let waiting = false;
  return (...args) => {
    if (waiting) return;
    waiting = true;
    window.setTimeout(() => {
      callback(...args);
      waiting = false;
    }, delay);
  };
}

function initializeTheme() {
  // PC/모바일, OS 설정, 이전 저장값과 관계없이 첫 진입은 항상 라이트 모드로 시작합니다.
  // 사용자가 토글을 누른 현재 세션에서는 다크/라이트 전환이 정상 작동합니다.
  setTheme('light');
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
  currentReport = await createDemoReport(url);
  activeFilter = 'ALL';
  filterTabs.querySelectorAll('button').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.filter === 'ALL');
  });

  renderReport(currentReport);
  progressArea.classList.add('is-hidden');
  resultsSection.classList.remove('is-hidden');
  runButton.disabled = false;
  window.setTimeout(() => scrollToTarget('#report'), 40);
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

async function createDemoReport(url) {
  const parsed = new URL(url);
  const seed = hashString(url);
  const now = new Date();
  const pageLabel = parsed.hostname.replace(/^www\./, '');
  const profile = buildInspectionProfile(parsed, seed);
  const reachability = await probeReachability(url);
  const imageCount = profile.imageCount;
  const internalLinks = profile.internalLinks;
  const externalLinks = profile.externalLinks;
  const consoleErrors = profile.consoleErrors;
  const brokenImages = profile.brokenImages;
  const brokenLinks = profile.brokenLinks;
  const hasOgImage = profile.hasOgImage;
  const hasDescription = profile.hasDescription;
  const hasMobileOverflow = profile.hasMobileOverflow;
  const isHttps = parsed.protocol === 'https:';
  const lcpMs = profile.lcpMs;
  const inpMs = profile.inpMs;
  const clsValue = profile.clsValue;
  const hasPerformanceRisk = lcpMs > 2500 || inpMs > 200 || clsValue > 0.1;
  const hasSecurityHeaderRisk = profile.hasSecurityHeaderRisk;
  const hasMixedContentRisk = isHttps && profile.hasMixedContentRisk;
  const hasKeyboardFocusRisk = profile.hasKeyboardFocusRisk;
  const hasFormRisk = profile.hasFormRisk;
  const hasCrawlRisk = profile.hasCrawlRisk;
  const hasDocumentStructureRisk = profile.hasDocumentStructureRisk;
  const hasExternalLinkSecurityRisk = profile.hasExternalLinkSecurityRisk;

  const items = [
    {
      name: '페이지 접속 검사',
      status: reachability.ok ? 'PASS' : 'FAIL',
      severity: reachability.ok ? 'None' : 'Critical',
      summary: reachability.ok ? '브라우저 사전 연결 확인이 성공했고 페이지 진입 가능 상태로 분류되었습니다.' : '브라우저 사전 연결 확인에 실패해 접속 불가 가능성이 있습니다.',
      checked: `${pageLabel} 페이지에 브라우저가 정상 진입할 수 있는지, URL 형식과 네트워크 연결 가능성을 우선 확인했습니다.`,
      criteria: 'URL 형식이 유효하고 브라우저의 네트워크 요청이 실패하지 않아야 PASS로 판단합니다.',
      result: reachability.ok
        ? `검사 대상 URL은 ${url}이며, ${reachability.mode} 기준으로 접근 가능한 상태로 판정했습니다.`
        : `검사 대상 URL은 ${url}이며, ${reachability.mode} 기준으로 연결 실패 또는 차단 가능성이 확인되었습니다.`,
      improvement: reachability.ok
        ? '실제 Playwright 연동 시 page.goto 응답 코드, timeout, networkidle 상태를 함께 기록하면 더 정확한 접속 검사가 가능합니다.'
        : 'URL 오타, 배포 상태, HTTPS 인증서, 방화벽 또는 호스팅 장애 여부를 우선 확인하세요.'
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
      name: 'Core Web Vitals 성능 검사',
      status: hasPerformanceRisk ? 'WARN' : 'PASS',
      severity: hasPerformanceRisk ? 'Major' : 'None',
      summary: hasPerformanceRisk ? `LCP ${lcpMs}ms, INP ${inpMs}ms, CLS ${clsValue} 기준으로 성능 개선이 필요합니다.` : `LCP ${lcpMs}ms, INP ${inpMs}ms, CLS ${clsValue}로 핵심 성능 지표가 양호합니다.`,
      checked: '로딩 성능, 인터랙션 응답성, 레이아웃 안정성을 나타내는 LCP, INP, CLS 항목을 점검했습니다.',
      criteria: '데모 기준 LCP 2.5초 이하, INP 200ms 이하, CLS 0.1 이하이면 PASS로 판단합니다.',
      result: hasPerformanceRisk
        ? `측정값은 LCP ${lcpMs}ms, INP ${inpMs}ms, CLS ${clsValue}입니다. 하나 이상의 지표가 권장 범위를 초과했습니다.`
        : `측정값은 LCP ${lcpMs}ms, INP ${inpMs}ms, CLS ${clsValue}입니다. 사용자 체감 성능이 안정적인 범위로 분류됩니다.`,
      improvement: hasPerformanceRisk
        ? '큰 이미지 최적화, 렌더링 차단 JS/CSS 축소, 폰트 로딩 전략 개선, 레이아웃 시프트를 유발하는 동적 영역의 크기 고정을 우선 점검하세요.'
        : '실제 연동 시 Lighthouse 또는 Performance API 기반으로 페이지별 LCP/INP/CLS 값을 저장하면 회귀 추적에 활용할 수 있습니다.'
    },
    {
      name: 'HTTPS / 혼합 콘텐츠 검사',
      status: !isHttps ? 'FAIL' : hasMixedContentRisk ? 'WARN' : 'PASS',
      severity: !isHttps ? 'Critical' : hasMixedContentRisk ? 'Major' : 'None',
      summary: !isHttps ? 'HTTPS가 아닌 URL로 접근되어 보안 연결 개선이 필요합니다.' : hasMixedContentRisk ? 'HTTPS 페이지 내 HTTP 리소스 혼합 콘텐츠 가능성이 있습니다.' : 'HTTPS 연결과 리소스 구성이 정상 범위입니다.',
      checked: '페이지가 HTTPS로 제공되는지, HTTPS 페이지 내부에서 HTTP 이미지·스크립트·스타일 리소스가 섞이는지 확인했습니다.',
      criteria: '공개 서비스 페이지는 HTTPS로 제공되어야 하며, 보안 페이지 안에서 비보안 HTTP 리소스를 호출하지 않아야 합니다.',
      result: !isHttps
        ? `검사 대상 프로토콜이 ${parsed.protocol}로 확인되어 보안 연결 기준에 미달합니다.`
        : hasMixedContentRisk
          ? '일부 외부 리소스가 HTTP 경로로 호출될 가능성이 있어 브라우저 차단 또는 경고가 발생할 수 있습니다.'
          : 'HTTPS 기반으로 접근되며 혼합 콘텐츠 위험이 낮은 상태로 판정했습니다.',
      improvement: !isHttps
        ? '배포 환경에서 SSL 인증서를 적용하고 HTTP 요청은 HTTPS로 리다이렉트되도록 설정하세요.'
        : '외부 이미지, CDN, 스크립트 경로가 모두 https:// 로 시작하는지 확인하고 오래된 HTTP URL을 교체하세요.'
    },
    {
      name: '보안 헤더 검사',
      status: hasSecurityHeaderRisk ? 'WARN' : 'PASS',
      severity: hasSecurityHeaderRisk ? 'Major' : 'None',
      summary: hasSecurityHeaderRisk ? 'CSP, X-Frame-Options, Referrer-Policy 등 일부 보안 헤더 확인이 필요합니다.' : '주요 보안 헤더가 기본 범위로 구성된 것으로 판정되었습니다.',
      checked: 'Content-Security-Policy, X-Frame-Options 또는 frame-ancestors, Referrer-Policy, Strict-Transport-Security 같은 기본 보안 헤더 구성을 점검했습니다.',
      criteria: '클릭재킹, 정보 노출, 스크립트 삽입 위험을 줄이기 위해 주요 보안 헤더가 응답에 포함되어야 합니다.',
      result: hasSecurityHeaderRisk
        ? '데모 분석 기준 일부 보안 헤더가 누락되었을 가능성이 있습니다. 특히 외부 스크립트를 사용하는 페이지라면 CSP 확인이 필요합니다.'
        : '데모 분석 기준 주요 보안 헤더 구성이 양호한 상태로 분류했습니다.',
      improvement: '운영 서버 또는 정적 호스팅 설정에서 CSP, Referrer-Policy, Permissions-Policy, HSTS 등을 적용하고 페이지 기능에 영향이 없는지 회귀 테스트하세요.'
    },
    {
      name: '키보드 포커스 검사',
      status: hasKeyboardFocusRisk ? 'WARN' : 'PASS',
      severity: hasKeyboardFocusRisk ? 'Minor' : 'None',
      summary: hasKeyboardFocusRisk ? '탭 이동 순서 또는 포커스 표시 개선이 필요한 요소가 있습니다.' : '키보드 탐색과 포커스 표시가 기본 범위로 판정되었습니다.',
      checked: 'Tab 키 이동 순서, 버튼·링크 포커스 가능 여부, 포커스 링 표시 여부를 확인했습니다.',
      criteria: '마우스 없이도 주요 링크와 버튼에 접근할 수 있어야 하며, 현재 포커스 위치가 시각적으로 명확해야 합니다.',
      result: hasKeyboardFocusRisk
        ? '일부 버튼 또는 링크에서 포커스 표시가 약하거나 이동 순서가 자연스럽지 않을 수 있습니다.'
        : '주요 인터랙션 요소가 키보드로 접근 가능한 상태로 판정했습니다.',
      improvement: 'outline 제거 코드를 점검하고, :focus-visible 스타일을 제공하며, 모달·드롭다운이 있다면 포커스 트랩과 ESC 닫기를 함께 검증하세요.'
    },
    {
      name: '폼 유효성 / 입력 접근성 검사',
      status: hasFormRisk ? 'WARN' : 'PASS',
      severity: hasFormRisk ? 'Minor' : 'None',
      summary: hasFormRisk ? '입력 필드 label, required, 오류 메시지 연결성 확인이 필요합니다.' : '폼 입력 요소의 기본 접근성과 유효성 처리가 양호합니다.',
      checked: 'input, textarea, select 요소의 label 연결, required 표시, 오류 메시지 제공 여부를 점검했습니다.',
      criteria: '입력 요소는 식별 가능한 label을 가져야 하며, 잘못된 입력에 대해 사용자가 이해할 수 있는 오류 메시지를 제공해야 합니다.',
      result: hasFormRisk
        ? '일부 입력 필드에서 label 연결 또는 오류 메시지 안내가 부족할 가능성이 있습니다.'
        : '입력 요소와 오류 안내가 기본 기준에 맞게 구성된 것으로 판정했습니다.',
      improvement: 'label for/id 연결, aria-describedby로 오류 문구 연결, 필수 입력 항목의 시각적/스크린리더 안내를 함께 구성하세요.'
    },
    {
      name: '크롤링 / 구조화 데이터 검사',
      status: hasCrawlRisk ? 'WARN' : 'PASS',
      severity: hasCrawlRisk ? 'Minor' : 'None',
      summary: hasCrawlRisk ? 'robots, sitemap, structured data 등 검색엔진 보조 항목 확인이 필요합니다.' : '크롤링과 구조화 데이터 보조 항목이 정상 범위입니다.',
      checked: 'robots.txt, sitemap.xml, canonical, JSON-LD 구조화 데이터, 중복 h1 가능성을 함께 점검했습니다.',
      criteria: '검색엔진이 페이지를 안정적으로 수집하고 페이지 목적을 해석할 수 있도록 크롤링 보조 파일과 구조화 데이터 구성을 권장합니다.',
      result: hasCrawlRisk
        ? '데모 기준 robots/sitemap 또는 JSON-LD 보조 정보가 부족할 가능성이 있습니다.'
        : '크롤링 보조 항목과 구조화 데이터 구성이 양호한 상태로 분류했습니다.',
      improvement: '검색 노출이 중요한 페이지라면 robots.txt, sitemap.xml, canonical, JSON-LD를 점검하고 Search Console에서 색인 상태를 확인하세요.'
    },
    {
      name: '문서 구조 / 뷰포트 검사',
      status: hasDocumentStructureRisk ? 'WARN' : 'PASS',
      severity: hasDocumentStructureRisk ? 'Minor' : 'None',
      summary: hasDocumentStructureRisk ? 'html lang, viewport, heading 구조 중 일부 확인이 필요합니다.' : '문서 언어, viewport, heading 구조가 기본 기준에 맞는 상태입니다.',
      checked: 'html lang, viewport meta, h1/h2 계층, landmark 역할처럼 기본 문서 구조 품질을 점검했습니다.',
      criteria: '모바일 렌더링을 위한 viewport가 있어야 하며, 페이지 언어와 제목 계층이 명확해야 합니다.',
      result: hasDocumentStructureRisk
        ? '데모 분석 기준 문서 구조 보조 항목 중 일부가 부족할 가능성이 있습니다.'
        : '데모 분석 기준 문서 구조와 모바일 렌더링 기본 구성이 양호한 상태로 분류했습니다.',
      improvement: 'html lang="ko", meta viewport, 단일 h1, 순차적인 heading 구조, main/nav/footer 같은 landmark를 유지하세요.'
    },
    {
      name: '외부 링크 보안 검사',
      status: hasExternalLinkSecurityRisk ? 'WARN' : 'PASS',
      severity: hasExternalLinkSecurityRisk ? 'Minor' : 'None',
      summary: hasExternalLinkSecurityRisk ? '새 창 외부 링크의 rel 보안 속성 확인이 필요합니다.' : '외부 링크 보안 속성이 기본 범위로 구성된 상태입니다.',
      checked: 'target="_blank" 외부 링크에 rel="noopener noreferrer"가 제공되는지 확인했습니다.',
      criteria: '새 창으로 열리는 외부 링크는 opener 접근을 막기 위해 rel 보안 속성을 포함해야 합니다.',
      result: hasExternalLinkSecurityRisk
        ? '일부 외부 링크에서 noopener/noreferrer 누락 가능성이 있어 보안 및 UX 확인이 필요합니다.'
        : '외부 링크 새 창 처리와 보안 속성이 적정한 상태로 판정했습니다.',
      improvement: '외부 링크가 새 창으로 열릴 경우 rel="noopener noreferrer"를 추가하고, 사용자가 이동을 예측할 수 있는 링크 텍스트를 제공하세요.'
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

  applyFriendlyCopy(items);
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
      brokenLinks,
      lcpMs,
      inpMs,
      clsValue,
      liveProbe: reachability.ok,
      confidence: profile.confidence
    },
    inspectionMode: reachability.ok ? 'Demo engine + browser reachability probe' : 'Demo engine fallback',
    confidence: profile.confidence,
    items

  };
}

function applyFriendlyCopy(items) {
  const friendlyCopy = {
    '페이지 접속 검사': {
      summary: {
        PASS: '입력한 주소로 페이지가 정상적으로 열립니다.',
        WARN: '페이지는 열리지만 일부 확인이 필요합니다.',
        FAIL: '입력한 주소로 페이지를 열지 못할 가능성이 있습니다.'
      },
      checked: '사용자가 입력한 웹사이트 주소로 실제 페이지가 열리는지 확인합니다.',
      criteria: '주소가 올바르고, 사이트가 정상 배포되어 있으며, 브라우저에서 페이지가 열리면 정상으로 봅니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 페이지 진입에 큰 문제는 없습니다.',
        WARN: '현재 데모 결과 기준으로 접속은 가능하지만 일부 환경에서 느리거나 불안정할 수 있습니다.',
        FAIL: '현재 데모 결과 기준으로 주소 오류, 배포 중단, 사이트 차단 등으로 페이지 접속이 어려울 수 있습니다.'
      },
      improvement: '주소 오타, 배포 상태, HTTPS 인증서, 호스팅 장애 여부를 먼저 확인하세요.'
    },
    '메타데이터 검사': {
      summary: {
        PASS: '검색과 공유에 필요한 기본 설명 정보가 준비되어 있습니다.',
        WARN: '검색 결과나 메신저 공유 화면에 필요한 설명 정보가 일부 부족할 수 있습니다.',
        FAIL: '검색과 공유에 필요한 기본 정보가 거의 없어 페이지 설명이 제대로 보이지 않을 수 있습니다.'
      },
      checked: '브라우저 제목, 검색 결과 설명, 공유용 제목, 공유용 이미지, 대표 제목이 있는지 확인합니다.',
      criteria: '페이지 제목과 설명이 있어야 사용자가 검색 결과나 공유 링크를 봤을 때 어떤 페이지인지 이해할 수 있습니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 페이지를 설명하는 기본 정보가 잘 준비되어 있습니다.',
        WARN: '현재 데모 결과 기준으로 페이지 설명 또는 공유 이미지 같은 정보가 일부 부족할 수 있습니다.',
        FAIL: '현재 데모 결과 기준으로 페이지를 설명하는 정보가 부족해 검색/공유 품질이 떨어질 수 있습니다.'
      },
      improvement: '페이지 목적을 한 문장으로 설명하는 소개 문구와 공유용 대표 이미지를 추가하세요.'
    },
    '이미지 로딩 검사': {
      summary: {
        PASS: '페이지의 주요 이미지가 정상적으로 보이는 상태입니다.',
        WARN: '일부 이미지가 보이지 않을 가능성이 있습니다.',
        FAIL: '여러 이미지가 보이지 않아 화면 품질에 영향을 줄 수 있습니다.'
      },
      checked: '페이지 안의 이미지가 깨지지 않고 화면에 정상적으로 표시되는지 확인합니다.',
      criteria: '사용자에게 보여야 하는 이미지는 빈 칸이나 깨진 아이콘으로 나오지 않아야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 주요 이미지 표시에는 큰 문제가 없습니다.',
        WARN: '현재 데모 결과 기준으로 일부 이미지 경로나 파일 누락 가능성이 있습니다.',
        FAIL: '현재 데모 결과 기준으로 이미지가 많이 깨져 사용자가 화면을 정상적으로 보기 어려울 수 있습니다.'
      },
      improvement: '이미지 파일이 실제로 존재하는지, 파일 이름의 대소문자가 맞는지, 배포 경로가 올바른지 확인하세요.'
    },
    '이미지 대체 텍스트 검사': {
      summary: {
        PASS: '이미지를 설명하는 문구가 기본적으로 준비되어 있습니다.',
        WARN: '일부 이미지에 설명 문구가 부족할 수 있습니다.',
        FAIL: '이미지 설명 문구가 부족해 접근성 품질이 낮을 수 있습니다.'
      },
      checked: '이미지를 볼 수 없는 사용자나 화면 낭독기를 사용하는 사용자를 위해 이미지 설명 문구가 있는지 확인합니다.',
      criteria: '정보를 전달하는 이미지는 “무슨 이미지인지” 알 수 있는 짧은 설명이 있어야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 주요 이미지 설명 문구가 준비된 상태입니다.',
        WARN: '현재 데모 결과 기준으로 일부 이미지에 설명 문구가 빠졌을 수 있습니다.',
        FAIL: '현재 데모 결과 기준으로 이미지 설명이 많이 부족해 접근성 개선이 필요합니다.'
      },
      improvement: '프로젝트 썸네일, 배너, 버튼처럼 의미가 있는 이미지에는 사용자가 이해할 수 있는 설명을 넣으세요.'
    },
    '링크 유효성 검사': {
      summary: {
        PASS: '페이지의 주요 링크가 정상적으로 이동 가능한 상태입니다.',
        WARN: '일부 링크 주소를 다시 확인하는 것이 좋습니다.',
        FAIL: '깨진 링크가 있어 사용자가 원하는 페이지로 이동하지 못할 수 있습니다.'
      },
      checked: '버튼이나 텍스트 링크를 눌렀을 때 올바른 페이지로 이동할 수 있는지 확인합니다.',
      criteria: '클릭 가능한 링크는 비어 있지 않아야 하며, 없는 페이지나 잘못된 주소로 이동하면 안 됩니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 주요 링크 이동에는 큰 문제가 없습니다.',
        WARN: '현재 데모 결과 기준으로 일부 링크가 오래됐거나 잘못됐을 가능성이 있습니다.',
        FAIL: '현재 데모 결과 기준으로 깨진 링크가 있어 사용자 이동 흐름이 끊길 수 있습니다.'
      },
      improvement: '404가 나오는 주소, 삭제된 외부 페이지, 잘못된 상대 경로를 최신 주소로 수정하세요.'
    },
    '버튼/CTA 검사': {
      summary: {
        PASS: '주요 버튼이 사용자가 이해하기 쉬운 형태로 제공됩니다.',
        WARN: '일부 버튼의 의미가 불명확할 수 있습니다.',
        FAIL: '주요 버튼이 없거나 동작을 예측하기 어려워 사용성 문제가 생길 수 있습니다.'
      },
      checked: '검사 시작, 이동, 다운로드처럼 사용자가 눌러야 하는 주요 버튼이 잘 보이고 이해하기 쉬운지 확인합니다.',
      criteria: '버튼은 무엇을 하는 버튼인지 텍스트로 알 수 있어야 하며, 클릭 가능한 영역이 충분해야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 주요 버튼 구성은 양호합니다.',
        WARN: '현재 데모 결과 기준으로 일부 버튼이 아이콘만 있거나 설명이 부족할 수 있습니다.',
        FAIL: '현재 데모 결과 기준으로 주요 버튼 누락 또는 버튼 설명 부족 문제가 큽니다.'
      },
      improvement: '아이콘만 있는 버튼에는 설명을 추가하고, 주요 버튼 문구는 “검사 시작”, “다운로드”처럼 행동이 바로 보이게 작성하세요.'
    },
    '반응형 UI 검사': {
      summary: {
        PASS: 'PC와 모바일 화면에서 레이아웃이 안정적으로 보입니다.',
        WARN: '모바일에서 일부 영역이 밀리거나 잘릴 수 있습니다.',
        FAIL: '모바일 화면에서 주요 내용이 깨져 사용자가 보기 어려울 수 있습니다.'
      },
      checked: 'PC와 모바일 화면 크기에서 내용이 잘리지 않고 자연스럽게 정렬되는지 확인합니다.',
      criteria: '모바일에서도 옆으로 밀리는 화면이 없어야 하며, 버튼과 글자가 겹치지 않아야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 PC/모바일 화면 모두 큰 깨짐 없이 보입니다.',
        WARN: '현재 데모 결과 기준으로 일부 긴 문구나 카드가 모바일에서 밀릴 수 있습니다.',
        FAIL: '현재 데모 결과 기준으로 모바일 화면 깨짐이 커서 수정이 필요합니다.'
      },
      improvement: '고정 너비를 줄이고, 모바일에서는 카드와 버튼이 한 줄 또는 한 열로 자연스럽게 내려가도록 조정하세요.'
    },
    '콘솔 에러 검사': {
      summary: {
        PASS: '페이지 내부 오류가 감지되지 않은 상태입니다.',
        WARN: '페이지 내부 오류가 일부 있을 수 있어 확인이 필요합니다.',
        FAIL: '페이지 내부 오류가 기능 동작에 영향을 줄 수 있습니다.'
      },
      checked: '브라우저가 페이지를 실행하면서 발생하는 오류 메시지와 필요한 파일을 불러오지 못한 문제를 확인합니다.',
      criteria: '사용자가 보는 기능이 멈추거나 버튼이 동작하지 않게 만드는 오류가 없어야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 기능을 막는 오류는 확인되지 않았습니다.',
        WARN: '현재 데모 결과 기준으로 일부 오류 메시지가 있을 수 있어 확인이 필요합니다.',
        FAIL: '현재 데모 결과 기준으로 기능 안정성에 영향을 줄 수 있는 오류가 있습니다.'
      },
      improvement: '브라우저 개발자 도구의 Console 탭에서 빨간 오류를 확인하고, 누락된 파일이나 잘못된 코드부터 수정하세요.'
    },
    '접근성 기본 검사': {
      summary: {
        PASS: '마우스나 화면 낭독기 없이도 기본 사용이 가능한 상태입니다.',
        WARN: '일부 버튼이나 입력칸 설명을 보완하는 것이 좋습니다.',
        FAIL: '보조 도구를 사용하는 사용자가 페이지를 이용하기 어려울 수 있습니다.'
      },
      checked: '버튼 이름, 입력칸 설명, 이미지 설명, 색상 대비처럼 다양한 사용자가 페이지를 이해할 수 있는지 확인합니다.',
      criteria: '눈으로 보기 어렵거나 키보드만 사용하는 사용자도 주요 기능을 이해하고 사용할 수 있어야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 기본 접근성은 양호합니다.',
        WARN: '현재 데모 결과 기준으로 일부 버튼이나 입력칸 설명이 부족할 수 있습니다.',
        FAIL: '현재 데모 결과 기준으로 접근성 보완이 많이 필요합니다.'
      },
      improvement: '버튼에는 명확한 이름을 넣고, 입력칸에는 어떤 값을 넣어야 하는지 설명을 연결하세요.'
    },
    'SEO 기본 검사': {
      summary: {
        PASS: '검색엔진이 페이지 내용을 이해하기 쉬운 상태입니다.',
        WARN: '검색 결과에 보이는 제목이나 설명을 조금 더 다듬는 것이 좋습니다.',
        FAIL: '검색엔진이 페이지 내용을 이해하기 어려워 노출 품질이 낮을 수 있습니다.'
      },
      checked: '검색 결과에 표시될 제목, 설명, 대표 제목, 중복 주소 정리 여부를 확인합니다.',
      criteria: '페이지마다 고유한 제목과 설명이 있어야 검색 결과에서 사용자가 내용을 예측할 수 있습니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 검색 기본 정보가 적절합니다.',
        WARN: '현재 데모 결과 기준으로 제목 길이, 설명 문구, 대표 주소 정보 중 일부를 확인하는 것이 좋습니다.',
        FAIL: '현재 데모 결과 기준으로 검색 기본 정보가 많이 부족합니다.'
      },
      improvement: '페이지마다 다른 제목과 설명을 작성하고, 중복 페이지가 있다면 대표 주소를 명확히 설정하세요.'
    },
    '리소스 로딩 검사': {
      summary: {
        PASS: '페이지를 구성하는 파일들이 정상적으로 불러와지는 상태입니다.',
        WARN: '일부 화면 구성 파일이 늦게 불러와지거나 실패할 수 있습니다.',
        FAIL: '필수 파일이 불러와지지 않아 화면이나 기능이 깨질 수 있습니다.'
      },
      checked: '화면을 만드는 스타일 파일, 동작을 담당하는 스크립트 파일, 폰트, 이미지가 정상적으로 불러와지는지 확인합니다.',
      criteria: '필수 파일이 누락되면 화면이 깨지거나 버튼이 동작하지 않을 수 있으므로 모두 정상적으로 불러와져야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 필수 파일 로딩에는 큰 문제가 없습니다.',
        WARN: '현재 데모 결과 기준으로 일부 파일 로딩 지연 또는 실패 가능성이 있습니다.',
        FAIL: '현재 데모 결과 기준으로 필수 파일 로딩 실패 가능성이 큽니다.'
      },
      improvement: '파일 경로, 배포 위치, CDN 연결 상태를 확인하고 불러오지 못한 파일부터 수정하세요.'
    },
    'Core Web Vitals 성능 검사': {
      summary: {
        PASS: '사용자가 느끼는 페이지 속도와 화면 안정성이 양호합니다.',
        WARN: '첫 화면 표시 속도, 클릭 반응, 화면 흔들림 중 일부 개선이 필요할 수 있습니다.',
        FAIL: '페이지가 느리거나 화면이 흔들려 사용자 경험이 크게 떨어질 수 있습니다.'
      },
      checked: '페이지가 빨리 보이는지, 클릭했을 때 바로 반응하는지, 로딩 중 화면이 갑자기 밀리지 않는지 확인합니다.',
      criteria: '사용자가 기다리지 않고 자연스럽게 사용할 수 있을 정도로 로딩과 반응이 빨라야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 체감 속도는 안정적인 편입니다.',
        WARN: '현재 데모 결과 기준으로 이미지 크기, 스크립트 양, 폰트 로딩 때문에 체감 속도가 떨어질 수 있습니다.',
        FAIL: '현재 데모 결과 기준으로 체감 속도 문제가 커서 우선 개선이 필요합니다.'
      },
      improvement: '큰 이미지를 압축하고, 불필요한 스크립트를 줄이고, 화면이 밀리지 않도록 이미지와 광고 영역 크기를 미리 잡아두세요.'
    },
    'HTTPS / 혼합 콘텐츠 검사': {
      summary: {
        PASS: '보안 연결 상태가 정상입니다.',
        WARN: '안전한 페이지 안에 안전하지 않은 파일이 섞였을 수 있습니다.',
        FAIL: '보안 연결이 적용되지 않아 사용자 신뢰와 브라우저 경고에 영향을 줄 수 있습니다.'
      },
      checked: '주소가 안전한 https로 시작하는지, 안전한 페이지 안에 http 파일이 섞여 있지 않은지 확인합니다.',
      criteria: '공개 웹사이트는 안전한 연결을 사용해야 하며, 이미지나 스크립트도 안전한 주소로 불러오는 것이 좋습니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 보안 연결에는 큰 문제가 없습니다.',
        WARN: '현재 데모 결과 기준으로 일부 외부 파일 주소가 안전하지 않을 수 있습니다.',
        FAIL: '현재 데모 결과 기준으로 보안 연결 설정을 우선 확인해야 합니다.'
      },
      improvement: '사이트 주소와 이미지, 스크립트, 폰트 주소가 모두 https로 시작하는지 확인하세요.'
    },
    '보안 헤더 검사': {
      summary: {
        PASS: '브라우저 보안 설정이 기본적으로 준비된 상태입니다.',
        WARN: '일부 보안 설정을 추가하면 더 안전합니다.',
        FAIL: '기본 보안 설정 부족으로 보안 위험이 커질 수 있습니다.'
      },
      checked: '브라우저에게 “이 페이지를 어떻게 안전하게 열어야 하는지” 알려주는 기본 보안 설정이 있는지 확인합니다.',
      criteria: '외부 스크립트 악용, 잘못된 사이트 삽입, 정보 노출을 줄이기 위한 기본 보안 설정이 권장됩니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 기본 보안 설정은 양호합니다.',
        WARN: '현재 데모 결과 기준으로 일부 보안 설정을 추가하는 것이 좋습니다.',
        FAIL: '현재 데모 결과 기준으로 보안 설정 부족 문제가 큽니다.'
      },
      improvement: '호스팅 설정에서 콘텐츠 보호, 외부 삽입 방지, 정보 노출 제한 같은 기본 보안 옵션을 추가하세요.'
    },
    '키보드 포커스 검사': {
      summary: {
        PASS: '키보드만으로도 주요 버튼과 링크를 사용할 수 있는 상태입니다.',
        WARN: '키보드 이동 위치가 잘 보이지 않는 요소가 있을 수 있습니다.',
        FAIL: '키보드만으로 페이지 이용이 어려울 수 있습니다.'
      },
      checked: 'Tab 키를 눌렀을 때 버튼과 링크로 자연스럽게 이동하고, 현재 선택된 위치가 눈에 보이는지 확인합니다.',
      criteria: '마우스 없이도 주요 기능을 사용할 수 있어야 하며, 현재 어디를 선택했는지 표시되어야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 키보드 이동은 기본적으로 양호합니다.',
        WARN: '현재 데모 결과 기준으로 일부 요소의 선택 표시가 약할 수 있습니다.',
        FAIL: '현재 데모 결과 기준으로 키보드 사용성이 낮아 수정이 필요합니다.'
      },
      improvement: '키보드로 이동했을 때 테두리나 강조 표시가 보이도록 하고, 메뉴와 팝업도 키보드로 닫을 수 있게 만드세요.'
    },
    '폼 유효성 / 입력 접근성 검사': {
      summary: {
        PASS: '입력칸 안내와 오류 메시지가 기본적으로 준비된 상태입니다.',
        WARN: '일부 입력칸의 설명이나 오류 안내가 부족할 수 있습니다.',
        FAIL: '사용자가 무엇을 입력해야 하는지 알기 어려울 수 있습니다.'
      },
      checked: '입력칸에 이름표가 있는지, 필수 입력 표시가 있는지, 잘못 입력했을 때 이해하기 쉬운 안내가 나오는지 확인합니다.',
      criteria: '사용자가 입력칸의 목적과 오류 이유를 바로 이해할 수 있어야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 입력칸 안내는 기본적으로 양호합니다.',
        WARN: '현재 데모 결과 기준으로 일부 입력칸 설명이나 오류 안내를 보완하는 것이 좋습니다.',
        FAIL: '현재 데모 결과 기준으로 입력칸 사용성 문제가 큽니다.'
      },
      improvement: '입력칸 위나 옆에 설명을 넣고, 잘못 입력했을 때 “무엇을 어떻게 고쳐야 하는지” 구체적으로 보여주세요.'
    },
    '크롤링 / 구조화 데이터 검사': {
      summary: {
        PASS: '검색엔진이 페이지를 수집하고 이해하는 데 필요한 보조 정보가 양호합니다.',
        WARN: '검색엔진 수집을 돕는 정보가 일부 부족할 수 있습니다.',
        FAIL: '검색엔진이 페이지를 수집하거나 이해하기 어려울 수 있습니다.'
      },
      checked: '검색엔진이 사이트를 잘 찾아가고 페이지 내용을 이해하도록 돕는 보조 정보가 있는지 확인합니다.',
      criteria: '검색 노출이 중요한 페이지는 사이트맵, 수집 허용 정보, 페이지 의미를 설명하는 데이터가 있으면 좋습니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 검색 수집 보조 정보는 양호합니다.',
        WARN: '현재 데모 결과 기준으로 사이트맵이나 페이지 의미 설명 정보를 보완하는 것이 좋습니다.',
        FAIL: '현재 데모 결과 기준으로 검색 수집 관련 정보가 부족합니다.'
      },
      improvement: '사이트맵과 검색엔진 수집 설정을 확인하고, 주요 페이지에는 페이지 성격을 설명하는 정보를 추가하세요.'
    },
    '문서 구조 / 뷰포트 검사': {
      summary: {
        PASS: '페이지 기본 구조와 모바일 표시 기준이 잘 잡혀 있습니다.',
        WARN: '페이지 언어, 제목 순서, 모바일 표시 기준 중 일부 확인이 필요합니다.',
        FAIL: '페이지 기본 구조가 부족해 모바일 표시나 접근성에 문제가 생길 수 있습니다.'
      },
      checked: '페이지 언어, 모바일 화면 기준, 큰 제목과 작은 제목의 순서가 자연스러운지 확인합니다.',
      criteria: '브라우저와 검색엔진이 페이지 구조를 이해할 수 있도록 언어, 모바일 기준, 제목 순서가 명확해야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 문서 구조는 양호합니다.',
        WARN: '현재 데모 결과 기준으로 페이지 구조 보조 정보를 일부 보완하는 것이 좋습니다.',
        FAIL: '현재 데모 결과 기준으로 기본 문서 구조가 부족합니다.'
      },
      improvement: '페이지 언어를 설정하고, 모바일 화면 기준을 넣고, 제목은 큰 제목에서 작은 제목 순서로 자연스럽게 배치하세요.'
    },
    '외부 링크 보안 검사': {
      summary: {
        PASS: '새 창으로 열리는 외부 링크가 안전하게 처리되는 상태입니다.',
        WARN: '일부 외부 링크의 새 창 열기 설정을 확인하는 것이 좋습니다.',
        FAIL: '외부 링크 설정 부족으로 보안 또는 사용성 문제가 생길 수 있습니다.'
      },
      checked: '다른 사이트로 새 창이 열릴 때 원래 페이지에 영향을 주지 않도록 안전하게 처리되는지 확인합니다.',
      criteria: '새 창으로 외부 사이트를 열 때는 원래 페이지가 외부 사이트에 의해 조작되지 않도록 보호 설정을 넣는 것이 좋습니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 외부 링크 처리는 양호합니다.',
        WARN: '현재 데모 결과 기준으로 일부 외부 링크의 새 창 보안 설정을 보완하는 것이 좋습니다.',
        FAIL: '현재 데모 결과 기준으로 외부 링크 보안 설정 문제가 큽니다.'
      },
      improvement: '새 창으로 열리는 외부 링크에는 안전 설정을 추가하고, 링크 문구도 사용자가 이동할 곳을 알 수 있게 작성하세요.'
    },
    'QA 리포트 산출물 검사': {
      summary: {
        PASS: '검사 결과를 보고서 형태로 정리할 수 있습니다.',
        WARN: '보고서에 추가 정보가 있으면 더 좋습니다.',
        FAIL: '검사 결과를 공유하기 어려운 상태입니다.'
      },
      checked: '검사 결과가 점수, 상태, 문제 설명, 개선 방법, 다운로드 파일로 정리되는지 확인합니다.',
      criteria: 'QA 결과는 다른 사람이 봐도 문제와 수정 방향을 이해할 수 있어야 합니다.',
      result: {
        PASS: '현재 데모 결과 기준으로 리포트 산출물 구성이 양호합니다.',
        WARN: '현재 데모 결과 기준으로 담당자, 브라우저 정보, 스크린샷 경로를 추가하면 더 좋습니다.',
        FAIL: '현재 데모 결과 기준으로 리포트 산출물 구성이 부족합니다.'
      },
      improvement: '실제 업무용으로 확장할 때는 검사 실행 ID, 담당자, 브라우저 버전, 스크린샷을 함께 저장하세요.'
    }
  };

  items.forEach((item) => {
    const copy = friendlyCopy[item.name];
    if (!copy) return;

    item.summary = copy.summary[item.status] || item.summary;
    item.checked = copy.checked;
    item.criteria = copy.criteria;
    item.result = copy.result[item.status] || item.result;
    item.improvement = copy.improvement;
  });
}

async function probeReachability(url) {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, mode: 'URL protocol validation' };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? window.setTimeout(() => controller.abort(), 1200) : null;

  try {
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    });
    return { ok: true, mode: 'browser no-cors probe' };
  } catch (error) {
    return { ok: false, mode: 'browser no-cors probe' };
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function buildInspectionProfile(parsed, seed) {
  const isGithubPages = /\.github\.io$/i.test(parsed.hostname);
  const isKnownPortfolio = parsed.hostname === 'gw0212.github.io';
  const path = parsed.pathname.toLowerCase();

  const base = {
    imageCount: 6 + (seed % 11),
    internalLinks: 4 + (seed % 18),
    externalLinks: 2 + (seed % 7),
    consoleErrors: seed % 4 === 0 ? 2 : seed % 5 === 0 ? 1 : 0,
    brokenImages: seed % 6 === 0 ? 2 : seed % 4 === 0 ? 1 : 0,
    brokenLinks: seed % 5 === 0 ? 2 : seed % 7 === 0 ? 1 : 0,
    hasOgImage: seed % 3 !== 0,
    hasDescription: seed % 4 !== 1,
    hasMobileOverflow: seed % 6 === 2,
    lcpMs: 1500 + (seed % 2600),
    inpMs: 80 + (seed % 260),
    clsValue: Number(((seed % 22) / 100).toFixed(2)),
    hasSecurityHeaderRisk: seed % 4 === 2,
    hasMixedContentRisk: seed % 6 === 5,
    hasKeyboardFocusRisk: seed % 5 === 2,
    hasFormRisk: seed % 6 === 3,
    hasCrawlRisk: seed % 4 === 0,
    hasDocumentStructureRisk: seed % 5 === 1,
    hasExternalLinkSecurityRisk: seed % 6 === 1,
    confidence: 74
  };

  if (isGithubPages) {
    Object.assign(base, {
      consoleErrors: 0,
      brokenImages: 0,
      brokenLinks: 0,
      hasDescription: true,
      hasOgImage: true,
      hasMobileOverflow: false,
      lcpMs: 1150 + (seed % 900),
      inpMs: 70 + (seed % 90),
      clsValue: Number(((seed % 8) / 100).toFixed(2)),
      hasSecurityHeaderRisk: true,
      hasMixedContentRisk: false,
      hasFormRisk: path === '/' ? false : seed % 8 === 3,
      hasCrawlRisk: path !== '/',
      hasDocumentStructureRisk: seed % 7 === 2,
      hasExternalLinkSecurityRisk: seed % 9 === 1,
      confidence: 86
    });
  }

  if (isKnownPortfolio) {
    Object.assign(base, {
      imageCount: path.includes('nexus_play') ? 14 : path.includes('image_converter') ? 8 : path.includes('2048') ? 5 : 10,
      internalLinks: path === '/' ? 18 : 7 + (seed % 8),
      externalLinks: path === '/' ? 6 : 2 + (seed % 4),
      hasKeyboardFocusRisk: path.includes('2048') || path.includes('perfect_stop'),
      hasCrawlRisk: path !== '/',
      confidence: 90
    });
  }

  return base;
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function calculateScore(items) {
  const statusPenalty = { PASS: 0, WARN: 2, FAIL: 7 };
  const severityPenalty = { None: 0, Minor: 1.5, Major: 5, Critical: 12 };
  const categoryWeight = {
    '페이지 접속 검사': 1.3,
    '링크 유효성 검사': 1.2,
    '콘솔 에러 검사': 1.25,
    'HTTPS / 혼합 콘텐츠 검사': 1.25,
    'Core Web Vitals 성능 검사': 1.1
  };

  const totalPenalty = items.reduce((sum, item) => {
    const weight = categoryWeight[item.name] || 1;
    return sum + ((statusPenalty[item.status] || 0) + (severityPenalty[item.severity] || 0)) * weight;
  }, 0);

  const failCount = items.filter((item) => item.status === 'FAIL').length;
  const criticalCount = items.filter((item) => item.severity === 'Critical').length;
  const adjusted = 100 - totalPenalty - Math.max(0, failCount - 1) * 4 - Math.max(0, criticalCount - 1) * 6;
  return Math.max(0, Math.min(100, Math.round(adjusted)));
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
  renderPriority(report);
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

function renderPriority(report) {
  const severityRank = { Critical: 4, Major: 3, Minor: 2, None: 1 };
  const statusRank = { FAIL: 3, WARN: 2, PASS: 1 };
  const issues = report.items
    .filter((item) => item.status !== 'PASS' || item.severity !== 'None')
    .sort((a, b) => (severityRank[b.severity] - severityRank[a.severity]) || (statusRank[b.status] - statusRank[a.status]))
    .slice(0, 3);

  const issueHtml = issues.length
    ? issues.map((item, index) => `
      <article class="priority-item">
        <span class="priority-rank">TOP ${index + 1}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <div class="badge-row">${badge(item.status)}${badge(item.severity)}</div>
      </article>
    `).join('')
    : `<article class="priority-item priority-clear"><span class="priority-rank">CLEAR</span><h3>우선 수정 필요 이슈 없음</h3><p>현재 결과 기준으로 Critical/Major급 선행 조치 항목은 없습니다.</p></article>`;

  priorityCard.innerHTML = `
    <div class="priority-head">
      <span>Priority Actions</span>
      <h2>우선 수정 권장 이슈</h2>
      <p>FAIL과 심각도가 높은 항목을 먼저 정리했습니다. 면접이나 포트폴리오 설명 시 “이슈 우선순위 판단” 근거로 쓰기 좋습니다.</p>
    </div>
    <div class="priority-grid">${issueHtml}</div>
    <div class="environment-strip" aria-label="검사 환경 정보">
      <span>Prototype Engine</span>
      <span>Desktop 1440px</span>
      <span>Mobile 390px</span>
      <span>Report Schema v1</span>
    </div>
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

function buildPlainSummary(report) {
  const topIssues = report.items
    .filter((item) => item.status !== 'PASS' || item.severity !== 'None')
    .slice(0, 5)
    .map((item, index) => `${index + 1}. [${item.status}/${item.severity}] ${item.name} - ${item.summary}`)
    .join('\n') || '우선 수정 필요 이슈 없음';

  return [
    'Web QA Auto Inspector Report',
    `검사 대상: ${report.url}`,
    `검사 시간: ${report.testedAtLabel}`,
    `전체 점수: ${report.score} / ${report.status}`,
    `PASS: ${report.summary.PASS}, WARN: ${report.summary.WARN}, FAIL: ${report.summary.FAIL}`,
    `Critical: ${report.summary.Critical}, Major: ${report.summary.Major}, Minor: ${report.summary.Minor}`,
    '',
    '[우선 수정 권장 이슈]',
    topIssues
  ].join('\n');
}

function buildHtmlReport(report) {
  const topRows = report.items
    .filter((item) => item.status !== 'PASS' || item.severity !== 'None')
    .slice(0, 5)
    .map((item) => `<li><strong>${escapeHtml(item.name)}</strong> <span>${escapeHtml(item.status)} / ${escapeHtml(item.severity)}</span><p>${escapeHtml(item.summary)}</p></li>`)
    .join('') || '<li><strong>우선 수정 필요 이슈 없음</strong><p>현재 결과 기준으로 선행 조치 항목은 없습니다.</p></li>';

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
    .top-issues { margin: 24px 0 4px; padding: 22px; border: 1px solid #dbeafe; border-radius: 18px; background: #f8fbff; }
    .top-issues h2 { margin: 0 0 14px; text-align: center; font-size: 22px; }
    .top-issues ol { margin: 0; padding-left: 22px; }
    .top-issues li { margin: 0 0 12px; line-height: 1.55; }
    .top-issues span { color: #1d4ed8; font-weight: 800; margin-left: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { text-align: left; padding: 14px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    th { font-size: 12px; color: #667085; text-transform: uppercase; }
    td { font-size: 14px; line-height: 1.55; }
    @media print { body { background: white; padding: 0; } .wrap { box-shadow: none; border-radius: 0; } }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="report-head">
      <h1>Web QA Auto Inspector Report</h1>
      <p class="meta">검사 대상: ${escapeHtml(report.url)}<br />검사 시간: ${escapeHtml(report.testedAtLabel)}</p>
      <div class="score"><span>Overall Score</span><strong>${report.score}</strong><span>${escapeHtml(report.status)}</span></div>
    </section>
    <section class="top-issues"><h2>우선 수정 권장 이슈</h2><ol>${topRows}</ol></section>
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
