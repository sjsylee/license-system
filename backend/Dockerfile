# ── 1단계: 의존성 빌드 ──────────────────────────────────────────
FROM python:3.13-slim AS builder

WORKDIR /app

# 시스템 패키지 (PyMySQL은 순수 Python이라 빌드툴 불필요)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 의존성만 먼저 복사 → 레이어 캐시 최대 활용
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── 2단계: 실행 이미지 ──────────────────────────────────────────
FROM python:3.13-slim AS runtime

WORKDIR /app

# 빌드 단계에서 설치된 패키지만 복사 (이미지 사이즈 최소화)
COPY --from=builder /install /usr/local

# 소스 복사
COPY app/ ./app/

# 업로드 디렉터리 생성 (볼륨 마운트 전 존재해야 함)
RUN mkdir -p /app/uploads

# 비루트 유저로 실행 (보안)
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# 프로덕션: uvicorn 2 workers (1GB RAM 환경 최적화)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
