# 개발 환경 가이드

로컬에서 기능을 추가하고 프로덕션에 배포하는 전체 프로세스를 정리합니다.

---

## 아키텍처 한눈에 보기

```
로컬 개발                          프로덕션 (Hetzner VPS)
─────────────────────────          ──────────────────────────────────
Next.js   localhost:3000           Cloudflare Pages  ← push to main
FastAPI   localhost:8001      →    Cloudflare Tunnel
MariaDB   localhost:3307 (Docker)      → Nginx → FastAPI (Docker)
                                           → MariaDB (Docker)
```

---

## 최초 세팅 (클론 직후 1회)

### 1. DB 실행

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2. 백엔드 세팅

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # 값 수정 불필요 (dev 기본값 사용)
```

`backend/.env` 내용:
```
DATABASE_URL=mysql+pymysql://license:license@localhost:3307/license_db
SECRET_KEY=dev-secret-key-change-in-production-32chars
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### 3. 프론트엔드 세팅

```bash
cd frontend
npm install
cp .env.local.example .env.local  # 없으면 직접 생성
```

`frontend/.env.local` 내용:
```
NEXT_PUBLIC_API_URL=http://localhost:8001
```

---

## 일상적인 개발 워크플로우

터미널 3개 사용:

```bash
# 터미널 1 — DB
docker compose -f docker-compose.dev.yml up -d

# 터미널 2 — 백엔드
cd backend && source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 터미널 3 — 프론트엔드
cd frontend
npm run dev
```

| 서비스 | 주소 |
|--------|------|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8001 |
| API 문서 (Swagger) | http://localhost:8001/docs |

---

## 새 기능 개발 표준 흐름

기능 하나를 처음부터 끝까지 개발하고 배포하는 기본 순서입니다.

```bash
# 1. 항상 최신 main에서 시작
git pull origin main

# 2. 기능 브랜치 생성 (feature/기능명 형식 권장)
git checkout -b feature/works-page

# 3. 로컬 개발 환경 실행 (터미널 3개)
docker compose -f docker-compose.dev.yml up -d   # DB
cd backend && source venv/bin/activate && uvicorn app.main:app --port 8001 --reload
cd frontend && npm run dev

# 4. 코드 수정 후 커밋 & 푸시
git add .
git commit -m "feat: works 페이지 추가"
git push origin feature/works-page
# → GitHub Actions CI 자동 실행
#   frontend/** 변경 시 → Next.js 빌드 검증
#   backend/**  변경 시 → Docker 빌드 검증

# 5. GitHub에서 PR 오픈
# → PR 페이지에 CI 결과 체크 표시 ✅ or ❌
# → CI 실패 시: 로컬에서 수정 → git push → CI 재실행

# 6. CI 통과 확인 후 main으로 머지
# → frontend/** 포함: Cloudflare Pages 자동 빌드/배포
# → backend/**  포함: ghcr.io push → Hetzner 자동 배포
```

> ⚠️ **DB 스키마 변경이 포함된 경우** 머지 전에 프로덕션 DB에 ALTER TABLE 먼저 실행
> → [DB 스키마 변경이 포함된 경우](#db-스키마-변경이-포함된-경우-수동) 참고

---

## 기능 추가 시나리오별 프로세스

### A. 프론트엔드만 변경할 때

```
코드 수정 → 브라우저 자동 반영 (HMR) → 확인 → git push
```

추가 작업 없음. Next.js가 자동으로 반영합니다.

---

### B. 백엔드 API만 변경할 때 (DB 스키마 변경 없음)

```
코드 수정 → uvicorn --reload 자동 반영 → 확인 → git push
```

라우터, CRUD 로직, 스키마(Pydantic) 변경은 자동 반영됩니다.

---

### C. DB 스키마 변경할 때 ⚠️ 중요

이 프로젝트는 **Alembic 없이 `create_all` 방식**을 사용합니다.
→ **새 테이블**은 자동 생성되지만, **기존 테이블에 컬럼 추가/삭제는 수동 SQL 필요**합니다.

#### 새 컬럼 추가 순서

**1. 모델 먼저 수정**
```python
# backend/app/models/xxx.py
class SomeModel(Base):
    new_field: Mapped[str | None] = mapped_column(String(100), nullable=True)
```

**2. Pydantic 스키마도 수정**
```python
# backend/app/schemas/xxx.py
class SomeResponse(BaseModel):
    new_field: str | None = None
```

**3. 로컬 DB에 직접 ALTER TABLE 실행**
```bash
docker exec license-db mariadb -ulicense -plicense license_db \
  -e "ALTER TABLE table_name ADD COLUMN new_field VARCHAR(100) NULL;"
```

**4. 백엔드 재시작 후 확인**
```bash
# uvicorn은 --reload 중이면 자동 재시작됨
# 확인
curl http://localhost:8001/docs
```

**5. 프로덕션 배포 시 별도 마이그레이션 필요**
→ [프로덕션 배포 섹션](#프로덕션-배포) 참고

#### 새 테이블 추가 순서

모델만 추가하면 `create_all`이 자동으로 테이블을 생성합니다.
백엔드를 재시작하면 즉시 적용됩니다.

---

### D. 새 패키지 추가할 때

**백엔드:**
```bash
cd backend
source venv/bin/activate
pip install 패키지명
pip freeze > requirements.txt    # 반드시 업데이트
```

**프론트엔드:**
```bash
cd frontend
npm install 패키지명
# package.json, package-lock.json 자동 업데이트
```

---

## CI/CD 흐름

이 프로젝트는 프론트/백엔드 코드가 한 레포에 함께 있는 **모노레포** 구조입니다.
GitHub Actions 워크플로우는 **변경된 파일 경로**를 감지해 필요한 것만 실행합니다.

### 워크플로우 파일 3개

| 파일 | 언제 실행 | 하는 일 |
|------|-----------|---------|
| `frontend-ci.yml` | `frontend/**` 변경 시 모든 브랜치/PR | `npm run build` — 빌드 오류 조기 발견 |
| `backend-ci.yml` | `backend/**` 변경 시 모든 브랜치/PR | Docker 빌드 검증 — 의존성/문법 오류 발견 |
| `backend-deploy.yml` | `backend/**` 변경이 **main**에 push될 때만 | ghcr.io push → Hetzner SSH 배포 |

### 브랜치 전략 및 단계별 흐름

```
① feature 브랜치에서 작업
   └─ git push origin feature/xxx
         ↓
      변경 파일에 따라 CI 자동 실행
      frontend/** 변경 → frontend-ci.yml (Next.js 빌드 검증)
      backend/**  변경 → backend-ci.yml  (Docker 빌드 검증)
      둘 다 변경  → 둘 다 실행

② GitHub에서 PR 오픈
   └─ PR에 CI 결과가 체크로 표시됨 ✅ or ❌
      CI 실패 시 코드 수정 후 다시 push → CI 재실행

③ CI 통과 후 main으로 머지
   └─ frontend/** 포함 → Cloudflare Pages 자동 빌드/배포
      backend/**  포함 → backend-deploy.yml 실행
                           → ghcr.io에 Docker 이미지 push
                           → Hetzner VPS SSH 접속 → 무중단 재배포
```

### PR에서 CI 필수 통과 설정 (권장)

GitHub repo → Settings → Branches → Branch protection rules → main:
- **Require status checks to pass before merging** 체크
- `Next.js Build Check`, `Docker Build Check` 추가

→ CI가 실패한 PR은 머지 버튼이 잠깁니다.

### 무엇이 변경됐을 때 어떤 CI/CD가 도나요?

| 변경 내용 | frontend-ci | backend-ci | 프론트 배포 | 백엔드 배포 |
|-----------|:-----------:|:----------:|:-----------:|:-----------:|
| 프론트만 수정 | ✅ | ❌ | ✅ (머지 후) | ❌ |
| 백엔드만 수정 | ❌ | ✅ | ❌ | ✅ (머지 후) |
| 둘 다 수정 | ✅ | ✅ | ✅ (머지 후) | ✅ (머지 후) |

> **핵심:** CI는 "이 코드가 빌드되는가"를 검증하고, CD는 "검증된 코드를 서버에 올린다".
> 프론트 CI가 실패하면 Cloudflare Pages에 망가진 코드가 올라가는 걸 PR 단계에서 막을 수 있습니다.

---

## 환경변수 (.env) 설명

환경변수는 **로컬 개발용**과 **프로덕션용** 두 곳에서 관리됩니다.
절대 git에 커밋하면 안 됩니다 (`.gitignore`에 등록되어 있음).

### 로컬 개발 — `backend/.env`

```
DATABASE_URL=mysql+pymysql://license:license@localhost:3307/license_db
SECRET_KEY=dev-secret-key-change-in-production-32chars
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

| 변수 | 역할 | 로컬 값 |
|------|------|---------|
| `DATABASE_URL` | FastAPI → MariaDB 연결 주소. `localhost:3307`은 docker-compose.dev.yml이 열어준 포트 | 그대로 사용 |
| `SECRET_KEY` | JWT 토큰 서명에 사용. 이 값이 바뀌면 모든 로그인 토큰이 무효화됨 | 개발용이므로 아무 값이나 OK |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 로그인 후 발급되는 Access Token 유효 시간 (분) | 30분 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh Token 유효 기간 (일). 이 기간이 지나면 재로그인 필요 | 7일 |

### 로컬 개발 — `frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:8001
```

| 변수 | 역할 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 프론트가 API를 호출할 백엔드 주소. `NEXT_PUBLIC_` 접두사가 붙어야 브라우저에서도 접근 가능 |

### 프로덕션 — Hetzner VPS의 `/opt/license-system/.env`

```
MYSQL_ROOT_PASSWORD=...
MYSQL_PASSWORD=...
SECRET_KEY=...
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CLOUDFLARE_TUNNEL_TOKEN=...
GITHUB_REPOSITORY=username/license-system
```

| 변수 | 역할 | 주의사항 |
|------|------|---------|
| `MYSQL_ROOT_PASSWORD` | MariaDB root 계정 비밀번호. docker-compose.yml에서 DB 컨테이너 초기화에 사용 | 강력한 값으로 설정 |
| `MYSQL_PASSWORD` | FastAPI가 DB에 접속할 때 쓰는 비밀번호. `DATABASE_URL`에 자동으로 조합됨 | 강력한 값으로 설정 |
| `SECRET_KEY` | **가장 중요.** JWT 서명 키. 외부에 절대 노출 금지. 유출 시 어드민 토큰 위조 가능 | `openssl rand -hex 32`로 생성 |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel 데몬(cloudflared)이 CF 서버에 인증할 때 사용. Cloudflare Dashboard에서 발급 | Tunnel 생성 후 복사 |
| `GITHUB_REPOSITORY` | docker-compose.yml에서 ghcr.io 이미지 경로 조합에 사용 (`ghcr.io/$GITHUB_REPOSITORY:latest`) | `username/license-system` 형식 |

### 프로덕션 — GitHub Actions Secrets

GitHub Actions가 배포 시 사용하는 값들. repo → Settings → Secrets에 등록.

| Secret | 역할 |
|--------|------|
| `HETZNER_HOST` | Hetzner VPS IP 주소. SSH 접속 대상 |
| `HETZNER_USER` | SSH 접속 유저명 (보통 `ubuntu` 또는 `root`) |
| `HETZNER_SSH_KEY` | SSH 개인키 전체 (`-----BEGIN...` 포함). VPS에 비밀번호 없이 접속하기 위해 사용 |
| `GHCR_PAT` | GitHub Personal Access Token (`read:packages` 권한). VPS에서 ghcr.io 이미지를 pull할 때 사용 |

> **SECRET_KEY 생성 방법:**
> ```bash
> openssl rand -hex 32
> ```
> 터미널에서 실행 후 출력값을 그대로 사용.

---

## 프로덕션 배포

### 백엔드 (자동)

`main` 브랜치에 `backend/` 하위 파일이 변경된 상태로 push하면
GitHub Actions가 자동으로:
1. Docker 이미지 빌드 → ghcr.io push
2. Hetzner VPS SSH 접속 → `docker compose pull & up`

```bash
git add .
git commit -m "feat: 새 기능 설명"
git push origin main
# → GitHub Actions 자동 실행 (Actions 탭에서 확인 가능)
```

### 프론트엔드 (자동)

push하면 Cloudflare Pages가 자동 빌드/배포합니다.
별도 작업 없음.

### DB 스키마 변경이 포함된 경우 (수동)

배포 전에 **프로덕션 DB에 ALTER TABLE을 먼저 실행**해야 합니다:

```bash
# Hetzner VPS SSH 접속 후
docker exec license-db mariadb -ulicense -p${MYSQL_PASSWORD} license_db \
  -e "ALTER TABLE table_name ADD COLUMN new_field VARCHAR(100) NULL;"

# 그 다음 배포 push
git push origin main
```

> ⚠️ 순서 중요: **DB 변경 먼저 → 코드 배포**
> 반대로 하면 새 코드가 없는 컬럼을 참조해 오류 발생

---

## 자주 쓰는 명령어 모음

```bash
# DB 컨테이너 상태 확인
docker compose -f docker-compose.dev.yml ps

# DB 컨테이너 재시작
docker compose -f docker-compose.dev.yml restart

# DB 직접 접속
docker exec -it license-db mariadb -ulicense -plicense license_db

# 테이블 구조 확인
docker exec license-db mariadb -ulicense -plicense license_db -e "DESCRIBE licenses;"

# 백엔드 로그 실시간 확인 (프로덕션)
ssh user@hetzner-ip "docker logs -f license-backend"

# 프로덕션 전체 재시작
ssh user@hetzner-ip "cd /opt/license-system && docker compose restart"
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `Unknown column` 오류 | DB에 컬럼 미추가 | ALTER TABLE 실행 |
| `Connection refused` (DB) | 컨테이너 미실행 | `docker compose -f docker-compose.dev.yml up -d` |
| CORS 오류 | 백엔드 origin 설정 | `main.py` allow_origins 확인 |
| 프론트 API 요청 실패 | `.env.local` 누락 | `NEXT_PUBLIC_API_URL` 설정 확인 |
| 이미지 안 보임 | API_BASE 불일치 | `.env.local` URL 확인 |
