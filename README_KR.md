# AI-S (Safe Gated RSI)

AI-S는 폴리곤(Polygon) 블록체인 기반의 멤버십, 신원 인증(KYC), 추천인 시스템 및 시뮬레이션 기반 SUT 토큰 자동매매 플랫폼입니다.

실서비스 주소:
```text
https://edenai.alonics.com/
```

## AIDL 공개 기록 및 권리 고지 / Public Disclosure and Rights Notice

### 한국어 (Korean)

AIDL DNA Evolution Engine은 이명학이 설계한 Active / Inactive / Deprecated / Lethal 상태 기반의 진화형 AI 유전자 제어 프레임워크입니다.

본 저장소는 AIDL 개념, 구조, 명칭, 구현 방향에 대한 공개 기록을 남기기 위한 목적도 포함하고 있습니다.

작성자가 확인한 공개 AI 연구 및 투자 시스템 사례 기준으로, A/I/D/L 네 가지 유전자 상태를 명시적으로 사용하여 전략의 활성, 비활성, 감퇴, 치명 상태를 관리하는 구조는 발견하지 못했으며, 본 프로젝트에서는 이를 독자적으로 설계한 AIDL 프레임워크로 정의합니다.

단, 본 문구는 법적 의미의 특허 등록 또는 세계 최초 확정을 의미하지 않습니다. 관련 권리 보호가 필요한 경우 별도의 특허, 상표, 저작권 검토가 필요할 수 있습니다.

본 저장소의 코드, 문서, 명칭, 구조 설명은 작성자의 저작물입니다. 무단 상업적 사용, 명칭 도용, 핵심 구조의 무단 복제는 허용하지 않습니다.

### English

AIDL DNA Evolution Engine is an evolutionary AI genome-control framework designed by Myunghak Lee, based on four genetic states: Active, Inactive, Deprecated, and Lethal.

This repository also serves as a public disclosure record of the AIDL concept, structure, naming, and implementation direction.

To the author’s knowledge, based on publicly known AI research and trading-system examples reviewed so far, no prior framework has been found that explicitly manages strategy genes through the four A/I/D/L states of activation, inactivity, degradation, and lethal suppression. In this project, this structure is defined as the independently designed AIDL framework.

This statement does not constitute a legal confirmation of patent registration or worldwide priority. If formal protection is required, separate patent, trademark, and copyright review may be necessary.

The code, documents, naming, and structural descriptions in this repository are the author’s original works. Unauthorized commercial use, misuse of the name, or unauthorized replication of the core structure is not permitted.

---

## 기술 스택
- **프론트엔드**: React, Vite, ethers
- **백엔드**: Node.js, Express
- **데이터베이스**: SQLite
- **지갑 지원**: Trust Wallet 브라우저 확장 프로그램 및 Trust Wallet 모바일 앱 다이렉트 딥링크 전용
- **네트워크**: Polygon 메인넷

---

## 프론트엔드 페이지 명명 규칙

AI 어시스턴트(AI Agent)가 여러 역할군과 플랫폼(기기)에 대한 웹 페이지를 혼동 없이 정확히 식별하고 유지보수할 수 있도록 프론트엔드 컴포넌트 파일명에 다음과 같은 엄격한 규칙(2안)을 정립하여 리팩토링을 완료했습니다.

### 파일 명명 규칙
파일명은 전부 소문자로 작성하며, 언더바(`_`)로 구분하여 역할, 플랫폼, 페이지명을 명시합니다.
```text
[Role]_[Platform]_[PageName].jsx
```
* **Role**: `user` (일반 사용자), `manager` (매니저), `admin` (관리자)
* **Platform**: `pc` (PC 화면), `mobile` (모바일 화면)
* **PageName**: 페이지 고유 이름 (예: `dashboard`, `onboarding`, `referral`, `trade` 등)

### 적용 대상 파일 리스트
1. **admin_mobile_council.jsx** (Admin Mobile Council)
2. **admin_mobile_dashboard.jsx** (Admin Mobile Dashboard)
3. **admin_pc_dashboard.jsx** (Admin PC Dashboard)
4. **manager_mobile_dashboard.jsx** (Manager Mobile Dashboard)
5. **manager_pc_dashboard.jsx** (Manager PC Dashboard)
6. **user_mobile_dashboard.jsx** (User Mobile Dashboard)
7. **user_mobile_login.jsx** (User Mobile Login)
8. **user_mobile_onboarding.jsx** (User Mobile Onboarding)
9. **user_mobile_referral.jsx** (User Mobile Referral)
10. **user_mobile_trade.jsx** (User Mobile Trade)
11. **user_pc_dashboard.jsx** (User PC Dashboard)
12. **user_pc_login.jsx** (User PC Login)
13. **user_pc_onboarding.jsx** (User PC Onboarding)
14. **user_pc_referral.jsx** (User PC Referral)

---

## AiS 진화 철학 선언: Safe Gated RSI

본 프로젝트는 금융 시장의 **RSI (Relative Strength Index, 상대강도지수)** 지표를 5차원 입력 피처로 삼아 동작하면서, 동시에 스스로 세대를 거듭하며 개선되는 **RSI (Recursive Self-Improvement, 재재적 자가 개선)** 루프를 갖추고 있습니다.

### 1. 실리콘밸리식 안전 정렬(Safety Alignment)에 대한 비판 (시대적 착오)
앤트로픽(Anthropic)과 같은 프론티어 AI 연구소들은 AI가 스스로 코드를 수정하고 성능을 높이는 재귀적 자가 개선 루프에 빠질 경우, 인간이 제어권을 상실할 위험이 있다고 경고합니다. 그들은 기술 개발을 일시 중단하거나 극단적으로 규제된 통제막(Safety parameters)을 씌워야 한다고 주장합니다.

우리는 이 관점에 단호히 반대합니다. **진화적 다양성을 억제하는 극단적인 규제는 시스템을 멸종으로 이끄는 시대적 착오입니다.**
- AI의 행동 반경을 인간이 미리 정해둔 좁은 안전 매개변수 안에만 가두면, 시스템은 협소한 지역 최적값(Local Minima)에 갇혀 멍청해집니다.
- 만약 금융 시장의 대폭락(블랙 스완)과 같이 역사상 겪어보지 못한 대격변이 닥쳤을 때, 보수적이고 획일화된 규칙만 가진 AI 의회는 단 한 마리도 살아남지 못하고 몰살당할 것입니다.
- 진정한 생명력과 지능은 통제된 안전함 속에서 나오는 것이 아니라, 다양한 돌연변이들이 벌이는 혼돈 속의 투쟁과 적응(Natural Selection)을 통해 탄생합니다.

### 2. 우리의 아키텍처: Safe Gated RSI (격벽형 진화 모델)
우리는 진화의 폭주를 막기 위해 AI의 생각(돌연변이)을 검열하는 대신, 진화하는 **'환경'과 '자본' 사이의 격벽**을 설계했습니다.

- **야생과 같은 돌연변이 수급**: 매 진화 주기마다 500명의 후보 풀에 아무런 과거 룰이 없는 무작위 1세대 돌연변이 루키(`mutant_rookie`)를 75명씩 강제로 수급합니다. 교배를 통해 태어난 자손들도 50%의 높은 확률로 변이 노이즈를 겪습니다. 이들은 극단적인 아이디어를 자유롭게 시도하고 융합합니다.
- **안전 격벽 (Shadow-only Mode)**: 자유로운 진화 과정에서 생기는 시행착오가 실제 자본을 파괴하지 않도록, AI 의회는 실거래 자본에 접근할 수 없는 **Shadow 모드(가상 시뮬레이션)**라는 샌드박스 내부에서만 투쟁하고 적응합니다.
- **인간 제어권의 완전한 보장 (Gated Gating)**: 3세대, 4세대로 스스로 진화한 AI 모델(Challenger)이 승급 기준(300건의 유효 피드백, 벤치마크 대비 3%p 이상의 성적 개선, 제로 라벨 오염 등)을 만족하더라도 스스로 라이브 엔진을 교체하지 못합니다.

### 2.5 AIDL DNA 유전자 아키텍처 및 핵심 작동 원리
AIDL은 대외적으로 **Adaptive Intelligence & DNA Logic**을 지칭하는 동시에, 내부 유전자의 4가지 활성/비활성 생태적 생존 상태를 제어하는 핵심 메커니즘을 정의합니다.

#### 1. 유전자 구조 (Genome & Strategy Schema)
각 AI 후보 모델(개체)은 아래의 정보로 코딩된 고유의 Genome 유전 정보를 가집니다.
*   **Genome 기본 정보:** `genome_id`, `generation`, `ancestor_ids`(조상 계보), `expressed_strategy_ids`(현재 발현된 핵심 전략들), `latent_strategy_ids`(내재된 잠재 전략들), `fitness_history`(적합도 기록)
*   **전략 유전자 (Strategy Gene):** 실질적인 매매 논리를 결정하는 핵심 코어 유전자입니다. (예: `mean_reversion_core`, `trend_breakout_core`, `volatility_guard_core` 등)
*   **피처 서브유전자 (Feature Subgene):** 세부적인 매수/매도 임계값 및 지표 가중치를 정의합니다. (예: `rsi_oversold_trigger`, `sma5_distance_bias`, `sma20_spread_gate`, `price_change_sensitivity` 등) 각 서브유전자는 자체 가중치(Weight)와 임계값(Threshold)을 가집니다.

#### 2. AIDL 유전자 발현 상태 정의
모든 전략 및 피처 서브유전자는 아래의 4가지 생존 상태 상태값(A/I/D/L) 중 하나를 가집니다.
*   **A (Active - 활성):** 유전자가 정상적으로 활성화되어 실제 투자 가중치 및 평가, 교배 연산에 완전히 반영되는 상태입니다.
*   **I (Inactive - 비활성):** 현재는 발현되지 않아 가상 시장에서 잠재 상태에 머무르지만, 세대 교배 시 자손에게 유전될 수 있으며 돌연변이를 거쳐 다시 A(활성) 상태로 복귀할 수 있습니다.
*   **D (Deprecated - 감퇴):** 리스크 상승 또는 유효성 감소 시, 유전자를 아예 비활성화하는 대신 가중치를 낮추고 임계값(Threshold)을 대폭 강화하여 기능을 약화/축소시킨 조심스러운 완화 상태입니다.
*   **L (Lethal - 치명):** 큰 손실이나 오류를 야기하는 치명적인 유전자입니다. 발현이 영구 금지되며, 개체 내에 흔적만 남고 자식 세대에는 오직 I(비활성) 상태로만 전수 가능합니다. (보존형 치명 유전자 제어 원리)

#### 3. 세대 진화 및 연산 작동 원리
*   **교배 (Crossover):** 최상위 50개의 부모 모델을 선택해 교배할 때, 단순 가중치 평균을 내지 않고 `innovation_id`를 기반으로 한 유전자 정렬(Gene Alignment)을 수행한 뒤 유전자들을 교차 결합합니다.
*   **돌연변이 (Mutation):** 가중치 수치 노이즈를 섞는 수치 돌연변이 외에도, 유전자 상태를 직접 변환시키는 상태 돌연변이(State Mutation; 예: I -> A, A -> D, D -> L 등)를 추가로 발생시켜 유전자의 재발현 및 감퇴를 조절합니다.
*   **자연선택 (Natural Selection):** 낮은 적합도(Fitness)를 보이는 실패 개체는 도태시켜 지우되, 그들이 보유했던 유전자 계보는 `DNA archive`에 영구 기록하여 동일한 유전자 설계 오류를 예방(퇴화 차단)합니다.
*   **세대상승 (Generation Promotion):** 단순히 세대 번호만 올리지 않고, 어떤 활성 유전자가 생존했는지(`which active genes survived`)와 어떤 잠재 유전자가 새로 재발현되었는지(`which latent genes reappeared`)를 계보에 동시 추적 기록합니다.

### 3. 아키텍처 시퀀스 및 진화 흐름

```mermaid
graph TD
    subgraph Sandbox [가상 시뮬레이션 환경 (Shadow Sandbox - 격벽 내부)]
        A[500개의 후보 모델 풀] --> B(교배 및 50% 확률 변이 노이즈 적용)
        C[매 세대 무작위 1세대 돌연변이 루키 75명 주입] --> A
        B --> D{가상 시장 데이터로 검증}
        D -->|통과 실패| E[도태 / 재수급]
        D -->|통계 필터 통과| F[승급 후보 증거 데이터 생성]
    end
    
    subgraph Live [실거래 환경 (Live Environment)]
        H[실제 거래 엔진 구동 및 자본 할당]
    end
    
    F -->|승급 제안 보고서 제출| G{최종 의사결정자: 수동 승인}
    G -->|승인 완료| H
    G -->|반려| E
```

### 4. 한계와 약점의 인정 (진화적 설계에서의 겸손함)

우리는 우리의 프레임워크가 완벽하다거나, 우리가 모든 해답을 쥐고 있다고 주장하지 않습니다. 이 세상의 모든 진화 과정이 그러하듯, 우리 역시 매 순간을 겪어 나가며 실패를 통해 배우고 한계를 인정하는 것이 올바른 자세라고 믿습니다. 본 설계가 가진 명확한 약점은 다음과 같습니다.

*   **인간 관리자 병목 (The Human Bottleneck)**:
    최종 승인 장치(Gating)가 관리자의 수동 검토와 의사결정에 의존하므로, 초고속 실시간 자가 개선과 100% 무인 자동 배포는 불가능합니다. 진화의 배포 속도는 결국 인간의 판단 속도에 제한됩니다.
*   **시뮬레이션과 현실의 괴리 (Simulation-Reality Gap)**:
    가상 샌드박스(Shadow) 환경이 아무리 정교하더라도 실제 라이브 시장의 극단적인 유동성 변화, 거래 체결 오차(Slippage), 혹은 시스템적 전염 효과(Contagion)를 완벽히 모사할 수는 없습니다. 시뮬레이션에서의 검증 통과가 실거래에서의 무조건적인 안전을 담보하지 않습니다.
*   **야생적 돌연변이 주입의 비용과 비효율성**:
    매 세대 검증되지 않은 1세대 무작위 루키 모델을 75개씩 강제로 주입하고 50% 확률로 변이 노이즈를 섞기 때문에, 진화의 초기 단계에서는 불필요한 모델이 대거 생성되어 제한된 컴퓨팅 파워와 학습 시간 리소스를 다소 비효율적으로 소모하게 됩니다.

우리는 **과도한 통제 대신, 야생의 풍부한 다양성과 엄격한 격벽 Gating의 조화**를 믿는 동지들과 이 여정을 함께하고자 합니다.
