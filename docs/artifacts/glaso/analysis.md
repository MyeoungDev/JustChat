# Glaso REA 분석 기록

## 범위와 결론

분석 대상은 Glaso for macOS의 공개 웹사이트와 사이트 안에 있는 조작형 제품 데모다. Glaso 앱 바이너리나 소스 코드는 확보되지 않았으므로 앱 내부 구현, 실제 창 레벨, 전역 단축키 등록 방식, WebKit 설정, 저장 구조를 역공학했다고 주장하지 않는다. 이 기록은 공개 제품 설명, REA로 관찰한 웹 데모, REA 정적 분석 범위를 구분한다.

Glaso는 메뉴 막대 드롭다운 브라우저가 아니라, 다른 앱 위에 놓고 필요할 때 전역 단축키로 보이거나 숨기는 독립 플로팅 창으로 설명된다. 공개 제품 기능 중 Just Browse 설계에 직접 참고할 만한 핵심은 전역 표시/숨김, 항상 위 및 전체 화면 위 표시, Spaces 동작 설정, 투명도, 크롬 없는 모드, 위치·크기 프리셋, 그리고 이 기능을 앱 창의 브라우저와 일관된 단축키로 조작하는 구조다.

## REA 환경과 산출물

- REA CLI: `rea@6.10.1`; Node.js `24.22.1`로 실행했다. 시스템 기본 Node `24.15.0`은 REA의 최소 버전 요구를 충족하지 않아 사용할 수 없었다.
- REA controlled replay: 격리된 프로세스에서 Chromium `158.0.8127.37`을 실행해 `https://glaso.app/`의 Browser → Mirror → Notes → Browser 버튼 흐름을 수행했다. 다섯 체크포인트의 스크린샷, DOM, 접근성 트리를 캡처했고 모두 완료됐다.
- 캡처 Evidence: `ev_a3ee945d92f36ab3acd82e30310c5009873fee64dbb69a2bd03b9a841a6b2c67` (`authority=controlled-replay`). 환경의 OS/아키텍처는 관찰되지 않았다.
- 상호작용 캡처: [`rea-interaction-capture.json`](rea-interaction-capture.json)
- 간단 캡처: [`rea-capture-summary.json`](rea-capture-summary.json)
- REA web-bundle 분석: 소개 페이지의 스크립트 6개를 정적으로 파싱했고 6개 모두 분석됐다. 파싱 실패 0, endpoint 후보 0, route 0. Evidence `ev_e306f8dad952d8157cef48eab060733b05df005c5420f44fb4bb35fe1b7ebb3f`; 요약 view Evidence `ev_a1eb69af0df8f5ada3f9a6cf3bd3b35a3671976acf0dd1b9b5b8ab2cd409778d`.
- 이 웹 번들 분석은 수집된 JavaScript를 실행하지 않는 정적 분석이다. 사이트 스크립트가 Glaso 데스크톱 앱의 코드라는 근거는 없으며, 앱 아키텍처에 대한 결론으로 사용하지 않는다.
- 다운로드 경로 확인: 공식 홈페이지의 `Download for Mac` 링크는 현재 Mac App Store를 가리킨다. 홈페이지 FAQ는 향후/별도 `glaso.app` 직접 배포판이 App Store판과 달리 Mirror Interact를 추가한다고 설명하지만, 현재 공개 페이지에서 직접 `.dmg`/`.zip` 다운로드 URL은 확인하지 못했다. 따라서 웹사이트에서 지금 받을 수 있는 설치 파일은 발견되지 않았다. Mac App Store판은 Mirror의 조작이 원본 창에서 이뤄지는 read-only mirror로 설명된다.
- REA 전체 튜토리얼 재생: 공식 `/es/tour/`의 5개 코드 애니메이션 강의를 강의 선택 시 시작되는 자동재생으로 끝까지 재생했다. 16단계 전부 완료, 총 재생 시간 약 2분 25초, capture completeness `complete`, `equality_eligible=true`. Evidence `ev_2ef92afef480b1097f164ba0b69a39b974d8b982e06fe41fe28a8795d3feb017`. 강의 선택 직후 player가 자동 재생되는 상태를 접근성 트리로 확인한 뒤 전체 타이밍을 기다렸다. 이전 버튼 토글을 포함한 불완전 재생 캡처는 최종 근거로 사용하지 않는다.
- 완주 시점 프레임은 [`tour-frame-01.png`](tour-frame-01.png) 기본 호출/투명도/Spaces, [`tour-frame-02.png`](tour-frame-02.png) 창 위치, [`tour-frame-03.png`](tour-frame-03.png) 브라우저/로컬 영상, [`tour-frame-04.png`](tour-frame-04.png) Window Mirror, [`tour-frame-05.png`](tour-frame-05.png) Notes/Reader다. 재생 입력은 [`rea-tour-full-playback-scenario-v2.json`](rea-tour-full-playback-scenario-v2.json), 전체 bundle은 [`rea-tour-full-playback-v2.json`](rea-tour-full-playback-v2.json).
- REA 튜토리얼 web-bundle: `/es/tour/` 페이지에서 스크립트 7개를 캡처·정적으로 분석했다. 7개 파싱, 실패 0, AST node 29,442, endpoint·route 후보 0. Evidence `ev_f061fea15e859a54ab2bd8d34b2414d53cfebf38526119283215adbc14543dd4`; summary view `ev_3a43f0657c2c6cef625b591e112613b59e0125f7bd8ac9ad9a6b0bab9a7f425f`. `tour.js`는 웹 튜토리얼 재생기 코드이며 Glaso 앱 코드가 아니다. [`rea-tour-web-bundle.json`](rea-tour-web-bundle.json).
- 웹 번들 Evidence 저장: [`rea-web-bundle.json`](rea-web-bundle.json)

## REA로 관찰한 웹 데모

접근성 트리의 컨트롤 그룹은 샘플 창을 드래그하거나 화살표 키로 이동할 수 있고 Escape로 원위치하는 시나리오를 설명한다. Browser, Mirror, Notes 버튼은 각각 눌린 상태가 바뀌었고 이미지 대체 텍스트도 각 모드 이름으로 바뀌었다. 이는 웹 페이지에 구현된 제품 소개 데모의 UI 상태 전환을 관찰한 것이다. 실제 Glaso 앱의 브라우징, 화면 미러링, 노트 기능 동작 증거는 아니다.

데모 시작 화면은 Glaso 창이 다른 앱의 창 위에 놓인다는 설명, macOS 13 이상, 9개 언어, Option+G 전역 호출 안내와 App Store 다운로드 링크를 노출한다. 이런 문구는 REA 캡처에 기록됐으며 기능의 실제 런타임 구현을 독립 검증한 것은 아니다.

## 공개 제품 설명에서 확인한 기능

공식 홈페이지와 지원 문서는 Glaso의 동작 및 기본 단축키를 다음처럼 설명한다.

| 영역 | 공개 설명 | Just Browse에 참고할 점 |
|---|---|---|
| 창 모델 | 데스크톱 창 위, 전체 화면 앱 위에 뜨는 작은 창. Option+G로 어느 앱에서나 표시/숨김 | 메뉴 막대 패널과 일반 창을 동일한 브라우저 상태로 토글하는 플로팅 창 모드가 제품의 중심이어야 함 |
| Spaces | Follow를 끄면 자체 Space에 남고 켜면 사용자가 이동하는 Space를 따라감 | “항상 위”와 “모든 Space 따라가기”는 별도 설정·단축키로 노출 |
| 화면 점유 | opacity 조정, Clean mode로 창 크롬 숨기기 | 투명도와 미니멀/크롬리스 표시를 전역 키로 빠르게 제어 |
| 배치 | 5개 창 프리셋 저장·호출, 전역 화살표 키로 이동 | 창 위치/크기 프리셋과 미세 이동 제공 |
| 입력 | Click-through로 밑 앱에 클릭 전달, 앱 음소거 및 볼륨 제어 | 상호작용/클릭 통과 모드의 명확한 토글과 키보드 접근 제공 |
| Browser | 탭, 기록, 확대/축소, 찾기, 음소거, 자동 새로고침, 로컬 비디오 | 플로팅 브라우저에서 핵심 탐색 단축키가 앱 전역 단축키와 충돌하지 않도록 설계 |
| 제한 | DRM 서비스 일부는 사용자 지정 WebKit 뷰에서 재생되지 않을 수 있음 | Chromium 임베딩도 서비스별 DRM 보장을 전제로 하면 안 됨 |
| 데이터 | 웹페이지를 제외한 노트, 책, 설정은 Mac 앱 컨테이너에 로컬 저장한다고 개인정보 문서가 설명 | 로컬 우선 데이터 정책과 외부 웹페이지 접속을 구분해서 안내 |

공식 지원 페이지의 기본 전역 키는 Option+G 표시/숨김, Option+Command+S 모드 전환, Option+Command+F Spaces 따라가기, Option+Command+P 클릭 통과, Option+Command+C 크롬 숨김, Option+Command+1–5 프리셋 호출 및 Option+Shift+Command+1–5 프리셋 저장, Option+Command+0 프리셋 초기화다. Option+Command+방향키로 창 이동, Option+Command+Tab으로 브라우저 탭 이동, Option+Command+M 음소거, Option+Command+X 종료도 설명되어 있다. 설정 및 주소창 등 포커스가 필요한 명령은 별도의 앱 활성화 상태 키로 분리했다.

## 튜토리얼·단축키 교차 확인 명세

아래 동작은 공식 애니메이션을 REA로 재생 관찰하고, Glaso 지원 페이지의 키 매핑 및 Mac App Store 기능 목록과 교차해 작성했다. 화면이 애니메이션에서 보인 것과 설명 텍스트에만 있는 것을 구분한다.

| 기능 | Glaso가 제공한다고 설명하는 동작 | 키·제약 | 근거 |
|---|---|---|---|
| 플로팅 창 | 전면 표시, 전역 표시/숨김, 숨겼다가 같은 위치에 복귀 | ⌥ G | 애니메이션 + 지원 키표 |
| 투명도 | 밑의 앱을 읽을 수 있게 투명도 감소/증가 | ⌥⌘, 감소 / ⌥⌘. 증가 | 튜토리얼 자막·지원 키표 |
| Spaces 따라가기 (Pro) | Spaces 전환 시 화면 내 같은 위치 유지; 끄면 자체 Space에 남음 | ⌥⌘F | 튜토리얼 설명·지원 문서 |
| 창 크기/배치 | 모서리를 끌어 크기 변경, 상단 막대를 끌어 이동; 전역 키로 미세 조정 | ⌥⌘←↑↓→ | 애니메이션 + 키표 |
| 위치 프리셋 (Pro) | 5개 슬롯에 창 크기와 위치 저장·호출, 이름 설정; 기본 배치 복구 | ⌥⌘1–5 호출, ⌥⇧⌘1–5 저장, ⌥⌘0 초기화 | 애니메이션·키표. 데모 설명은 네 모서리 예시와 다섯 슬롯을 보여 줌 |
| Clean Mode (Pro) | 탭 바·툴바를 감추고 웹 콘텐츠만 남김 | ⌥⌘C, Esc로 되돌림 | 애니메이션·키표 |
| Click-through (Pro) | Glaso를 누른 클릭을 밑 창으로 전달하면서 Glaso는 최상단 유지 | ⌥⌘P | 애니메이션·키표 |
| 브라우저 기본 | 주소 입력, 탭 생성/닫기, 뒤로/앞으로, reload, 페이지 찾기, 확대/축소, 방문 기록·즐겨찾기 | ⌘L, ⌘T/W/R/F, ⌘[/], ⌘+/−/0; ⌥⌘Tab은 전역 탭 순환 | 튜토리얼·키표·App Store 설명 |
| 브라우저 Pro | 탭/노트 무제한, 즐겨찾기 폴더, 탭별 음소거·자동 새로고침, 페이지 내 찾기 | ⌘F 및 전역 탭 순환 | App Store 기능 목록; 튜토리얼은 탭/즐겨찾기/찾기 애니메이션 |
| 로컬 영상 (Pro) | 파일 선택 후 플로팅 창 안에서 Mac의 영상 파일 재생; 재생 위치 복구, 미디어가 재생 중일 때 디스플레이 유지 옵션 | ⌥⌘O 열기, ⌥⌘−/= 미디어 볼륨 | 튜토리얼·키표·App Store 설명 |
| Window Mirror (Pro, Experimental) | 다른 앱의 창 선택, 실시간 mirror 탭, 여러 창 탭, 원본 창으로 이동 | ⌘T/⌘W; Mirror에서는 원본에서 클릭·입력 | 튜토리얼·지원·개인정보 문서. App Store판은 view-only. 공식 사이트가 직접 배포판의 Interact를 언급하지만 현 다운로드 버튼은 App Store로 연결됨 |
| Notes | 자동 저장, 무제한 노트, 굵게/기울임/밑줄, 강조·글자색·목록, 이미지 붙여넣기 | ⌘N/⌘T 생성, ⌘D 복제, ⌘S 저장, ⌘B/I/U 서식 | 튜토리얼·키표·App Store 설명 |
| Book Reader (Pro) | PDF·EPUB·텍스트 가져오기, 하이라이트·북마크, reading modes, 문서 내 검색, 마지막 위치 복구. Markdown·RTF·HTML도 열 수 있으나 레이아웃 보존은 보장되지 않음 | ⌘O 가져오기, ⌘F 검색, ⌘+/−/0 크기·줌 | 튜토리얼·지원 문서 |
| 라이브러리 검색/OCR (Pro) | 노트/책 전체에서 검색하고 노트 이미지의 글자도 온디바이스 OCR 검색; 포커스한 문서 내 찾기와 문맥에 따른 구분 | ⌘F | 지원·개인정보 문서 |
| 앱 전역 미디어 | 앱 음소거, 미디어 볼륨, 비활성 상태에서도 종료 | ⌥⌘M, ⌥⌘−/=, ⌥⌘X | 지원 키표 |
| 사용자 단축키 (Pro) | 시스템 전역 단축키는 켜기/끄기 가능; 재할당은 Pro; 중복 조합은 거부 | ⌘, 설정, ⌘? 단축키 설정 | 지원 문서 |
| Free/Trial/Pro | Free: 플로팅 창, 탭 하나, 노트 하나, 테마·투명도·기본키. 무료 14일 체험에서 Pro 전체 해제. 만료 후 저장 콘텐츠는 유지하되 생성 제한/Pro 잠금. lifetime Pro 단일 구매 및 구매 복원 | App Store판 구매·복원은 StoreKit | App Store·개인정보 문서 |

제품 재현 목표는 이 사용자 동작과 키 매핑을 우리 코드와 자체 UI 자산으로 구현하는 것이다. Glaso 코드·이미지·상표 자산 복제나 네이티브 구현 방식을 추측해 따라 하는 것은 분석 목표가 아니다. 이 기준에서 이전 MenubarX 중심 설계보다 독립 플로팅 창을 최우선 제품 모델로 둔다.

## 현재 Just Browse와 기능 격차

아래는 이번 REA 조사와 저장소 코드/README를 대조한 초기 격차 목록이다. 정적 파일에 기능 경로가 있다는 것과 사용자 환경에서 동작을 검증했다는 것은 다르므로, 구현이 있는 기능도 런타임 상태는 별도 검증이 필요하다.

| 기능 | Just Browse 현재 정적 상태 | Glaso 동작 목표 | 우선순위 |
|---|---|---|---|
| 창 모델 | 메뉴 막대 패널이 기본값. Standard app window 모드도 있고 global toggle 지원 | 앱 아이콘 메뉴 없이 독립 플로팅 창이 기본 시작/복귀 동작 | P0 |
| Topmost / Spaces | pin은 선택 기능. Standard window는 모든 Space 및 전체 화면 Space 표시 설정을 코드에 가짐 | Glaso처럼 top layer 동작이 기본이며 모든 Space follow는 별도 옵션/키 | P0 |
| 투명도 / Clean Mode / Click-through | 코드에서 해당 동작을 확인하지 못함 | Pro 기능 전체 및 키보드 복귀/접근성 | P1 |
| 위치 프리셋·전역 방향키 | 크기 변경과 화면 채우기는 있지만 5개 저장 프리셋/미세 이동은 확인되지 않음 | 저장·호출·복구 및 5개 프리셋, 화살표 이동 | P1 |
| 브라우저 | 탭, 세션, 즐겨찾기/홈, 즐겨찾기 폴더, 탭별 음소거·자동 새로고침, 확대, 다운로드, 사이트 권한, configurable shortcuts가 있음 | 탭 무제한, 방문 기록·찾기·로컬 미디어·화면 깨움 방지 확인/보완 | P1 |
| Window Mirror | 별도 플로팅 창 안에서 사용자가 고른 여러 앱 창을 읽기 전용 미러 탭으로 전환. LIVE 표시·개별/전체 중지·macOS Screen Recording 권한 안내를 구현했으나 GUI 캡처 검증은 못함. 브라우저 탭 통합·원본 창 포커스·상호작용은 없음 | 창 선택·실시간 미러·여러 창 탭·원본으로 이동; 공식 설명상 직접 배포판은 상호작용형 | P2 |
| Notes·Reader·OCR | Notes workspace와 Reader 코드 경로 구현. Vision OCR은 없음 | 자동저장 Notes, 서식/이미지, PDF·EPUB·TXT Reader, highlights/bookmarks/search, Vision OCR | P2 |
| 제품 기능 접근 | Glaso는 Free/Trial/Pro 등급을 제공 | Just Browse는 등급·체험·구매 없이 구현된 기능을 모두 제공. Glaso의 Pro 표시는 기능 범위를 가리키는 REA 분류로만 사용 | 정책 결정 |
| 웹 엔진 | Electron `WebContentsView` 기반 Chromium | Glaso는 공식 개인정보 문서에서 Apple WebKit 사용을 명시. DRM/WebKit 관련 결과 차이를 제품 제약으로 설명 | 설계 선택 필요 |

격차 근거의 저장소 위치는 [`Just Browse README`](../../../menubarx-app/README.md) 및 [`main.cjs`](../../../menubarx-app/main.cjs)다. `main.cjs` 기본값은 `presentation: 'panel'`이며 핀 조작에서 `setAlwaysOnTop`을 활성화한다. Standard 모드의 모든 Space/전체 화면 표시도 코드에 있으나, 이는 Glaso 앱에서 실행해 확인한 비교 동작은 아니다.

## Just Browse 구현 진행 기록 — 2026-11-26

### Glaso 시각 방향 적용 및 런타임 조작 확인

- 초기 시각 구현은 공개 투어를 참고했지만, 이후 사용자 요청에 따라 전체 앱 팔레트를 Chrome의 중성 회색·Google 파랑 체계로 정리했다. 브라우저 상단은 라이트에서 흰 툴바와 `#dee1e6` 탭 바, 다크에서 `#202124` 툴바·탭 바와 `#35363a` 활성 탭을 쓴다. 설정·History·Downloads·Notes·Reader·Mirror·미디어 창은 같은 의미 토큰을 공유하며 사이트 콘텐츠는 앱 테마에 덮어쓰지 않는다.
- 실제 Just Browse 창을 Orca Computer Use로 1100×760에서 캡처해 [`just-browse-floating-window-dark-2026-11-26.png`](just-browse-floating-window-dark-2026-11-26.png)에 저장했다. 이는 Glaso 화면과의 점수화된 픽셀 비교가 아니라 첫 다크 테마 확인이다.
- 기존 툴바 UI 스모크는 실제 창에서 pin/mute/expand/fill 동작을 각각 반전하고 원래 상태로 복구했으며 모두 통과했다. 처음에는 pin이 이미 활성화된 상태를 도구가 예상하지 못해 실패했다. 도구를 양쪽 시작 상태를 인식하도록 수정한 후 통과했다. 수정된 스크립트는 [`tools/justbrowse-ui-smoke.py`](../../../tools/justbrowse-ui-smoke.py)다.
- 브라우저 새 탭 기본 키를 Glaso 공개 표의 `⌘T`에 맞췄다. 기존 저장 값이 아직 기본값 `CommandOrControl+N`인 경우에만 `⌘T`로 이전해 사용자 지정 키는 보존한다. 실행 중인 Electron 창에서 `⌘T`를 보내 접근성 트리의 탭 수가 1→2로 바뀌는 것을 확인했고, `⌘W`로 다시 1개 탭으로 복구했다. Mirror의 `⌘T`는 전용 Mirror WebContents에만 연결되고 Notes의 `⌘N`은 Notes 창에 한정되어 있어 범위가 분리되어 있다.
- 이 확인은 toolbar 동작만 다룬다. Reader/Notes/Mirror 실파일 흐름, 창 배치 프리셋, Clean Mode, Click-through 및 Spaces는 별도 런타임 확인이 남아 있다. 구매·복원은 Just Browse 제품 요구가 아니다.

### 완료 및 실제 화면에서 확인

- Just Browse의 기본 표시 방식을 메뉴 막대 패널에서 Dock에 표시되는 독립 플로팅 브라우저 창으로 바꿨다. 기존 저장 데이터는 유지하고 저장된 `panel` presentation 값은 실행 시 `window`로 옮긴다.
- 창은 생성 시 항상 위 레벨로 설정하고, 기본적으로 전체 Space 및 전체 화면 Space를 따라간다. 설정의 **Follow across Spaces**와 전역 Option+Command+F로 따라가기 상태를 바꿀 수 있다.
- 전역 표시/숨김 기본키를 Option+X에서 Glaso 공개 기본키와 같은 Option+G로 바꿨다. 기존 프로필에 저장된 기본값 Alt+X만 새 기본값으로 이전하고 사용자가 직접 설정한 다른 키는 보존한다. 기존 Command+Control+Shift+Space 백업 토글도 유지한다.
- 공개 키표 기준으로 투명도 Option+Command+Comma/Period, Clean Mode Option+Command+C, Click-through Option+Command+P를 구현했다. 설정에서 투명도를 저장하고 브라우저 메뉴에서도 세 상태를 확인·조작할 수 있다. Click-through 활성 중 포인터로 해제할 수 없으므로 전역 Option+Command+P를 복귀 경로로 둔다.
- 공개 키표 기준으로 5개 창 위치 프리셋을 저장·호출하고 이름을 편집할 수 있게 했다. Option+Command+1–5 호출, Option+Shift+Command+1–5 저장, Option+Command+0 기본 레이아웃 복원, Option+Command+방향키 24픽셀 이동을 연결했다. 저장한 좌표는 디스플레이 work area 밖으로 벗어나지 않게 클램프한다.
- 런타임 관찰: `pnpm justbrowse:dev`로 앱 창이 나타났다. Orca 접근성 트리는 제목 `Just Browse`, 크기 1100×760, 창 레이어 1000, `Unpin window`의 pressed 값 1을 반환했다. Electron 로그는 `Alt+G` 및 백업 토글 등록을 출력했다.
- 추가 전역 키 등록 후 Electron 로그에 Option+Command+F, Option+Command+Comma, Option+Command+Period, Option+Command+C, Option+Command+P 등록이 모두 출력됐다. 이 키들의 실제 상태 전환은 Mac이 잠긴 시점 이후라 이번 관찰에서 별도 확인하지 않았다.
- 프리셋·이동 단축키 15개도 Electron 시작 로그에서 모두 등록됐다. REA 저장·호출 시나리오에 맞춰 코드 경로와 설정 컨트롤은 준비했지만, 화면 잠금 때문에 저장 후 재호출과 여러 디스플레이 화면 검증은 아직 하지 않았다.
- 공개 로컬 영상 동작을 따라 파일 선택, 독립 플로팅 플레이어, 재생 위치 저장·복구(파일 크기와 수정 시각 일치 시), 볼륨/음소거 저장, 재생 중 디스플레이 잠자기 방지, 창을 닫을 때 방지 해제를 구현했다. Option+Command+O/M/-/= 단축키는 설정에서도 재할당할 수 있게 했다. 여러 영상을 연속 선택해도 초기 페이지 로드가 끝난 뒤 최신 선택 파일을 보내도록 처리했다.
- 브라우저 Pro의 페이지 내 찾기를 `Command+F`와 설정 가능한 키 조합으로 추가했다. 웹 콘텐츠 검색·실시간 매치 수·다음/이전 이동·ESC 닫기를 제공하고, 검색 결과는 Electron `webContents.findInPage`의 요청 ID로 오래된 결과를 걸러낸다. API의 새 검색/후속 검색 플래그를 공식 Electron 문서에 맞췄다.
- 공개 Notes 동작에 맞춰 독립 플로팅 Notes 창, 자동 저장, 로컬 디스크 용량에 한정한 노트 생성, 검색, 복제·삭제, 굵게/기울임/밑줄, 순서/글머리 목록, 인용, 텍스트·강조 색상 및 붙여넣은 작은 이미지(1 MB 이하)를 추가했다. Notes 데이터는 기존 browser-data 저장 파일에 포함되고, 전용 단축키(`⌘N/D/S/B/I/U`)는 Notes 창에서만 동작한다. 앱 전역 `Option+Command+N`으로 Notes를 연다. 노트 한 개의 HTML 본문은 2 MB로 제한한다. 저장 HTML은 renderer가 제한된 허용 태그/속성으로 정리한 뒤 표시·저장한다.
- Glaso 공개 Reader 동작에 맞춰 별도 플로팅 Reader를 추가했다. PDF.js로 PDF 페이지를 보이는 영역 가까이에서만 렌더링하고 EPUB.js로 EPUB을 렌더링한다. TXT/Markdown/RTF/sanitized HTML은 읽기 전용 텍스트 레이아웃으로 연다. 가져온 파일은 프로필의 `Reader Library`에 복사되며 마지막 위치, 페이지, 줌, 읽기 모드, 북마크와 하이라이트 메타데이터를 로컬 browser-data에 저장한다. PDF/EPUB 및 텍스트 문서에서 검색하고, EPUB 선택 텍스트와 텍스트 문서 선택을 저장할 수 있다. 기본 호출 `Option+Command+R`, Reader 전용 가져오기·검색·이전/다음·줌·북마크 단축키는 Settings에서 설정 가능하다.
- 정적 점검에서 Reader shortcut command 이름이 main-to-renderer 간 불일치하는 것을 찾아 맞췄다. EPUB highlight 저장 API는 CFI를 `location` 필드로 저장하므로 저장·복구 동작도 해당 형식으로 정렬했다. PDF.js worker, CMap, 표준 폰트 및 WASM 경로를 패키지 상대 경로로 설정했다. 긴 PDF에서 모든 캔버스를 한꺼번에 만들지 않도록 페이지 렌더링을 viewport observer로 늦췄다.
- 즐겨찾기 항목에 이름 있는 폴더를 추가하고 시작 페이지에서 그룹별로 표시·필터링할 수 있게 했다. 기존 데이터는 빈 폴더의 즐겨찾기로 자동 보존되며 편집 창에서 새 폴더명을 입력하거나 기존 폴더를 제안 목록에서 고를 수 있다.
- Glaso 튜토리얼의 Window Mirror 흐름에 따라 사용자가 고른 앱 창을 별도 플로팅 창의 미러 탭으로 여는 기능을 추가했다. 탭 수를 임의로 제한하지 않으며, 선택한 각 창을 전환하고 개별/전체 중지할 수 있다. `⌘T`로 창을 더하고 `⌘W`로 선택한 미러를 중지하며 `⌘PageUp/PageDown`으로 미러 탭을 전환한다. LIVE 표시는 미러 탭이 열려 있는 동안 소스 선택 화면에서도 유지한다. Electron `desktopCapturer`의 window source만 쓰고 video-only 캡처를 요청한다. 웹사이트에는 `display-capture`를 계속 거부하고 Mirror 창에서만 허용한다. macOS Screen Recording이 거부되면 Privacy Settings를 열 수 있다. 캡처 프레임은 저장하지 않는다.
- Window Mirror는 현재 read-only이며 앱의 브라우저 탭과 통합되지 않고 원본 창 활성화/입력 전달도 없다. 권한/캡처 구조는 [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer), [Electron session permission handlers](https://www.electronjs.org/docs/latest/api/session), [Electron systemPreferences media access](https://www.electronjs.org/docs/latest/api/system-preferences) 기준이다.
- Reader/Window Mirror GUI와 실제 PDF·EPUB 파일 열기, 화면 소스 선택·캡처 권한·검색·저장 복구는 구현 당시 미검증이었다. 후속 Reader 실행 결과는 아래 “Reader 런타임 복원 확인”을 참고한다. Window Mirror 소스 선택·캡처 권한·검색·저장은 별도 미검증으로 남는다.
- Notes GUI의 시각적 레이아웃과 실제 시스템 클립보드에서 붙여넣는 흐름은 아직 확인하지 않았다. 별도 격리 프로필의 패키지 앱에서 렌더러 동작·입력 이벤트·프로필 저장은 Chromium DevTools Protocol로 검증했다. 이번 후속 시도에서 CUA가 Just Browse 제어를 거부했으므로 접근성 기반 수동 화면 점검은 남아 있다.
- 구현 당시에는 화면 잠금으로 파일 선택과 코덱·이어보기를 확인하지 못했다. 이후의 실제 파일 선택·재생·위치 저장·재실행 이어보기 확인은 아래 “로컬 영상 선택·이어보기 런타임 확인”을 참고한다. 전역 미디어 키는 아직 별도 검증이 필요하다.
- 설정 시트는 독립 설정 창이 아닌 브라우저 창에 붙어 열렸다. Escape 조작 후 접근성 트리에서 설정 시트 노드가 제거되고 브라우저의 36개 UI 요소가 다시 표시됐다. 앱 창은 열린 상태를 유지했다.
- 화면 캡처: [`just-browse-floating-window-2026-11-26.png`](just-browse-floating-window-2026-11-26.png). 이는 별도 구현의 자체 UI 캡처이며 Glaso 자산이 아니다.

### 남은 Glaso 우선 기능

1. Notes의 실제 시스템 클립보드 붙여넣기와 시각 레이아웃을 화면에서 검증. 페이지 내 찾기의 결과 수, 이전/다음 순환, renderer Escape 닫기는 격리 패키지 앱에서 확인했으며 전역 단축키와 Clean Mode/전체 화면/legacy panel 상태의 실제 키보드 경로는 별도 확인.
2. Window Mirror에서 실제 앱 창 선택·권한 허용·다중 소스 전환·중지 흐름을 화면에서 검증. 초기 구현은 `getDisplayMedia` 기반 읽기 전용 preview였으나, 2026-11-26 후속 작업에서 원본 창 열기와 macOS opt-in Interact 입력 전달을 구현하고 패키징했다. 권한 승인된 실제 대상 앱에 입력이 도착하는 end-to-end 검증은 남아 있다. Glaso 직접 배포판 바이너리는 확보하지 못했으므로 동작 기준은 공개 튜토리얼과 지원 문서다.
3. 구현된 투명도·Clean Mode·Click-through·프리셋·방향키의 런타임 전환과 복귀 동작, 프리셋 저장·재호출 및 여러 디스플레이 환경 검증.
4. Reader의 네이티브 파일 선택을 통한 실제 PDF·EPUB 가져오기와 문서 렌더링·검색·위치 복원을 검증.
5. 로컬 미디어 파일 선택·재생·저장 위치 복원은 격리 프로필의 패키지 앱에서 확인했다. 미디어 전역 단축키, 볼륨·음소거 보존, Notes OS 클립보드와 시각 레이아웃은 별도 확인한다. Notes 자동 저장·목록 서식·검색·이미지 OCR·재시작 복원은 이전 격리 실행에서 검증했다.

Just Browse에는 Free/Trial/Pro 등급이나 결제·복원 경로가 없다. 따라서 StoreKit 검증은 제품 요구 범위가 아니다.

앞으로도 Glaso 구현 세부를 추정하지 않고, 공개 기능·키표·가이드 영상에서 확인한 사용자 동작을 기준으로 독립 구현한다. 이 회차에서 확인한 것은 창 표시, 접근성상 최상위·핀 상태, 설정 화면의 배치와 Escape 복귀다. Option+G 키를 실제 다른 앱에서 눌러 show/hide 전환하는 수동 키입력은 아직 이 증거에 포함하지 않았다.

### 브라우징 기록 구현 — 2026-11-26

- Glaso의 브라우저 기본 기능 목록에 포함된 방문 기록을 Just Browse에 추가했다. 기록은 앱 프로필의 `browser-data.json`에 최대 1,000개까지 로컬 저장하고, 30초 이내 같은 URL 재방문은 하나의 최근 기록으로 묶는다.
- `Command+Y`와 브라우저 Actions 메뉴에서 History 창을 열 수 있다. 기록 검색, 현재 탭 열기, 새 탭 열기, 개별 삭제, 전체 삭제를 제공한다.
- HTTPS 및 loopback HTTP 주소만 기록·재열기 대상으로 허용한다. 세션 복원으로 열린 탭은 새 방문 기록으로 추가하지 않는다.
- macOS arm64 패키지 앱을 격리 프로필과 loopback 테스트 페이지로 실행해 History 창, 저장된 페이지 제목/주소, 검색 결과, 새 탭 열기, 개별 삭제, 전체 삭제, 빈 상태 문구를 확인했다. 이번 후속 검증에서는 시작 화면의 실제 `#open-history` 버튼 DOM 이벤트를 눌러 History 창이 뜨는 경로도 확인했다. 기록을 쓴 뒤 앱을 재시작해 동일 항목이 복원되는 것도 검증했다. 테스트에는 사용자의 기본 프로필을 사용하지 않았다.
- 배포 디렉터리의 `app.asar/main.cjs`를 추출해 작업 트리 `menubarx-app/main.cjs`와 SHA-256이 같은 것을 확인했다. 두 파일 모두 `activeView?.getVisible()`을 사용해 이전 오류의 `activeView?.isVisible()` 호출이 남지 않았다. 패키징된 Tesseract 워커 기준 `regenerator-runtime/runtime`도 `app.asar.unpacked/node_modules`에서 정상 해석됐다.
- 라이트·다크 History 창 스크린샷은 [`just-browse-history-light-2026-11-26.png`](just-browse-history-light-2026-11-26.png), [`just-browse-history-dark-2026-11-26.png`](just-browse-history-dark-2026-11-26.png)에 저장했다. Chromium DevTools Protocol로 브라우저 툴바·탭 바의 computed background도 확인했다: 라이트 `rgb(255,255,255)` / `rgb(222,225,230)`, 다크 `rgb(32,33,36)` / 활성 탭 `rgb(53,54,58)`.
- 재현할 QA 입력·예상 결과·관찰 결과는 [`just-browse-history-scenario-2026-11-26.json`](just-browse-history-scenario-2026-11-26.json)에 기록했다.

### Notes 자동 저장 경합 보완 — 2026-11-26

- 코드 검토에서 저장 요청 중 추가 편집이 발생하면 첫 저장의 성공 응답이 최신 입력까지 반영된 것으로 취급되어 노트 전환 시 편집이 유실될 수 있음을 확인했다.
- `saveCurrent()`는 저장한 스냅샷보다 뒤에 새 편집이 있으면 flush 성공을 반환하지 않도록 수정했다. 저장 실패도 명시적으로 `false`를 반환해 노트 전환이 중단되고 재시도되도록 했다.
- 실제 `notes.js`의 `saveCurrent()`를 Node VM에 로드하고 지연되는 업데이트 IPC를 주입한 회귀 시나리오에서, 저장 중 새 입력 후 첫 flush가 실패 상태를 유지하고 두 번째 flush가 최신 내용을 저장하는 것을 확인했다. 결과: PASS. 이는 저장 경합 단위 검증이며 실제 Notes 창의 GUI/디스크 복원 검증은 아니다.
- 패키지 앱을 별도 `/tmp` 프로필로 열고 Notes 전역 단축키를 통해 실제 Notes 창을 표시했다. 제목·본문 입력 후 저장 상태가 `Saved`가 되고, 검색 필터가 본문 문구로 노트를 찾는 것을 확인했다.
- 글머리 목록 적용 시 기존 패키지에서는 `<p><ul>…</ul></p>`가 생성되는 문제를 발견했다. 목록 노드를 문단 밖으로 옮기도록 렌더러와 저장 HTML 정리 함수를 고쳤고, 수정 후 앱 DOM과 `browser-data.json`에 유효한 `<ul><li>…</li></ul>`가 기록됐다.
- 유효한 캔버스 PNG를 `ClipboardEvent`의 이미지 항목으로 붙여넣어 이미지 데이터 URI가 노트에 삽입되는 경로를 확인했다. 패키지의 Tesseract 워커가 `Note OCR sample`을 읽어 `data-ocr`로 저장했고, 그 문구로 Notes 검색이 결과를 반환했다. 테스트용 1px PNG는 픽셀에 글자가 없어 OCR이 빈 결과를 반환했으므로 실제 OCR 확인 근거로 사용하지 않는다.
- 앱을 종료하고 같은 격리 프로필로 재시작한 뒤 노트 제목·본문·붙여넣은 이미지와 OCR 메타데이터가 복원되는 것을 확인했다. 이 확인은 OS 클립보드 자체가 아닌 렌더러 `ClipboardEvent`를 사용했으며, 일반 GUI 스크린샷/접근성 검증과는 구분한다.

### Reader PDF 엔진 확인 — 2026-11-26

- REA 확인용 1페이지 PDF fixture를 만들고, 패키지에 포함된 PDF.js 모듈과 worker를 Electron renderer 컨텍스트에서 직접 로드했다. PDF.js는 1페이지를 읽고 `Just Browse Reader QA Searchable PDF`와 북마크 검증 문구를 추출했다.
- Reader 플로팅 창은 단축키로 열리는 것을 확인했다. 실제 파일 선택 dialog를 통한 라이브러리 import와 Reader 캔버스·검색·북마크 UI 흐름은 완료하지 못했다. 테스트용 앱 프로세스가 macOS Accessibility에서 background-only 상태로 전환되어 파일 선택 UI를 조작할 수 없었다. PDF.js 파싱 결과를 Reader 전체 UI 통합 검증으로 간주하지 않는다.

### 페이지 내 찾기 런타임 확인 — 2026-11-26

- 격리 프로필의 패키지 앱에서 loopback 문서의 `needle` 3개 일치를 검색했다. 초기 결과 `1 / 3`, 다음/이전 버튼 이동, Enter `2 / 3`, Shift+Enter `1 / 3`, Escape 후 검색 바 숨김을 확인했다. 재현 단계는 [`just-browse-find-in-page-scenario-2026-11-26.json`](just-browse-find-in-page-scenario-2026-11-26.json)에 기록했다.
- 코드 검토에서 Escape가 검색보다 Clean Mode/전체 화면/legacy panel 동작을 먼저 처리할 수 있는 우선순위 결함을 찾았다. `findBarOpen` 상태와 `app:close-find` 이벤트를 추가해 검색이 열려 있을 때 검색 닫기를 우선하고, 기존 `tab:find-close` 경로로 활성 페이지에 포커스를 돌리도록 수정했다. 변경된 코드가 패키지에 포함된 것도 확인했다.
- 현재 세션의 QA 프로세스는 macOS foreground-only keyboard routing을 허용하지 않아 물리 Escape 입력으로 세 모드의 동시 동작을 검증하지 못했다. renderer Escape 닫기 동작과 패키지 코드 경로는 확인했지만 OS 키보드 및 포커스 상태 증거는 미완료로 남긴다.

## 제품 접근 정책 결정 (2026-11-26)

Glaso 공식 자료의 Free/Trial/Pro 등급은 REA 비교표에만 남긴다. Just Browse는 구독·체험·등급이나 기능 잠금을 두지 않고, 구현한 기능을 모두 모든 사용자에게 제공한다. Settings에는 상품 구매/복원 UI를 노출하지 않는다. 직전 작업에서 추가했던 체험 만료와 Pro 게이트는 이 제품 결정에 어긋나 제거했다.

## 구현 검증 업데이트 (2026-11-26)

- Glaso 지원 문서의 Notes 라이브러리 동작을 기준으로, 붙여넣은 이미지의 글자를 노트 검색에 포함했다. Glaso의 기본키/라이브러리 검색 설명은 [공식 지원 페이지](https://glaso.app/support/)를 참고했다.
- Just Browse는 영어·한국어 Tesseract 모델을 앱 패키지에 포함하고, 이미지 내용은 로컬 OCR 워커로 처리한다. 언어 데이터는 첫 사용 때 앱의 로컬 프로필에 복사되며 외부 OCR 서비스로 이미지를 보내지 않는다.
- 동작 시나리오 검증: 앱의 격리된 테스트 프로필에 “Just Browse OCR sample / 노트 검색 테스트” 문구가 담긴 이미지 노트를 넣고 실행했다. Notes를 연 뒤 OCR 결과가 `data-ocr` 검색 메타데이터로 저장됐고, Notes 검색 필드에서 `노트 검색 테스트`를 입력하면 해당 노트가 남으며 임의 문구는 “No matching notes”로 필터되는 것을 접근성 트리와 프로필 파일에서 확인했다.
- macOS 패키지 검사에서 Tesseract 워커가 ASAR 밖에서 실행될 때 `regenerator-runtime/runtime` 모듈 탐색 오류가 발생했다. 원인은 이 패키지가 Tesseract의 전이 의존성으로만 존재해 pnpm 기반 패키징에서 워커와 같은 위치에 풀리지 않은 것이었다. `menubarx-app/package.json`에 직접 의존성으로 선언하고 기존 ASAR unpack 규칙을 적용했다.
- 수정 빌드의 `app.asar.unpacked/node_modules/tesseract.js/src/worker-script/node/index.js` 기준으로 Node 모듈 탐색 결과가 `app.asar.unpacked/node_modules/regenerator-runtime/runtime.js`로 해석되는 것을 확인했다. 같은 패키지 워커와 영어 모델로 `createWorker()`를 부팅해 검증용 이미지의 `Just Browse OCR verification` 텍스트를 읽고 종료하는 데 성공했다. 이 검증은 패키지 워커의 OCR 실행 경로를 확인하지만, Notes 창에서 실제 시스템 클립보드로 붙여 넣는 전체 GUI 흐름까지 증명하지는 않는다.
- 테스트 입력, 기대 결과, 관찰 결과는 [`just-browse-ocr-worker-scenario-2026-11-26.json`](just-browse-ocr-worker-scenario-2026-11-26.json)에 기록했다.

## 신뢰도와 한계

1. **높음 — 제작자 공개 설명:** 제품 기능, 지원 OS, 지원 단축키, DRM/Spaces/데이터 설명은 Glaso 공식 페이지가 주장하는 제품 계약이다. 실제 앱에서 하나씩 독립 재현했다는 뜻은 아니다.
2. **관찰 — Glaso 사이트 데모:** REA controlled replay가 데모 페이지의 컨트롤 상태·접근성 트리 변화를 기록했다. 웹 데모는 제품 앱 그 자체가 아니다.
3. **정적 분석 범위 명시:** REA가 분석한 것은 `glaso.app` 페이지에서 캡처한 JavaScript 6개다. 0 endpoint 후보는 앱 네트워크 요청이 없다는 뜻이 아니며, Glaso 앱의 네트워크 인벤토리가 아니다.
4. **미확인 — 앱 바이너리:** 실제 앱 실행 파일과 앱의 런타임 UI는 REA 분석에 포함되지 않았다. native window level, fullscreen/Space 동작, 단축키 충돌 처리, 보안·저장 구현은 제품 설명 외에 검증하지 않았다.

## 출처

- [Glaso 공식 홈페이지](https://glaso.app/)
- [Glaso 공식 지원/기본 단축키](https://glaso.app/support/)
- [Glaso 개인정보 문서](https://glaso.app/privacy/)
- [Mac App Store 제품 페이지](https://apps.apple.com/us/app/glaso/id6788211633?mt=12)
- [REA 저장소와 도구](https://github.com/morluto/rea)
- [Electron webContents 검색 API](https://www.electronjs.org/docs/latest/api/web-contents)

## 다음 분석 단계

사용자가 지정한 방법대로 현재 구현 분석은 공개 동작 영상과 키 매핑으로 계속 진행한다. 공식 사이트 Download는 App Store로 연결되며 직접 설치 파일은 아직 공개 경로에서 확인하지 못했다. 추후 직접 배포 파일이 공개되면 그때 REA `analyze`, 앱 그래프·Info.plist·서명·아키텍처·프레임워크 분석을 추가할 수 있다. 지금은 Glaso 바이너리 내부나 Swift/Objective-C 구현을 안다고 추정하지 않고, 위 표의 동작 계약에 맞춘 자체 구현을 진행한다.


### Reader 런타임 복원 확인 — 2026-11-26

- macOS arm64 패키지 Floa를 `/tmp/FloaReaderQA-20261126`의 격리 프로필로 실행했다. 저장된 TXT 문서를 Reader가 다시 열고, 문서 검색 `searchable text`가 `1 / 1` 결과를 표시하는 것을 확인했다.
- Reader UI에서 페이지 북마크와 선택 영역 하이라이트를 추가했다. Reader 사이드바에 각각 `Page 1`과 `Bookmark this section: floating browser state.`가 나타났고, `browser-data.json`에 북마크·하이라이트 메타데이터가 저장됐다.
- 라이브러리 검색 `missing document`는 `No matching documents`를 표시했다. 앱을 종료하고 동일한 격리 프로필로 재실행한 뒤 문서, 북마크, 하이라이트가 Reader에 복구되는 것을 확인했다.
- Import를 눌러 macOS 파일 선택 대화상자가 열리는 것까지 확인했다. 다만 파일 선택 대화상자에서 테스트 파일을 선택하고 Reader에서 여는 단계는 완료하지 못했다. 따라서 실제 파일 import와 PDF/EPUB 렌더링의 end-to-end 증거는 아니다. 재현 절차와 한계는 [`floa-reader-runtime-scenario-2026-11-26.json`](floa-reader-runtime-scenario-2026-11-26.json)에 기록했다.
- 로컬 미디어 검증 시나리오로 이동해 실제 파일을 고르는 과정에서도 대화상자는 열렸으나, 파일 검색 결과가 접근성 트리에 나타나지 않아 선택·재생까지 진행하지 못했다. 임시 파일은 다운로드 폴더에 남기지 않도록 `/tmp`로 옮겼다.

### 로컬 영상 패키지 진단 — 2026-11-26

- 패키지 앱의 Chromium renderer에서 7.5초 MP4를 읽었다. 메타데이터는 1440×810, `readyState=4`였고 2초 지점으로 이동할 수 있었다. 가려진 앱 창에서는 재생 이벤트와 세 차례의 `timeupdate`가 발생한 뒤 문서가 hidden 상태가 되며 재생이 멈췄다.
- 이 결과를 전용 플로팅 미디어 플레이어의 재생 통과로 보지 않는다. 전용 창의 백그라운드 타이머·페이지 가시성 상태가 재생 위치 저장에 영향을 주지 않게 해당 창에만 `backgroundThrottling: false`를 적용했다. 패키징된 `app.asar/main.cjs`에서 설정을 확인했다.
- 파일 선택기에서 실제 파일을 열고, 전용 플레이어 UI에서 재생·볼륨·일시정지 후 앱 재시작 이어보기를 확인하는 end-to-end 흐름은 아직 남아 있다. 관찰값과 한계는 [`floa-local-media-codec-scenario-2026-11-26.json`](floa-local-media-codec-scenario-2026-11-26.json)에 기록했다.

### 로컬 영상 선택·이어보기 런타임 확인 — 2026-11-26

- 격리 프로필의 패키지 앱에서 macOS 파일 선택기를 열어 60초 MP4 fixture를 실제 선택했다. 별도 Floa 로컬 영상 창에 프레임과 미디어 컨트롤이 표시되고, Play 버튼을 눌렀을 때 Pause로 바뀌는 것을 확인했다.
- 재현 가능한 위치 검증을 위해 CDP로 재생 위치를 30초로 옮겼다. 실제 플레이어 `seeked` 이벤트와 preload IPC가 위치를 저장해 `browser-data.json`의 `mediaResume`에 `time=30`, 파일 크기, 수정 시각이 기록됐다. 창 닫기 후 같은 파일을 네이티브 선택기로 다시 열었다. 재생 창은 길이 60초, `currentTime=39.4898`, `paused=false`, `readyState=4`로 관찰됐다. 저장한 30초 위치에서 자동 재생을 시작해 관찰 시점까지 진행된 결과다.
- 파일 fixture는 저장소의 기존 비-Glaso 데모 영상 구간을 AVFoundation으로 8회 반복해 만들었다. 테스트 중 Floa QA 앱 본체와 Electron 하위 프로세스를 종료했고, QA 프로필은 `/tmp`에 격리했다. Downloads에 둔 테스트 사본은 종료 후 `/tmp`로 옮겼다. 기존 사용자 기본 프로필의 Just Browse 프로세스는 유지했다.
- 전 과정·입력 방식·한계는 [`floa-local-media-codec-scenario-2026-11-26.json`](floa-local-media-codec-scenario-2026-11-26.json)에 기록했다. 이 확인에서는 음량·음소거 설정, 네이티브 seek bar 드래그는 다루지 않았다.

### Reader PDF 엔진 비포커스 확인 — 2026-11-26

- 포커스를 가져오지 않고, 로컬에서 만든 1페이지 PDF fixture를 다시 빌드한 `app.asar`에서 추출한 PDF.js 6.5.438로 파싱했다. 612×792 페이지 상자와 본문 텍스트를 읽었고 `floating browser state` 검색어가 한 번 매치됐다.
- 패키지 `app.asar`에서 `reader.js`를 추출해 작업 트리와 SHA-256이 일치하는 것과, PDF.js worker가 패키지에 포함된 것을 확인했다. `node --check menubarx-app/reader.js`, `git diff --check`도 통과했다.
- 이 확인은 Reader UI의 네이티브 import, canvas 표시, 검색 입력, 북마크·위치 복원을 증명하지 않는다. 화면 포커스를 가져오는 조작은 중단했으며 이 흐름은 미검증으로 남긴다. 자세한 근거는 [`floa-reader-pdf-engine-scenario-2026-11-26.json`](floa-reader-pdf-engine-scenario-2026-11-26.json)에 기록했다.

### 전역 탭 순환 키 매핑 — 2026-11-26

- Glaso 공개 키표에 있는 ⌥⌘Tab 전역 탭 순환이 기존 Floa 단축키 정의에는 없었다. 기존 창 내 탭 이동 키(⌘⇧→/←)는 유지하고, 전역 다음 탭 ⌥⌘Tab 및 역방향 ⌥⇧⌘Tab을 추가했다.
- 두 키는 설정의 공통 단축키 목록에 노출되며 브라우저 작업공간을 표시하고 활성 탭을 순환한다. 역방향 키의 Shift 조합은 공개 키표에 없는 동작을 위한 보완적 선택이다.
- 검증은 정적 검사만 수행했다. `node --check menubarx-app/main.cjs`와 `git diff --check`는 통과했다. 앱 실행 중 OS 전역 키 등록과 포커스 전환은 사용자의 포커스 보호 요청에 따라 시험하지 않았다. [`floa-shortcut-cycle-scenario-2026-11-26.json`](floa-shortcut-cycle-scenario-2026-11-26.json)에 계약과 검증 한계를 기록했다.

### Reader 가져오기 경로 정적 추적 — 2026-11-26

- 코드를 따라가면 Reader 가져오기는 네이티브 파일 선택기 → 200 MB 크기 제한 → `Reader Library`로 복사 → 상태 갱신 → renderer의 `openDocument` → IPC 바이트 로드 → PDF.js/EPUB.js/텍스트 렌더러 순서로 연결된다.
- 이 연결은 Reader UI 흐름이 구현되어 있음을 보여 주지만, 파일 선택과 실제 canvas/문서 표시의 런타임 성공을 증명하지 않는다. 파일 선택기부터 PDF 표시까지의 사용자 시나리오는 여전히 미검증으로 남긴다. 기존 PDF.js 패키지 엔진 확인의 한계와 정적 추적 단계를 [`floa-reader-pdf-engine-scenario-2026-11-26.json`](floa-reader-pdf-engine-scenario-2026-11-26.json)에 분리 기록했다.

### Reader 문서 전환 중 검색 경합 보완 — 2026-11-26

- REA Reader 흐름에서 문서 라이브러리를 전환할 수 있으므로, 이전 PDF/EPUB의 검색 작업이 비동기로 대기하는 동안 다른 문서를 열었을 때 결과가 새 문서 UI에 쓰이지 않는지 코드를 점검했다.
- PDF 검색은 시작 시점의 PDF 객체를 고정하고 각 페이지 로드/텍스트 추출 뒤 검색 세대, 문서 ID, PDF 객체가 여전히 현재 상태인지 확인한다. EPUB 검색도 검색 대상 book 객체를 고정하고 결과 반영 전에 세대와 객체를 확인한다.
- REA Reader 경로를 기준으로 사용자 창을 열지 않는 Chrome headless 시나리오를 실행했다. PDF.js 6.5.438이 든 실제 `reader.html`에서 240페이지 PDF를 렌더하고 검색 중 두 번째 PDF로 전환한 뒤 결과가 `No matches`로 유지되는 것, 북마크 IPC 호출을 확인했다. PDF를 열 때 툴바가 화면 밖으로 밀려나는 결함도 발견했다. 원인은 `scrollIntoView()`가 Reader 컨테이너 밖까지 스크롤한 것이었고, 페이지·검색 결과 이동을 Reader 뷰포트 안의 `scrollTop` 계산으로 바꿔 해결했다.
- 수정 뒤 같은 headless 시나리오에서 Reader 툴바 상단 좌표 0, 사이드바 헤더 17, 바깥 `window.scrollY` 0을 확인했다. 결과 화면은 [`floa-reader-headless-2026-11-26.png`](floa-reader-headless-2026-11-26.png), 단계와 한계는 [`floa-reader-headless-scenario-2026-11-26.json`](floa-reader-headless-scenario-2026-11-26.json)에 기록했다.
- 이 검증은 로컬 Reader HTML/renderer와 PDF.js 경로를 Chrome headless에서 다루고 IPC bridge만 stub 처리한다. Electron 네이티브 파일 선택, 실제 Reader 창, OS 키보드 포커스는 증명하지 않는다. 당시 PDF 선택 텍스트/하이라이트는 아직 검증하지 않았으며, 후속 결과는 아래 Reader PDF 하이라이트 확인을 참고한다. 사용자의 기존 Just Browse 창은 실행 전후 계속 유지했다.
- 이어서 Glaso Reader 튜토리얼의 EPUB 열기·검색·북마크 흐름을 같은 headless 환경에서 실행했다. EPUB 로딩 중 `JSZip lib not loaded` 오류를 확인해 `jszip`을 앱 직접 의존성으로 선언하고, 사용 중인 epub.js에는 `rendition.search()` API가 없다는 점도 확인했다. 검색은 epub.js의 spine section `find()`가 반환하는 CFI/excerpt를 모으도록 바꿨다.
- EPUB 검색어 결과 1개, 검색 위치로 이동, 북마크 저장 API에 CFI 전달을 확인했다. 마지막에는 빌드한 `app.asar`를 임시 경로에 추출하고 같은 headless PDF/EPUB 흐름을 반복했다. 패키지 안에 `node_modules/jszip/dist/jszip.min.js`가 있고 Reader renderer가 소스와 일치했으며, 두 문서 유형 모두 화면에 표시·검색됐다. 실제 UI 캡처는 [`floa-reader-epub-headless-2026-11-26.png`](floa-reader-epub-headless-2026-11-26.png), 입력·결과·한계는 [`floa-reader-epub-headless-scenario-2026-11-26.json`](floa-reader-epub-headless-scenario-2026-11-26.json)에 기록했다. IPC를 stub했으므로 Electron 네이티브 가져오기와 프로필 디스크 복원 증거로 확장해서 해석하지 않는다.
- 이어서 PDF.js TextLayer를 사용해 PDF 텍스트 선택과 하이라이트 저장·복원을 구현했다. Reader headless 흐름에서 `only alpha phrase` 선택 범위와 노란 overlay의 실제 좌표를 대조해 정렬을 확인했고, 문서를 닫았다 다시 연 뒤 overlay가 돌아오는 것과 persistence bridge 인자를 확인했다. 이후 저장된 하이라이트를 열린 문서에서 삭제할 때 PDF overlay도 즉시 제거하고 EPUB rendition annotation도 제거하도록 연결했다. PDF 삭제는 모의 persistence bridge가 승인한 뒤 오버레이가 사라지는 것으로 확인했다. 패키징 후 추출한 `app.asar`에서도 PDF 하이라이트·복원 시나리오와 EPUB 렌더·검색·CFI 북마크 시나리오를 재실행했다. 패키지의 `reader.js`/`reader.css`는 소스와 일치하고 JSZip이 포함됐다. 캡처는 [`floa-reader-pdf-highlight-headless-2026-11-26.png`](floa-reader-pdf-highlight-headless-2026-11-26.png), 결과 및 한계는 [`floa-reader-headless-scenario-2026-11-26.json`](floa-reader-headless-scenario-2026-11-26.json)에 기록했다. Chrome headless와 모의 IPC를 사용했으므로 실제 Electron BrowserWindow, 파일 선택, 디스크 저장·복원, macOS 키보드 포커스는 검증 범위 밖이다. 현재 로그인된 Just Browse 프로세스는 그대로 유지했다.

### Window Mirror 입력 상호작용 격차 — 2026-11-26

- Glaso 튜토리얼 캡처는 창 선택, 실시간 보기, 두 번째 창 추가, 원본 열기 동작을 보여 준다. 공개 자료는 App Store read-only와 직접 배포판 Interact를 구분하지만 직접 배포 바이너리는 확보하지 못했다.
- Floa는 선택한 mirror source id의 CGWindowID를 macOS 네이티브 helper에 전달한다. helper가 현재 창의 owner PID·bounds를 다시 조회한 뒤, 사용자가 Interact를 켜고 Accessibility 권한을 부여한 경우에만 해당 PID로 포인터·드래그·우클릭·스크롤·키 이벤트를 보낸다. Open Original은 선택한 창의 AXUIElement에 raise를 요청한다. 미승인 상태에서는 UI가 안내하고 forwarding IPC는 main에서 거부한다.
- Interact 입력·소스 전환·권한 변경·해제를 main 프로세스 큐에서 직렬화해 비동기 native 응답 중 전환이 끼어드는 race를 막는다. 입력 실패 시 추적 중인 마우스 버튼과 키를 해제하고 해당 소스의 Interact 권한을 회수한다. 창 전환·소스 해제·앱 종료 때도 눌린 입력을 정리하며, 렌더러 토글은 실패 시 비활성화한다.
- 설정·유틸리티 패널 연결 정적 대조: preload에서 호출하는 81개 IPC 명령 모두 대응 main handler가 있고, Notes·Reader·Mirror·History·Downloads·Media·Settings·Browser 렌더러가 참조하는 고정 HTML ID가 모두 존재한다. 이 정적 연결 확인은 GUI 버튼 결과나 OS 동작을 증명하지 않는다. 기본 창 레이아웃 초기화도 현재 창이 있는 디스플레이를 유지하도록 했다.
- Swift helper arm64 컴파일, JS 문법 검사, macOS 패키지 빌드 및 `Contents/Helpers/FloaMirrorInput` 탑재를 확인했다. macOS 코드 서명 도구가 인식하는 nested helper 위치로 옮겼고 패키지 main 스크립트가 그 경로를 참조한다. helper의 권한 상태 질의는 유효 JSON을 반환했고 권한 프롬프트나 Floa 활성화는 없었다. 현재 Developer ID가 신뢰되지 않아 서명은 생략됐으므로, 서명된 빌드에서의 helper 서명과 TCC 승인은 아직 확인하지 않았다.
- 사용자가 포커스 탈취를 금지했으므로 Floa를 실행하지 않았고 실제 창에 입력이 도착하는 흐름은 검증하지 않았다. 보조 디스플레이 좌표와 리사이즈, 입력을 누른 채 탭 전환하는 시나리오, 신뢰된 서명 하 TCC 승인 흐름의 런타임 검증이 남는다. 구현은 입력 이벤트와 전환을 직렬화하고 눌린 버튼·키를 해제하지만 이를 실제 앱 창에서 확인한 증거는 없다. 근거와 구현 현황은 [`floa-mirror-interaction-gap-2026-11-26.json`](floa-mirror-interaction-gap-2026-11-26.json)에 기록했다.
