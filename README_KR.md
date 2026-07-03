# AI-S (Safe Gated RSI)

AI-S는 폴리곤(Polygon) 블록체인 기반의 멤버십, 신원 인증(KYC), 추천인 시스템 및 시뮬레이션 기반 SUT 토큰 자동매매 플랫폼입니다.

실서비스 주소:
```text
https://ais.alonics.com/
```

## AIDL 공개 기록 및 권리 고지 / Public Disclosure and Rights Notice

### 한국어 (Korean)

AIDL DNA Evolution Engine은 이명학이 설계한 Active / Inactive / Deprecated / Lethal 상태 기반의 진화형 AI 유전자 제어 프레임워크입니다.

본 저장소는 AIDL 개념, 구조, 명칭, 구현 방향에 대한 공개 기록을 남기기 위한 목적도 포함하고 있습니다.

작성자가 확인한 공개 AI 연구 및 투자 시스템 사례 기준으로, A/I/D/L 네 가지 유전자 상태를 명시적으로 사용하여 전략의 활성, 비활성, 감퇴, 치명 상태를 관리하는 구조는 발견하지 못했으며, 본 프로젝트에서는 이를 독자적으로 설계한 AIDL 프레임워크로 정의합니다.

단, 본 문구는 법적 의미의 특허 등록 또는 세계 최초 확정을 의미하지 않습니다. 관련 권리 보호가 필요한 경우 별도의 특허, 상표, 저작권 검토가 필요할 수 있습니다.

본 저장소의 소스코드, 문서 및 설명 텍스트는 작성자의 저작물입니다.

"AIDL" 및 "AIDL DNA Evolution Engine" 명칭은 본 저장소를 통해 공개 기록된 프로젝트 식별자이며, 별도의 상표 등록이 이루어지지 않은 상태에서는 상표권을 주장하지 않습니다.

AIDL 개념 및 유전자 상태 모델은 공개 기록의 목적으로 게시되었으며, 별도의 특허 또는 상표 등록 없이 일반적인 진화형 알고리즘 개념에 대한 독점권을 주장하지 않습니다.

### English

AIDL DNA Evolution Engine is an evolutionary AI genome-control framework designed by Myunghak Lee, based on four genetic states: Active, Inactive, Deprecated, and Lethal.

This repository also serves as a public disclosure record of the AIDL concept, structure, naming, and implementation direction.

To the author’s knowledge, based on publicly known AI research and trading-system examples reviewed so far, no prior framework has been found that explicitly manages strategy genes through the four A/I/D/L states of activation, inactivity, degradation, and lethal suppression. In this project, this structure is defined as the independently designed AIDL framework.

This statement does not constitute a legal confirmation of patent registration or worldwide priority. If formal protection is required, separate patent, trademark, and copyright review may be necessary.

The source code, documentation, and explanatory text in this repository are the author's original works.

The names "AIDL" and "AIDL DNA Evolution Engine" are project identifiers publicly recorded through this repository, and no trademark rights are claimed unless separate trademark registration is established.

The AIDL concept and genetic state model are published for public disclosure purposes, and no exclusive ownership is claimed over general evolutionary algorithm concepts without separate patent or trademark registration.

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

#### 4. 시장 4대 맥락 기반 조건부 유전자 제어 및 진화 (Contextual Evolution)
AI 모델이 단일한 가중치 뭉치로만 작동할 경우, 폭락장이나 급변하는 변동성 장세에 대처하지 못하고 몰살당하기 쉽습니다. 이를 극복하기 위해 **시장의 4대 맥락(계절)**을 실시간 감지하여 그에 알맞은 복제·파생 유전자가 동적으로 발현되는 시스템을 구현하였습니다.
*   **시장 계절 분류 기준**:
    *   **장기 추세 (240일 이동평균선)**: 가격이 SMA240 위에 있으면 상승세(BULL), 아래에 있으면 하락세(BEAR)로 판별.
    *   **단기 변동성 (ATR 대용 14일 고가-저가 평균)**: 최근 14일간의 고가-저가 밴드폭 평균을 기준으로 변동성 확장기(EXPANSION)와 수축기(SQUEEZE)를 판별.
    *   이를 조합하여 **BULL_EXPANSION, BULL_SQUEEZE, BEAR_EXPANSION, BEAR_SQUEEZE** 4대 기후(계절)를 실시간 감지합니다.
*   **맥락적 조건부 발현 (Contextual Expression)**:
    *   각 전략 유전자(Strategy Gene)는 동작이 허용되는 기후 리스트인 `context_mask`를 코딩하고 있습니다.
    *   추론 시점의 실시간 감지된 시장 기후에 해당하는 유전자들만 선택적으로 활성화(Active)되어 가중치(Centroids) 조립에 반영됩니다. 맞지 않는 유전자들은 비활성화(Inactive)되어 리스크 노출을 원천 차단합니다.
*   **맥락적 돌연변이 (Context Mutation)**:
    *   매 진화 주기마다 10%의 확률로 특정 유전자의 `context_mask`에 특정 시장 기후 태그를 임의로 추가하거나 빼는 돌연변이가 발생합니다.
    *   이를 통해 특정 유전자가 하락 횡보장이나 상승 폭등장 등 특정 환경에 극도로 전문화된 곁가지 유전자로 자연스럽게 분화합니다.
*   **합집합 유전 상속 (Crossover)**:
    *   교배 시 양 부모 유전자가 가졌던 작동 기후 정보(`context_mask`)를 합집합(Union)하여 자손에게 온전히 물려줍니다. 이를 통해 자손들은 조상 세대가 겪었던 다양한 생존 본능을 고스란히 상속받게 됩니다.
*   **자가 치유 마이그레이션 (Self-healing)**:
    *   기존 데이터베이스에 저장되어 있던 구세대 DNA(즉, `context_mask` 정보가 유실되어 에러를 유발할 수 있는 개체들)를 로딩할 때, 시스템이 자동으로 이를 감지하여 4대 계절 전체 태그를 기본 주입하는 자가 복구 마이그레이션을 런타임에 실행합니다.

*   **적합도 이력 영속성 가드 (Fitness History Persistence Guard)**:
    *   현재 선거 런타임은 `fitness_history`를 추가하기 전에 DNA 패키지를 명시적으로 깊은 복사하여, 계보 이력 기록 과정이 실운영 의회 선거 루프를 중단시키지 않도록 보호하며 이 경로에 대한 회귀 테스트도 함께 유지합니다.

#### 5. 과학 분야 생명공학 연구의 접목 및 영감 (AI-VEP & AISG)
본 AIDL DNA Evolution Engine은 설계 과정에서 구글 DeepMind의 AlphaGenome 연구, EMBL-EBI의 Ensembl VEP(Variant Effect Predictor) 등의 실제 생명과학/유전공학 알고리즘에서 다음과 같은 큰 설계적 영감을 받아 실질적인 진화 안전 로직으로 이식되었습니다.
*   **AI-VEP (AI Variant Effect Predictor: AI 변이 효과 예측기)**:
    *   생물학적 VEP가 유전자 염기 변이의 치명성(Lethality)을 사전에 시뮬레이션하듯, 돌연변이 연산 직후 해당 가중치 변이가 "하락 확장기(BEAR_EXPANSION)" 등의 위기 상황에서 파멸적인 오작동(예: 극단적 과적합 또는 성급한 추격 매수 가중치 쏠림)을 유발할 가능성이 있는지 선제적으로 예측 및 스크리닝합니다.
    *   VEP 스크리닝 결과 `LETHAL` 판정이 난 위험한 변이 모델은 가상 환경(Sandbox) 평가에 들어가기 전에 필터링되어 즉시 차단(Filtering out deleterious mutation)되고 안전한 부모 세대 가중치로 자동 회기 롤백됩니다.
*   **AISG Accession ID (유전자 서열 고유 식별 명세 체계)**:
    *   NCBI Entrez 및 Ensembl DB가 전 세계 수억 개의 유전자 및 단백질 서열에 표준화된 Accession ID(예: ENSG, XP_)를 발급하고 계보를 관리하는 것과 동일하게, AiS의 진화 풀에 소속된 모든 모델에 **`AISG-G{generation}-{unique_suffix}`** 형식의 영구 고유 식별 번호를 발급합니다.
    *   이를 통해 백테스팅 및 실거래 환경 전체에 걸쳐 어떤 세대(Gen)의 어떤 계보(lineage)의 유전자가 생존에 크게 기여했는지 데이터베이스 내에서 체계적으로 추적하고 마이그레이션할 수 있습니다.

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

---

## ⚖️ 라이선스 및 상업적 이용 문의

**AI-S (Safe Gated RSI)**는 오픈소스 라이선스 및 권리 보존을 준수하기 위해 **이중 라이선스 정책 (Dual License Policy)** 하에 제공됩니다.

### 1. AGPL-3.0 라이선스 기반의 오픈소스 이용
AGPL-3.0 라이선스는 상업적 사용 자체를 제한하지 않습니다. AGPL-3.0 조건(소스코드 수정 시 기여본 전체 공개 의무 등)을 충족하는 경우 누구나 상업적 목적으로도 자유롭게 사용할 수 있습니다.

### 2. 상업용 라이선스 및 통합 (Commercial Use)
AI-S 프로젝트는 저작권자가 별도의 상업용 라이선스를 제공하는 듀얼 라이선스 정책을 채택하고 있습니다. AGPL 의무를 이행하지 않고 폐쇄형 상용 서비스 또는 독점적 이용을 원하는 경우에는 반드시 원작자(Rejard)로부터 별도의 Commercial License를 취득해야 합니다.

AI-S 아키텍처를 상업용 독점 제품에 통합하거나 전담 기술 지원이 필요하신 경우, 아래 이메일로 연락해 주시기 바랍니다.

- 📬 **상업용 및 기술 문의:** lemaiii@alonics.com
- **저작권:** © 2026 Alonics Inc. All Rights Reserved.

---

## 📚 참고 문헌 및 연구 레퍼런스 (References)

본 프로젝트의 AIDL DNA Evolution Engine 및 격벽형 안전 진화 알고리즘의 유전학 모델 설계, 그리고 사용자 데이터 암호화 전송에는 아래와 같은 생명정보학(Bioinformatics) 및 암호학(Cryptography) 분야의 선행 연구 자료와 시스템 API 명세를 적극적으로 참조 및 인용(Citations)하였습니다.

1.  **Google DeepMind AlphaGenome (2026)**
    *   *Research Paper / Resource:* "Predicting genomic variant effects on gene expression and regulatory mechanisms using deep neural networks."
    *   *Application:* 변이의 조직 특이적 발현(Tissue-Specific Expression) 메커니즘을 4대 시장 맥락(BULL/BEAR × EXPANSION/SQUEEZE) 판별 및 조건부 유전자 활성/비활성 제어 스키마에 이식.
2.  **EMBL-EBI Ensembl Variant Effect Predictor (VEP) (2016)**
    *   *Reference publication:* McLaren, W., et al. "The Ensembl Variant Effect Predictor." *Bioinformatics*, 32(10), 1570–1575.
    *   *Application:* 돌연변이 가중치 변경 시 시장 붕괴 유발 및 과적합 리스크를 사전에 예측하고 필터링해내는 AI-VEP(Lethal/Deleterious variant filtering) 예방 엔진 설계의 근간으로 차용.
3.  **NCBI Entrez system & Sequence Databases (2018)**
    *   *Reference:* "Database resources of the National Center for Biotechnology Information." *Nucleic Acids Research*, 46(D1), D8–D13.
    *   *Application:* 고유의 서열 아카이브 구축 및 세대별 추적성을 유지하기 위한 `AISG` Accession ID 명세 체계 도입.
4.  **NIST SP 800-38D (Galois/Counter Mode - GCM) (2007)**
    *   *Specification:* Dworkin, M. "Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC." *NIST Special Publication*, 800-38D.
    *   *Application:* 대시보드 API 설정 및 인증 자격 증명 전송 시 정보 유출 방지를 위한 `AES-256-GCM` 대칭키 기밀성/무결성 군사급 암호화 처리.
5.  **NIST FIPS 180-4 (Secure Hash Standard - SHA-256) (2015)**
    *   *Standard:* "Secure Hash Standard (SHS)." *Federal Information Processing Standards Publication*, FIPS PUB 180-4.
    *   *Application:* 비밀 구절(Secret phrase) 입력을 통한 안전한 32바이트(256-bit) 암호화 키 유도(Key Derivation via SHA-256) 엔진 및 키 스트레칭 구현.

---

## AIDL 최신 운영 업데이트

아래 내용은 현재 서비스 코드와 관리자 운영 화면 기준으로 정리한 최신 AIDL 운영 구조입니다.

### 1. BLACK_SWAN은 4기후를 대체하지 않는 5번째 컨텍스트

이제 AIDL은 기존 4기후

- `BULL_EXPANSION`
- `BULL_SQUEEZE`
- `BEAR_EXPANSION`
- `BEAR_SQUEEZE`

위에 별도의 희귀 충격 컨텍스트인 `BLACK_SWAN`을 추가로 지원합니다.

핵심 원칙은 다음과 같습니다.

- 기본 부트스트랩과 self-healing 기준은 여전히 기존 4기후입니다
- `BLACK_SWAN`은 평상시 기본값이 아니라 충격 구간에서만 활성화됩니다
- 유전자는 mutation 또는 명시적 `context_mask` 포함을 통해서만 `BLACK_SWAN`에 참여합니다
- 즉, 4기후 체계를 깨지 않고 그 위에 희귀 충격 전용 분기만 얹는 구조입니다

### 2. BLACK_SWAN 판별 기준

현재 런타임은 아래 두 조건을 동시에 만족할 때만 해당 바를 `BLACK_SWAN`으로 분류합니다.

- 종가 기준 절대 변동률이 `6.0%` 이상
- 현재 고가-저가 range가 최근 14개 바 평균 range의 `2.5배` 이상

이 기준은 일반적인 고변동과 진짜 충격 구간을 섞지 않기 위한 운영 게이트입니다.

### 3. DNA 발현과 AI-VEP 확장 범위

최근 AIDL 작업으로 DNA 운영 범위가 다음처럼 넓어졌습니다.

- `context_mask` mutation이 `BLACK_SWAN` 추가/제거를 직접 다룹니다
- AI-VEP가 `BLACK_SWAN` 내부의 과도한 방향 추격 성향을 더 강하게 lethal screening 합니다
- 최근 holdout 붕괴 이력이 있으면 lethal 차단 강도가 더 올라갑니다
- context, override, lineage, repair 이력이 모두 관리자 audit 신호로 노출됩니다

### 4. 관리자 override와 telemetry의 결합

이제 관리자 수동 제어는 단순 강제 변경이 아니라, 변경 전후를 추적 가능한 telemetry와 함께 동작합니다.

- `A / I / D / L` 수동 변경은 `admin_state_override`로 기록됩니다
- `BLACK_SWAN` on/off 수동 변경은 `admin_context_override`로 기록됩니다
- override 시점에는 `pre_validation_score`, `pre_holdout_score`, `pre_run_key`가 함께 저장됩니다
- override outcome은 active/archive 평균 결과를 따로 보여줍니다
- override snapshot은 직전 평균과 현재 평균을 같이 보여줍니다
- override coverage는 snapshot 비교 가능 수와 post-only timeline 비교 가능 수를 같이 보여줍니다
- override timeline은 이제 override 이후 run만 집계합니다

### 5. 계보와 제어 surface의 마무리 상태

현재 관리자 AIDL surface는 아래 범위까지 연결되어 있습니다.

- active/archive genome의 accession 및 lineage 가시성
- accession, `context_mask`, `regulatory_profile` self-healing repair telemetry
- strategy gene 수동 override
- subgene state 수동 override
- 후보군/의회 DNA context visibility의 관리자 전용 유지

정리하면, 현재 AIDL은 단순한 4상태 유전자 실험이 아니라 5번째 충격 컨텍스트, 관리자 감사 telemetry, lineage 추적, 수동 제어까지 포함한 운영형 DNA 진화 엔진으로 확장된 상태입니다.

---
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
*   **I (Inactive - 비활성):** 현재는 발현되지 않아 가상 시장에서 잠재 상태에 머무르지만, 세대 교배 시 자손에게 유전될 수 있으며 돌연변이를 거쳐 다시 A(활성) 상태로 복귀할 수합니다.
*   **D (Deprecated - 감퇴):** 리스크 상승 또는 유효성 감소 시, 유전자를 아예 비활성화하는 대신 가중치를 낮추고 임계값(Threshold)을 대폭 강화하여 기능을 약화/축소시킨 조심스러운 완화 상태입니다.
*   **L (Lethal - 치명):** 큰 손실이나 오류를 야기하는 치명적인 유전자입니다. 발현이 영구 금지되며, 개체 내에 흔적만 남고 자식 세대에는 오직 I(비활성) 상태로만 전수 가능합니다. (보존형 치명 유전자 제어 원리)

#### 3. 세대 진화 및 연산 작동 원리
*   **교배 (Crossover):** 최상위 50개의 부모 모델을 선택해 교배할 때, 단순 가중치 평균을 내지 않고 `innovation_id`를 기반으로 한 유전자 정렬(Gene Alignment)을 수행한 뒤 유전자들을 교차 결합합니다.
*   **돌연변이 (Mutation):** 가중치 수치 노이즈를 섞는 수치 돌연변이 외에도, 유전자 상태를 직접 변환시키는 상태 돌연변이(State Mutation; 예: I -> A, A -> D, D -> L 등)를 추가로 발생시켜 유전자의 재발현 및 감퇴를 조절합니다.
*   **자연선택 (Natural Selection):** 낮은 적합도(Fitness)를 보이는 실패 개체는 도태시켜 지우되, 그들이 보유했던 유전자 계보는 `DNA archive`에 영구 기록하여 동일한 유전자 설계 오류를 예방(퇴화 차단)합니다.
*   **세대상승 (Generation Promotion):** 단순히 세대 번호만 올리지 않고, 어떤 활성 유전자가 생존했는지(`which active genes survived`)와 어떤 잠재 유전자가 새로 재발현되었는지(`which latent genes reappeared`)를 계보에 동시 추적 기록합니다.

#### 4. 시장 4대 맥락 기반 조건부 유전자 제어 및 진화 (Contextual Evolution)
AI 모델이 단일한 가중치 뭉치로만 작동할 경우, 폭락장이나 급변하는 변동성 장세에 대처하지 못하고 몰살당하기 쉽습니다. 이를 극복하기 위해 **시장의 4대 맥락(계절)**을 실시간 감지하여 그에 알맞은 복제·파생 유전자가 동적으로 발현되는 시스템을 구현하였습니다.
*   **시장 계절 분류 기준**:
    *   **장기 추세 (240일 이동평균선)**: 가격이 SMA240 위에 있으면 상승세(BULL), 아래에 있으면 하락세(BEAR)로 판별.
    *   **단기 변동성 (ATR 대용 14일 고가-저가 평균)**: 최근 14일간의 고가-저가 밴드폭 평균을 기준으로 변동성 확장기(EXPANSION)와 수축기(SQUEEZE)를 판별.
    *   이를 조합하여 **BULL_EXPANSION, BULL_SQUEEZE, BEAR_EXPANSION, BEAR_SQUEEZE** 4대 기후(계절)를 실시간 감지합니다.
*   **맥락적 조건부 발현 (Contextual Expression)**:
    *   각 전략 유전자(Strategy Gene)는 동작이 허용되는 기후 리스트인 `context_mask`를 코딩하고 있습니다.
    *   추론 시점의 실시간 감지된 시장 기후에 해당하는 유전자들만 선택적으로 활성화(Active)되어 가중치(Centroids) 조립에 반영됩니다. 맞지 않는 유전자들은 비활성화(Inactive)되어 리스크 노출을 원천 차단합니다.
*   **맥락적 돌연변이 (Context Mutation)**:
    *   매 진화 주기마다 10%의 확률로 특정 유전자의 `context_mask`에 특정 시장 기후 태그를 임의로 추가하거나 빼는 돌연변이가 발생합니다.
    *   이를 통해 특정 유전자가 하락 횡보장이나 상승 폭등장 등 특정 환경에 극도로 전문화된 곁가지 유전자로 자연스럽게 분화합니다.
*   **합집합 유전 상속 (Crossover)**:
    *   교배 시 양 부모 유전자가 가졌던 작동 기후 정보(`context_mask`)를 합집합(Union)하여 자손에게 온전히 물려줍니다. 이를 통해 자손들은 조상 세대가 겪었던 다양한 생존 본능을 고스란히 상속받게 됩니다.
*   **자가 치유 마이그레이션 (Self-healing)**:
    *   기존 데이터베이스에 저장되어 있던 구세대 DNA(즉, `context_mask` 정보가 유실되어 에러를 유발할 수 있는 개체들)를 로딩할 때, 시스템이 자동으로 이를 감지하여 4대 계절 전체 태그를 기본 주입하는 자가 복구 마이그레이션을 런타임에 실행합니다.

*   **적합도 이력 영속성 가드 (Fitness History Persistence Guard)**:
    *   현재 선거 런타임은 `fitness_history`를 추가하기 전에 DNA 패키지를 명시적으로 깊은 복사하여, 계보 이력 기록 과정이 실운영 의회 선거 루프를 중단시키지 않도록 보호하며 이 경로에 대한 회귀 테스트도 함께 유지합니다.

#### 5. 과학 분야 생명공학 연구의 접목 및 영감 (AI-VEP & AISG)
본 AIDL DNA Evolution Engine은 설계 과정에서 구글 DeepMind의 AlphaGenome 연구, EMBL-EBI의 Ensembl VEP(Variant Effect Predictor) 등의 실제 생명과학/유전공학 알고리즘에서 다음과 같은 큰 설계적 영감을 받아 실질적인 진화 안전 로직으로 이식되었습니다.
*   **AI-VEP (AI Variant Effect Predictor: AI 변이 효과 예측기)**:
    *   생물학적 VEP가 유전자 염기 변이의 치명성(Lethality)을 사전에 시뮬레이션하듯, 돌연변이 연산 직후 해당 가중치 변이가 "하락 확장기(BEAR_EXPANSION)" 등의 위기 상황에서 파멸적인 오작동(예: 극단적 과적합 또는 성급한 추격 매수 가중치 쏠림)을 유발할 가능성이 있는지 선제적으로 예측 및 스크리닝합니다.
    *   VEP 스크리닝 결과 `LETHAL` 판정이 난 위험한 변이 모델은 가상 환경(Sandbox) 평가에 들어가기 전에 필터링되어 즉시 차단(Filtering out deleterious mutation)되고 안전한 부모 세대 가중치로 자동 회기 롤백됩니다.
*   **AISG Accession ID (유전자 서열 고유 식별 명세 체계)**:
    *   NCBI Entrez 및 Ensembl DB가 전 세계 수억 개의 유전자 및 단백질 서열에 표준화된 Accession ID(예: ENSG, XP_)를 발급하고 계보를 관리하는 것과 동일하게, AiS의 진화 풀에 소속된 모든 모델에 **`AISG-G{generation}-{unique_suffix}`** 형식의 영구 고유 식별 번호를 발급합니다.
    *   이를 통해 백테스팅 및 실거래 환경 전체에 걸쳐 어떤 세대(Gen)의 어떤 계보(lineage)의 유전자가 생존에 크게 기여했는지 데이터베이스 내에서 체계적으로 추적하고 마이그레이션할 수합니다.

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

---

## ⚖️ 라이선스 및 상업적 이용 문의

**AI-S (Safe Gated RSI)**는 오픈소스 라이선스 및 권리 보존을 준수하기 위해 **이중 라이선스 정책 (Dual License Policy)** 하에 제공됩니다.

### 1. AGPL-3.0 라이선스 기반의 오픈소스 이용
AGPL-3.0 라이선스는 상업적 사용 자체를 제한하지 않습니다. AGPL-3.0 조건(소스코드 수정 시 기여본 전체 공개 의무 등)을 충족하는 경우 누구나 상업적 목적으로도 자유롭게 사용할 수 있습니다.

### 2. 상업용 라이선스 및 통합 (Commercial Use)
AI-S 프로젝트는 저작권자가 별도의 상업용 라이선스를 제공하는 듀얼 라이선스 정책을 채택하고 있습니다. AGPL 의무를 이행하지 않고 폐쇄형 상용 서비스 또는 독점적 이용을 원하는 경우에는 반드시 원작자(Rejard)로부터 별도의 Commercial License를 취득해야 합니다.

AI-S 아키텍처를 상업용 독점 제품에 통합하거나 전담 기술 지원이 필요하신 경우, 아래 이메일로 연락해 주시기 바랍니다.

- 📬 **상업용 및 기술 문의:** lemaiii@alonics.com
- **저작권:** © 2026 Alonics Inc. All Rights Reserved.

---

## 📚 참고 문헌 및 연구 레퍼런스 (References)

본 프로젝트의 AIDL DNA Evolution Engine 및 격벽형 안전 진화 알고리즘의 유전학 모델 설계, 그리고 사용자 데이터 암호화 전송에는 아래와 같은 생명정보학(Bioinformatics) 및 암호학(Cryptography) 분야의 선행 연구 자료와 시스템 API 명세를 적극적으로 참조 및 인용(Citations)하였습니다.

1.  **Google DeepMind AlphaGenome (2026)**
    *   *Research Paper / Resource:* "Predicting genomic variant effects on gene expression and regulatory mechanisms using deep neural networks."
    *   *Application:* 변이의 조직 특이적 발현(Tissue-Specific Expression) 메커니즘을 4대 시장 맥락(BULL/BEAR × EXPANSION/SQUEEZE) 판별 및 조건부 유전자 활성/비활성 제어 스키마에 이식.
2.  **EMBL-EBI Ensembl Variant Effect Predictor (VEP) (2016)**
    *   *Reference publication:* McLaren, W., et al. "The Ensembl Variant Effect Predictor." *Bioinformatics*, 32(10), 1570–1575.
    *   *Application:* 돌연변이 가중치 변경 시 시장 붕괴 유발 및 과적합 리스크를 사전에 예측하고 필터링해내는 AI-VEP(Lethal/Deleterious variant filtering) 예방 엔진 설계의 근간으로 차용.
3.  **NCBI Entrez system & Sequence Databases (2018)**
    *   *Reference:* "Database resources of the National Center for Biotechnology Information." *Nucleic Acids Research*, 46(D1), D8–D13.
    *   *Application:* 고유의 서열 아카이브 구축 및 세대별 추적성을 유지하기 위한 `AISG` Accession ID 명세 체계 도입.
4.  **NIST SP 800-38D (Galois/Counter Mode - GCM) (2007)**
    *   *Specification:* Dworkin, M. "Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC." *NIST Special Publication*, 800-38D.
    *   *Application:* 대시보드 API 설정 및 인증 자격 증명 전송 시 정보 유출 방지를 위한 `AES-256-GCM` 대칭키 기밀성/무결성 군사급 암호화 처리.
5.  **NIST FIPS 180-4 (Secure Hash Standard - SHA-256) (2015)**
    *   *Standard:* "Secure Hash Standard (SHS)." *Federal Information Processing Standards Publication*, FIPS PUB 180-4.
    *   *Application:* 비밀 구절(Secret phrase) 입력을 통한 안전한 32바이트(256-bit) 암호화 키 유도(Key Derivation via SHA-256) 엔진 및 키 스트레칭 구현.

---

## AIDL 최신 운영 업데이트

아래 내용은 현재 서비스 코드와 관리자 운영 화면 기준으로 정리한 최신 AIDL 운영 구조입니다.

### 1. BLACK_SWAN은 4기후를 대체하지 않는 5번째 컨텍스트

이제 AIDL은 기존 4기후

- `BULL_EXPANSION`
- `BULL_SQUEEZE`
- `BEAR_EXPANSION`
- `BEAR_SQUEEZE`

위에 별도의 희귀 충격 컨텍스트인 `BLACK_SWAN`을 추가로 지원합니다.

핵심 원칙은 다음과 같습니다.

- 기본 부트스트랩과 self-healing 기준은 여전히 기존 4기후입니다
- `BLACK_SWAN`은 평상시 기본값이 아니라 충격 구간에서만 활성화됩니다
- 유전자는 mutation 또는 명시적 `context_mask` 포함을 통해서만 `BLACK_SWAN`에 참여합니다
- 즉, 4기후 체계를 깨지 않고 그 위에 희귀 충격 전용 분기만 얹는 구조입니다

### 2. BLACK_SWAN 판별 기준

현재 런타임은 아래 두 조건을 동시에 만족할 때만 해당 바를 `BLACK_SWAN`으로 분류합니다.

- 종가 기준 절대 변동률이 `6.0%` 이상
- 현재 고가-저가 range가 최근 14개 바 평균 range의 `2.5배` 이상

이 기준은 일반적인 고변동과 진짜 충격 구간을 섞지 않기 위한 운영 게이트입니다.

### 3. DNA 발현과 AI-VEP 확장 범위

최근 AIDL 작업으로 DNA 운영 범위가 다음처럼 넓어졌습니다.

- `context_mask` mutation이 `BLACK_SWAN` 추가/제거를 직접 다룹니다
- AI-VEP가 `BLACK_SWAN` 내부의 과도한 방향 추격 성향을 더 강하게 lethal screening 합니다
- 최근 holdout 붕괴 이력이 있으면 lethal 차단 강도가 더 올라갑니다
- context, override, lineage, repair 이력이 모두 관리자 audit 신호로 노출됩니다

### 4. 관리자 override와 telemetry의 결합

이제 관리자 수동 제어는 단순 강제 변경이 아니라, 변경 전후를 추적 가능한 telemetry와 함께 동작합니다.

- `A / I / D / L` 수동 변경은 `admin_state_override`로 기록됩니다
- `BLACK_SWAN` on/off 수동 변경은 `admin_context_override`로 기록됩니다
- override 시점에는 `pre_validation_score`, `pre_holdout_score`, `pre_run_key`가 함께 저장됩니다
- override outcome은 active/archive 평균 결과를 따로 보여줍니다
- override snapshot은 직전 평균과 현재 평균을 같이 보여줍니다
- override coverage는 snapshot 비교 가능 수와 post-only timeline 비교 가능 수를 같이 보여줍니다
- override timeline은 이제 override 이후 run만 집계합니다

### 5. 계보와 제어 surface의 마무리 상태

현재 관리자 AIDL surface는 아래 범위까지 연결되어 있습니다.

- active/archive genome의 accession 및 lineage 가시성
- accession, `context_mask`, `regulatory_profile` self-healing repair telemetry
- strategy gene 수동 override
- subgene state 수동 override
- 후보군/의회 DNA context visibility의 관리자 전용 유지

정리하면, 현재 AIDL은 단순한 4상태 유전자 실험이 아니라 5번째 충격 컨텍스트, 관리자 감사 telemetry, lineage 추적, 수동 제어까지 포함한 운영형 DNA 진화 엔진으로 확장된 상태입니다.

---

### 6. 76대 시스템 무결성 자가 진단 확장 및 9대 스케줄러 운영

최근 운영 안정성을 고도화하기 위해 시스템 무결성 검증 프로세스와 회귀 테스트 스위트를 대폭 확장하였습니다.

#### (1) 무결성 진단 노드 확장 (43개 Core + 33개 Extended = 76개)
기존 35개 진단 노드 체계에서 코어 진단 43개와 확장 진단 33개를 결합하여 총 76개 노드로 정교화했습니다.
- **Faction 미할당(NULL) 오염 검사** (`councilNullFactionCheck`): 데이터 이상 변이 또는 DB 오염으로 인해 의원의 Faction 값이 누락(NULL)된 경우가 있는지 전수 조사합니다.
- **DNA/Phenotype 누락 검사** (`councilDnaIntegrityCheck`): 의회 멤버의 `dna_json` 또는 `phenotype_json` 데이터가 공백이거나 유실되어 투표 및 교배 연산 불능 상태에 빠지는 것을 선제 차단합니다.
- **가중치 벡터 형태 검증** (`councilWeightsShapeCheck`): 의원의 의사결정 가중치(weights_json)가 canonical 5차원 숫자 배열 구조(BUY, SELL, HOLD 각각 5개 요소)를 올바르게 갖추고 있는지 검증합니다.
- **Gemini API Key 설정 상태** (`geminiApiKeyCheck`): 실거래 매매 분석 및 의사결정의 핵심인 Gemini API Key가 DB에 정상 등록되어 작동 가능한지 점검합니다.
- **엔진 ↔ 승격 정합성 검증** (`enginePromoConsistencyCheck`): AI 엔진이 `GEMINI` 모드인데 자동 승격(`automatic_promotion_enabled`)이 `ON`으로 잘못 켜져 있는 등의 논리적 모순 상태를 탐지합니다.
- **확장 진단 (Extended Diagnostics)**: 거래소 자격증명 복호화 건전성, GridBot 스케줄러 심장박동, Python 모듈 Import 체인, 서버 시계 드리프트 등 33개의 하위 시스템 무결성을 추가 검증합니다.

#### (2) 9대 핵심 운영 스케줄러 체계
AiS의 자율 운영을 담당하는 9개의 핵심 스케줄러가 독립적인 주기로 구동됩니다.
- **의회 총선 스케줄러**: 정기적인 세대 교체 및 도태/생성 사이클 관리.
- **GridBot 실행 스케줄러**: 실시간 매매 집행 및 주문 관리.
- **데이터 파이프라인 스케줄러**: 학습 데이터 유입 및 라벨링 관리.
- **시스템 무결성 스케줄러**: 76개 노드에 대한 주기적 자동 진단.
- (기타 의회 투표, 브리핑 생성, 세이프가드 감시 등 총 9개 엔진)

#### (3) 프론트엔드 UI 대시보드 시각화 연동
- PC 및 모바일 관리자 대시보드(`admin_pc_dashboard.jsx`, `admin_mobile_dashboard.jsx`) 상에서 진단 노드 개수(76개) 및 9대 운영 스케줄러 상태를 완전히 동기화했습니다.
- 카테고리별 상세 리스트 필터링 및 실시간 ERROR/WARN 배지 카운트 렌더링을 적용했습니다.

#### (4) 신규 단위 및 통합 테스트 스위트 4종 도입
프로덕션 배포 전 코드의 회귀(Regression)를 방지하기 위해 다음 4가지 핵심 검증 스크립트를 신규 구축했습니다.
1. **aiControlRoutes.test.js** ([aiControlRoutes.test.js](file:///c:/home/ai-s/backend/aiControlRoutes.test.js))
   - AI 설정(모델, API Key, Interval, Gemini Timeout, AIDL Policy 등)의 저장/조회 경로 및 비정상 입력(범위 외 타임아웃, 음수 정책 값 등) 클램핑 가드 동작을 테스트합니다.
2. **buildDeterministicDna.test.js** ([buildDeterministicDna.test.js](file:///c:/home/ai-s/backend/buildDeterministicDna.test.js))
   - 동일 가중치 입력 시 항상 결정론적(Deterministic)으로 동일한 DNA가 생성되는지 검증하고, 규격에 맞지 않는 불완전한 가중치(누락, 타입 에러 등) 유입 시 예외를 던지는 가드를 테스트합니다.
3. **repairAiCouncilState.test.js** ([repairAiCouncilState.test.js](file:///c:/home/ai-s/backend/repairAiCouncilState.test.js))
   - 후보군(CANDIDATE) 멤버 수가 부족할 때 500명까지 자동으로 안전하게 리필하는 복구 로직과, 투표 이력이 전혀 없는 미활동 의원(total_count = 0)을 후보군으로 자동 강등시키는 상태 복구 메커니즘을 검증합니다.
4. **systemDiagnostics.test.js** ([systemDiagnostics.test.js](file:///c:/home/ai-s/backend/systemDiagnostics.test.js))
   - 확장된 76개 진단 노드가 규격화된 스키마에 따라 정상 배치되어 동작하는지 종합 검증합니다.
