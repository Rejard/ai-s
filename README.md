# AI-S (Polygon-based Referral & Investment Platform)

Polygon 네트워크 기반의 레퍼럴(추천인) 및 투자 모의 플랫폼입니다.

## 🚀 프로젝트 스택

- **Frontend:** React, Vite
- **Backend:** Node.js, Express
- **Database:** SQLite
- **Smart Contracts:** Solidity (Polygon Network)

## 📁 프로젝트 구조

- `/frontend` : 사용자 인터페이스를 담당하는 React 기반 프론트엔드 코드
- `/backend` : 비즈니스 로직과 데이터베이스 연동을 담당하는 Express 백엔드 서버
- `/contracts` : 플랫폼 내에서 사용되는 스마트 컨트랙트 코드 (MockUSDT 등)
- `/cfg` : 설정 및 환경 변수 파일 (보안을 위해 `.gitignore`에 추가되어 저장소에 업로드되지 않음)

## 🛠️ 설치 및 실행 방법

1. **전체 패키지 설치**
   프로젝트 루트 디렉토리에서 다음 명령어를 실행하여 모든 의존성 패키지를 설치합니다.
   ```bash
   npm run install-all
   ```

2. **서버 및 클라이언트 실행**
   다음 명령어를 통해 백엔드 서버와 프론트엔드 개발 서버를 동시에 실행합니다.
   ```bash
   npm start
   ```
   - **Frontend:** 기본적으로 `http://localhost:5173` 에서 접근 가능합니다.
   - **Backend:** `package.json` 설정 및 환경 변수에 정의된 포트(예: 3000번 대)에서 API 서버가 구동됩니다.

## 🔐 보안 및 환경 변수

- 중요 키 파일(`cfg/ai-s_key.json`)이나 `.env` 파일은 깃허브에 공유되지 않도록 `.gitignore`에 등록되어 있습니다.
- 백엔드와 프론트엔드의 정상 작동을 위해서는 각 폴더 내에 적절한 `.env` 설정이 필요할 수 있습니다.
