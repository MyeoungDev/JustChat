# MenubarX REA (Reverse Engineering Analysis)

## 목적과 범위

이 문서는 [REA (Reverse Engineer Anything)](https://github.com/morluto/rea)로 조사한 MenubarX의 산출 근거와, 이를 바탕으로 이 저장소에 별도 앱을 구현하는 요구사항을 기록한다. 비공개 구현이나 내부 데이터 모델을 추정해 사실처럼 서술하지 않는다.

**분석 기준일:** 2026-11-25

**대상:** MenubarX 1.7.6 for macOS, 공식 개발자 DMG

**저장소 기준:** Just Chat, Electron + Tauri + 공유 React UI

## REA 조사 기록

REA 6.10.1 CLI를 Node.js 24.22.1에서 실행했다. 앱 DMG는 읽기 전용 마운트했고, 조사 대상 앱이나 원본 자산을 저장소에 복사하지 않았다. Evidence bundle과 중간 산출물은 `/private/tmp`에 저장했다.

| REA 작업 | 결과 |
|---|---|
| `rea inspect-artifact` | 앱 인벤토리 Evidence `ev_3bb451c40014f250cbf73cc908063ddca92601f4c6a31e7453c2e6fbc04ef533`; 노드 529개, occurrence 558개, edge 548개; 번들 항목 1,635개 확인, integrity contradiction 없음 |
| `rea project-apple-application-graph` | Evidence `ev_c7d7b9c71d648a4024a4ece587db0bcabf993d7a29b7ad2b221075802d4653a5`; macOS 앱 루트, 중첩 번들 9개, native/JavaScript runtime-family 단서 |
| `rea inspect-plist` | Evidence `ev_d85234c4c988dd9df86fe7fc5872f3ccd8a0afef657221b87b3750d0ea7b45f9`; 버전 1.7.6, bundle ID `com.app.menubarx`, 최소 macOS 14, `LSUIElement=true`, `menubarx` URL scheme, iCloud/CloudKit 선언 |
| `rea inspect-signature` | Evidence `ev_291abd427dcaa6f3ef93b72f20091d744bf7abae64086a0eb433a1bf49645b87`; 서명 및 hardened runtime 확인. 반환된 entitlement/서명 세부는 arm64 기준이며 x86_64 slice 세부는 미포함 |
| `rea decode-interface-builder` | Evidence `/private/tmp/menubarx-rea-nibs.json`; 탭 도구막대, 메인 메뉴, 온보딩, 설정 등 컴파일된 nib의 인식 가능한 오브젝트와 연결을 해석 |
| `rea list-architectures` | Evidence `ev_aef56332b13bb11cf6dc3a6b1c3afe9a9f64d08be095191bed4ff1447fc49ffd`; 메인 실행 파일은 x86_64/arm64 universal, 두 slice 모두 확인 |
| `rea trace-dylib-resolution` | Evidence `ev_529d68990db17cef467f349d8e37fa478d55bdaa3ced2755322e2a32292e1bef`; 12개 실행 root, 8개 앱 내부 이미지 분석. 프레임워크/시스템 밖 의존성은 일부 미결정이며 coverage partial |
| `rea inspect-native-dispatch-metadata` | Evidence `ev_b770284393708b10c2d69be832d1875567680c1ba0c8c185647c658268a06369`; 메인 arm64 slice의 Objective-C/Swift dispatch metadata 408개 클래스. UI/controller method 이름은 정적 symbol 근거이며 동작 증명은 아님 |
| `rea analyze-javascript-application` | 별도 구현 `menubarx-app/`의 main/preload/renderer/settings/download 스크립트 7개를 정적 분석. 최신 Evidence `ev_835fbcc27820501fcdf6a58d6d62cb88a0a1a31b19ca0339aac28d9245ff4141`; graph 316 nodes/334 edges, graph/semantic coverage partial, Electron 의미론도 partial. 설정 가능한 단축키 기록, 충돌 검사, 웹 콘텐츠 키 이벤트 처리 경로를 이번 분석 범위에 포함했다. REA 정적 분석은 런타임 동작을 증명하지 않음 |
| `rea search` + Ghidra | arm64 thin slice 기준 Evidence `ev_2bf03a85a7daa28b0a00a531a3eef49686314e846cfe7d1a5fa3b365b42628b9`; `TabItem`의 `detachWindow`, `changeUAWithItem:`, 자동 새로고침 설정 등 함수 심볼을 확인 |
| `rea decompile` + Ghidra | `detachWindow` Evidence `ev_5c96452e2748e4dc8234bd687d58c762ac55ea8d574af4e582e03decbb6e07b4`, 호출 대상 `0x10006cd68` Evidence `ev_38f6a635c3bb49f0c7af1a5412022ca3c85440e96f3d8d8e580a842b01b2ebfc`. `TabCodable.detached`를 토글하고 분리/재결합 경로를 호출하는 것으로 해석됨. Ghidra pseudo-code 해석이며 원본 소스가 아님 |
| `rea decompile` + Ghidra | `changeUAWithItem:` Evidence `ev_aec625bc892f066707b339d7c98dd6f256521a722432601d173e8df617661fdc`; `uaConfig` 설정을 바꾸고 새로고침 경로를 호출하는 호출 대상 `0x100019e1c` Evidence `ev_05dc7b6ea7502202c499d2d26537589188a72749c3e8dc17089a3f425ee59fe8` |
| `rea decompile` + Ghidra | `0x100060a90` Evidence `ev_e99f7207510af7f65690fc647a4bdc98faa438ac8d840e2f213e6fad604b0886`; 탭별 `uaConfig`에 해당하는 custom/default 값을 WKWebView의 `setCustomUserAgent:`에 전달하고 뒤이어 reload 경로를 호출하는 것으로 해석됨 |
| REA artifact localization | 앱의 한국어 localization에서 Desktop, Chrome, macOS Safari, Android Chrome, Android, iOS Safari, Kindle 프로필 명칭을 확인. 이름만으로 실제 UA 문자열이나 viewport 에뮬레이션은 확정하지 않음 |
| `rea inspect-macho` | 부분 실행 실패: 로컬 Xcode toolchain에 `dyld_info`가 없어 REA가 `capability_unavailable` 반환. architecture/dylib/dispatch metadata는 별도 REA workflow로 보완 |
| `rea inspect-asset-catalog` | `Assets.car` 형식은 지원되지 않아 REA가 `unsupported binary format` 반환 |
| `rea observe-native-ui` | 런타임 UI Evidence 미확보: CUA가 MenubarX 프로세스 접근을 거부함. 화면 동작을 관찰한 것으로 주장하지 않음 |

REA가 해석한 `Contents/Resources/TabViewController.nib`에는 뒤로/앞으로/홈/새로고침/PiP/음소거/메뉴/보조 메뉴/URL 입력/로딩 표시/toast에 대응하는 outlet이 있다. 관찰된 action selector는 `back:`, `forward:`, `refresh:`, `togglePiP:`, `toggleMute:`, `showSubMenu:`, `showMenu:`, `home:`, `stopLoading:`이다. `MainMenu.nib`에는 탭 열기/닫기, 다음·이전 탭, 웹 내비게이션, 강력 새로고침, 분리, 고정, 도구막대 표시, 설정, 외부 브라우저 열기의 selector가 있다. 추가 dispatch metadata에서 `TabViewController`의 인증 challenge, 팝업, 파일 선택, 탐색 실패 및 다운로드 delegate와 `MyWebView`의 링크/이미지 저장·외부 브라우저 메뉴가 관찰된다. 설정 controller에는 사용자 지정 홈페이지, 검색 엔진, User-Agent, 창 크기, hover 표시 selector가 있고 메뉴 항목에는 자동 새로고침 간격·줌·사이트 데이터 삭제 selector가 있다. 이 이름들은 선택 가능한 기능 지점의 증거이며 정책/구체 동작은 정적 이름만으로 확정하지 않는다. nib의 action 연결은 이름/연결의 관찰이지, 실제 native handler 로직의 증거는 아니다.

메인 앱 plist는 마이크, 카메라, 위치 설명문과 네트워크, 다운로드 폴더, iCloud/CloudKit entitlement를 선언한다. 이 정적 선언만으로 권한을 요청하는 시점이나 기능 사용 여부를 단정하지 않는다.

## 요약

MenubarX는 메뉴 막대 아이콘에서 열리는 웹 앱 런처이자 브라우저다. 웹사이트와 PWA를 별도 앱처럼 빠르게 열고, 여러 탭·북마크·기기 시뮬레이션/User-Agent를 제공한다. 사용자는 전역 단축키로 패널을 열고, 사이트별 창을 고정하거나 분리하고 크기를 조절할 수 있다. 공식 사이트는 자동 새로고침, 광고 차단, iCloud, 알림, 다국어도 기능으로 소개한다.

기존 저장소의 Just Chat 제품은 계속 별도로 유지하고, 별도 브라우저 앱은 `Just Browse`로 명명해 `menubarx-app/`에 구현했다. 이 폴더명과 분석 기록에는 원래 참고 제품명이 남아 있다. 현재 앱 MVP에는 메뉴 막대 토글, HTTPS 주소/검색, 시작 페이지, 다중 탭, 북마크, 지속 세션, 핀, 홈/음소거/메뉴, 탭별 자동 새로고침, 줌, 사용자 선택 HTTPS 다운로드 대화상자, 출처별 사이트 권한과 데이터 삭제, Google/DuckDuckGo/Bing 검색엔진 선택, 주소와 패널 크기를 검증하는 `justbrowse://open/` 호출(기존 `menubrowser://`도 호환), 상태를 보존하는 탭 분리 창, `⌘,` 설정 화면은 메뉴 막대 패널 모드에서 현재 플로팅 창 안에 표시하고, Standard app window 모드에서는 브라우저 창에 붙은 포커스 모달로 표시한다. 설정 화면은 홈페이지, 기본·사용자 지정 User-Agent, 새 탭의 새로고침/줌, 다운로드 폴더, 탭 복원과 포커스 상실 동작, 저장된 사이트 권한 취소를 제공한다. REA로 확인한 MenubarX FAQ 단축키 흐름을 참고해 새 탭·닫기·탭 이동·1–9번 탭 선택·주소창·시작 페이지·뒤로/앞으로·새로고침·강력 새로고침·줌·고정·분리·외부 브라우저·설정·다운로드 동작을 추가했고, 단축키는 설정에서 다시 녹음하거나 비워둘 수 있다. 전역 토글은 다른 앱이 활성화된 상태에서도 동작하며 나머지는 패널과 웹페이지 포커스 양쪽에서 동작한다. 별도 앱은 설정 가능한 기기 viewport, 시작 바로가기 편집·정렬, 탭 상한/유휴 탭 폐기, 다운로드 목록과 재개 시도, 독립 웹앱 창, 카메라/마이크 권한, 아이콘 및 별도 macOS/Windows 패키징 설정까지 구현했다. 광고 차단과 동기화는 아직 범위 밖이며, 런타임 동작은 정적 REA Evidence만으로 검증됐다고 보지 않는다.

## 근거와 신뢰도

| 내용 | 근거 | 신뢰도 |
|---|---|---|
| 웹 앱/PWA, 자동 새로고침, 광고 차단, 북마크/iCloud, 고정·분리·크기 변경, 기기 시뮬레이션, User-Agent, 다국어 | [공식 홈페이지](https://menubarx.app/) | 높음: 제작자 공개 기능 목록 |
| 메뉴 막대 아이콘 우클릭으로 새 탭, 북마크 관리, 자동 새로고침, User-Agent 변경 | [공식 FAQ](https://menubarx.app/faq/) | 높음: 제작자 사용 안내 |
| 전역 토글, 탭 생성/닫기, 주소창 표시, 고정, 분리, 시작 페이지, 외부 브라우저, 주소 입력 포커스, 새로고침, 확대/축소, 탭 이동, 탭 번호 선택, 뒤로/앞으로 단축키 | [공식 FAQ](https://menubarx.app/faq/) | 높음 |
| 참고 제품의 `menubarx://open/` URL scheme 및 URL, 창 크기, User-Agent 모드, 바 표시 매개변수 | [공식 FAQ](https://menubarx.app/faq/) | 높음 |
| Pro 라이선스에서 무제한 탭/북마크, 사용자 지정 시작 페이지/아이콘 제공 | [공식 Pro 안내](https://menubarx.app/buy/) | 높음 |
| 사용자 지정 HTTP/SOCKS5 프록시, hover 열기, 노치 가이드 | [공식 변경 이력](https://menubarx.app/more/) | 높음 |
| MenubarX는 macOS 전용이며 WebKit/WKWebView 기반 | [Mac App Store 설명](https://apps.apple.com/us/app/menubarx-floating-browser/id1575588022?mt=12), [공식 홈페이지](https://menubarx.app/) | 높음(플랫폼), 중간(엔진: App Store 설명 기반) |

공식 홈페이지는 일부 상세 동작 설명이 짧아, 아래의 구조/우선순위는 공개 기능에서 도출한 **제품 분석 및 구현 제안**이다. 픽셀 단위 UI, 미공개 동기화 포맷, 내부 알고리즘은 관찰되지 않았다.

## 제품 기능 모델

### 1. 실행 진입점 및 패널

- 메뉴 막대 아이콘 클릭으로 웹 패널을 열고 닫는다.
- 전역 키보드 단축키로 토글한다. FAQ에 기재된 기본값은 `Option+X`다.
- 패널은 크기 조절 가능하며, 별도 창으로 분리(detach)하거나 화면 위에 고정(pin)할 수 있다.
- 노치가 메뉴 막대 아이콘/패널 위치를 가로막는 경우 분리 창으로 안내하는 경로가 변경 이력에 등장한다.
- 메뉴 막대 우클릭은 새 탭 같은 빠른 명령을 제공한다.

### 2. 웹 탐색과 탭

- 주소/검색 입력에서 URL을 열거나 설정된 검색 엔진으로 검색한다.
- 새 탭은 시작 페이지를 표시하며, 탭은 선택·추가·닫기·순환 전환·숫자 단축키 선택이 가능하다.
- 뒤로/앞으로, 새로고침, 캐시 삭제 새로고침, 페이지 확대/축소가 키보드 동작으로 제공된다.
- 웹 앱/PWA를 사이트별 창으로 다룬다. 웹 알림 및 비디오 Picture-in-Picture 지원 이력이 있다.
- 시작 페이지에 사용자 지정 사이트 아이콘을 구성할 수 있다.

### 3. 사이트 구성 및 지속성

- 북마크를 저장하고 관리하며 시작 페이지에서 추가/삭제/재배열한다.
- 자동 새로고침 간격은 빠른 컨텍스트 메뉴에서 바꿀 수 있다.
- 사이트 또는 창 단위로 User-Agent/기기 시뮬레이션을 바꿀 수 있다. 공개 자료에는 iPhone/iPad/Mac과 Kindle 등이 언급된다.
- 버전 이력에는 설정 복원, iCloud 동기화, 사이트별 캐시 제거, 페이지 자동 해제 등 지속성/자원 관리 기능이 있다.
- 사용자 지정 네트워크 프록시(HTTP/SOCKS5)는 변경 이력상 최신 추가 기능이다.

### 4. 개발자 및 호환성 기능

- 참고 제품의 `menubarx://open/` URL scheme은 웹 주소와 선택적 창 크기, User-Agent 모드, 주소 바 표시 여부를 받는다. Just Browse의 scheme은 `justbrowse://`다.
- 설정을 통해 웹 인스펙터를 열 수 있다.
- HTML5 Web Notifications를 지원한다.
- Bartender/Hidden Bar와의 메뉴 막대 아이콘 호환을 위한 별도 설정 안내가 있다.

## 핵심 사용자 흐름

1. **빠른 웹 앱 열기:** 전역 단축키 또는 메뉴 막대 아이콘 → 패널 표시 → 시작 페이지의 사이트 선택 → 로그인 상태를 유지한 웹 앱 사용 → 외부 앱으로 전환 시 패널 숨김.
2. **새 URL 열기:** 패널 열기 → 주소 입력 포커스 → URL 또는 검색어 입력 → 새 탭/현재 탭에서 이동.
3. **자주 쓰는 사이트 등록:** 북마크 관리 → URL/이름/아이콘 구성 → 시작 페이지에서 선택.
4. **사이트별 도구 사용:** 사이트 열기 → 창 고정/분리/크기 변경 또는 자동 새로고침/User-Agent 선택.
5. **개발자 호출:** 외부에서 `justbrowse://open/` URL 호출 → 매개변수 검증 → 지정된 주소 및 창 설정으로 열기.

## 품질 및 보안 요구사항 (분석/제안)

- 패널을 숨겨도 사이트 로그인과 세션이 보존되어야 한다.
- 임의 사이트를 탐색하는 제품이므로 현재 ChatGPT 전용 호스트 허용목록을 일반 웹 탐색 정책으로 대체하되, `https:`를 기본으로 하고 외부 프로토콜 실행을 분리해야 한다.
- 새 창/팝업, 다운로드, 클립보드, 알림, 위치, 카메라, 마이크 권한은 목적과 출처별로 제한하고 사용자에게 명확히 표시해야 한다.
- 사용자 지정 URL scheme은 목적지와 숫자 매개변수를 검증해야 하며 임의 스크립트 실행 인터페이스로 확장하면 안 된다.
- 앱 종료/세션 폐기 동작, 쿠키/사이트 데이터 삭제 범위를 설정에서 설명해야 한다.
- 탭 수가 늘어날 때 비활성 탭의 WebContents를 유지/폐기하는 정책이 메모리와 세션 연속성에 영향을 준다.

## 저장소 갭 분석

| 역설계 요구 | 현재 저장소 관찰 | 갭 |
|---|---|---|
| 메뉴 막대 아이콘/우클릭 메뉴 | `src/main/index.ts`에서 BrowserWindow 및 단축키 기반 플로팅 창을 구성. Tray 구현은 검색 결과 없음 | 큼: Electron Tray 및 플랫폼 UX 필요 |
| 다중 임의 웹 사이트 | `src/shared/providers.ts` 및 main process는 등록된 provider 중심, ChatGPT가 기준 기능 | 큼: 일반 탐색/탭 모델/주소 정책 재설계 |
| 탭/사이트별 세션 | Provider view registry는 provider별 WebContentsView 관리 | 큼: 탭 ID, URL/제목/favicon, 로딩·탐색 상태, 복원 모델 필요 |
| 주소창/검색/시작 페이지 | 현재 UI는 Provider 페이지를 바로 로드하며 별도 주소창/홈 화면 없음 | 큼 |
| 북마크 | 전용 북마크 저장소/관리 UI 검색 결과 없음 | 중간~큼 |
| 분리·고정·창 크기 | 현재 popover/expanded/fullscreen 모드와 always-on-top 설정 존재 | 중간: 창 고정은 근접하나 메뉴 막대 anchor 및 detach 모델은 별도 |
| User-Agent/기기 시뮬레이션 | 설정에 페이지 확대/축소는 있으나 UA 프리셋 없음 | 중간 |
| 자동 새로고침/광고 차단/웹 알림 | 각각 메뉴바 브라우저 제품 범위의 구현은 없음 | 중간~큼, 권한/호환성 검증 필요 |
| URL scheme | `justchat://` 내부 단축키 연동만 확인됨 | 중간: 등록/파싱/안전한 외부 호출 구현 필요 |
| macOS 전용 메뉴 막대 동작 | Electron과 Tauri 양쪽 호스트가 존재하지만 기존 제품은 교차 플랫폼 | 큼: 첫 릴리스 지원 OS 범위 결정 필요 |

## 제안된 단계적 구현 범위

### Phase 0 — 제품 방향 (확정)

- 기존 Just Chat과 별개인 새 앱을 `menubarx-app/`에 구현한다.
- MenubarX의 macOS 타깃과 맞춰 macOS부터 지원한다. 참고 앱 plist는 최소 macOS 14를 선언한다.
- 원본 소스와 artwork는 복사하지 않고 관찰 가능한 기능을 독립 코드로 재구현한다.
- 동기화, 유료 기능, 광고 차단, 사용자 스크립트와 프록시는 핵심 경험 안정화 이후로 미룬다.

### Phase 1 — 로컬 MVP (구현됨)

- macOS 메뉴 막대 아이콘, 토글 패널, 기본 전역 단축키.
- [x] 주소/검색 입력과 임의 HTTPS 사이트 열기.
- [x] 기본 시작 페이지 및 로컬 북마크 바로가기.
- [x] 다중 탭, 지속 세션, 탭 복원, 새로고침/뒤로/앞으로.
- [x] 창 크기 조절, 고정, 앱 포커스 상실 시 숨김.
- [x] 탭/북마크 URL과 제목의 로컬 영속화.
- [x] 팝업은 차단하고 HTTPS 외부 링크는 기본 브라우저로 보낸다. 알림·위치·카메라·마이크는 기본 거부하고 최상위 출처별 승인 및 취소를 제공한다.
- [x] Google/DuckDuckGo/Bing 검색 제공자 설정과 `justbrowse://open/` URL scheme (`menubrowser://` compatibility alias).

### Phase 2 — 브라우저 생산성 기능 (진행 중)

- [x] 북마크, 탭 단축키와 재시작 후 탭 복원.
- [x] 탭을 표준 창으로 분리하고 메뉴 막대 패널로 다시 합친다. 창 위치/크기 기억은 미구현.
- [x] 탭별 자동 새로고침과 확대/축소.
- [x] 탭별 User-Agent와 Desktop/iPhone/iPad/Pixel viewport 시뮬레이션 및 새 탭 기본값.
- [x] 알림·위치·카메라·마이크 권한을 사이트별로 묻고 설정에서 허용을 취소한다. Electron 권한 확인/요청 handler와 macOS OS 권한 요청을 함께 구성한다.
- [x] 브라우저 메뉴에서 현재 사이트의 쿠키·로컬 스토리지·데이터베이스·서비스 워커 데이터를 확인 후 초기화한다.

### Phase 3 — 고급 기능 (후속 범위)

- iCloud 또는 다른 동기화, 사용자 지정 프록시, 광고 차단, 사용자 스크립트/CSS.
- 인앱 결제 및 기능 제한 체계.
- 화면 공유 권한은 현재 기본 거부하며 지원하지 않는다.

## 현재 MVP 구현 상태

- [x] 메뉴 막대 아이콘과 전역 단축키로 패널을 열고 닫는다.
- [x] HTTPS 주소 또는 검색어를 열고 뒤로/앞으로/새로고침한다.
- [x] 탭과 로컬 북마크를 복원하고 시작 바로가기의 이름·주소·표시 아이콘을 편집하고 순서를 변경한다.
- [x] 탭별 자동 새로고침 간격을 끄거나 15초/30초/1분/5분으로 바꾼다.
- [x] Google/DuckDuckGo/Bing 검색엔진을 선택하고 이를 로컬 설정으로 기억한다.
- [x] `⌘,`로 패널 모드에서는 메인 플로팅 창 안에서, 표준 창 모드에서는 부모 창에 붙은 포커스 모달로 설정을 열고 홈페이지, User-Agent, 새 탭 기본값, 다운로드 폴더, 각 브라우저 동작의 단축키, 탭 복원과 포커스 상실 설정을 저장한다.
- [x] `justbrowse://open/?url=...&width=...&height=...` 딥링크에서 HTTPS 목적지와 크기 범위를 검증한다. 기존 `menubrowser://` scheme도 호환한다.
- [x] 알림·위치·카메라·마이크는 기본 거부하며 최상위 출처와 일치할 때 묻는다. macOS 카메라/마이크 usage description과 OS 권한 요청을 구성하고, 허용 내역은 설정에서 취소할 수 있다. 화면 공유는 거부한다.
- [x] 현재 사이트 데이터 삭제는 사용자의 확인 후 해당 출처 범위에 한해 수행하며, 해당 출처에 저장한 앱 권한도 같이 취소한다.
- [x] 페이지 줌, 뒤로/앞으로, 링크/이미지 저장·복사를 제공하는 컨텍스트 메뉴가 있다.
- [x] 다운로드 목록에서 진행 상태를 보고 일시정지·취소·재개·완료 파일 위치 열기를 제공한다. 재실행 후 저장 메타데이터로 Chromium 중단 다운로드 재개를 시도한다. 서버가 byte-range/ETag/Last-Modified를 지원하지 않으면 재개할 수 없다.
- [x] 창 크기 조절과 핀 상태를 제공한다. 현재 사이트를 브라우저 탭과 분리된 웹앱 창으로 열 수 있다.
- [x] Desktop/iPhone SE/iPhone 16/iPad/Pixel 9 viewport와 새 탭 기본 프로필을 제공한다.
- [x] 사용자 지정 탭 최대 개수와 유휴 탭 WebContents 폐기 시간을 설정할 수 있다. 폐기된 탭 재활성화 시 URL을 다시 연다.
- [x] 오리지널 앱 아이콘, macOS DMG/ZIP 및 Windows NSIS 패키징 설정, 카메라/마이크 설명문과 signing/notarization 환경 변수 구성을 추가했다.
- [ ] 실제 MenubarX UI 런타임 비교는 완료되지 않았다. REA 네이티브 UI 관찰 도구가 안정적인 프로세스/창 식별을 지원하지 않았고, OS 접근성 권한도 허용되지 않았다.
- 새 창은 차단한다. HTTPS 페이지가 명시적으로 요청한 팝업 URL만 기본 브라우저에서 연다. 알림·위치 권한은 사이트별 저장 및 취소를 지원하며, 카메라/마이크는 기본 거부한다.

## 알려진 후속 작업

- [x] 다운로드 저장 대화상자, 목록·일시정지·재개 시도·취소 UI
- [x] 알림·위치·카메라·마이크 사이트 권한 UI. 화면 공유는 미지원 및 기본 거부.
- [x] 사용자 확인이 있는 사이트별 데이터 삭제.
- [x] 검색 엔진 설정.
- [x] User-Agent 프리셋과 사용자 지정 입력.
- [x] `⌘,` 설정 화면. 패널 모드에서는 인플레이스, 표준 창 모드에서는 브라우저에 붙은 모달로 표시한다.
- [x] MenubarX FAQ의 탐색/탭/창/줌 단축키 흐름을 반영하고, 메뉴바·웹 콘텐츠 포커스에서 실행되도록 연결한다. 설정에서 조합을 직접 녹음하고, 중복은 저장 단계에서 거부하며 선택 단축키는 비울 수 있다. 전역 토글만 앱 외부에서도 작동한다.
- [x] 탭 수 상한과 비활성 탭 메모리 정책
- [x] 탭 분리 창.
- [x] 사용자 지정 새 탭 홈페이지.
- [x] 시작 페이지 바로가기 추가·편집·재정렬.
- [x] 앱 아이콘과 별도 macOS/Windows 배포 설정.
- [ ] Apple Developer ID/공증 자격 증명은 이 환경에 없어 배포용 서명과 공증은 수행하지 못함. 로컬 arm64 macOS 앱 디렉터리 패키징은 성공했으며 unsigned 상태.
- [ ] 실제 MenubarX 런타임 UI Evidence 확보

## 출처

- [MenubarX 공식 홈페이지](https://menubarx.app/)
- [MenubarX 공식 FAQ](https://menubarx.app/faq/)
- [MenubarX 공식 변경 이력](https://menubarx.app/more/)
- [MenubarX Pro 안내](https://menubarx.app/buy/)
- [Mac App Store 설명](https://apps.apple.com/us/app/menubarx-floating-browser/id1575588022?mt=12)
