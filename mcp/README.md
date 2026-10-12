# LicenseOS MCP 서버

기존 관리자 REST API를 AI 에이전트(Claude Code·Codex 등)가 쓸 수 있는 MCP 도구로 연결합니다.
운영자가 어드민 화면을 오가며 하던 **만료 예정 고객 확인 → 안내 → 연장** 작업을 대화로 처리하기 위한 것입니다.

## 설계 판단

- **DB에 직접 붙지 않는다.** `/auth/login`으로 받은 토큰으로 `/admin/*` API를 호출하므로, 인증·검증 규칙(예: 만료된 라이선스 활성화 제한)은 백엔드 한 곳에서만 관리됩니다. Access Token이 만료되면 한 번 재로그인합니다.
- **모델 컨텍스트에 넘기지 않는 값**: 라이선스 키 원문(끝 4자리만), 이메일·전화번호(보유 여부만).
  안내에 연락처가 필요하면 `export_expiring_contacts`가 로컬 CSV에만 쓰고 경로와 건수만 반환합니다. 저장 위치는 서버 설정으로 고정되어 모델이 경로를 정할 수 없습니다.
- **쓰기 작업은 미리보기 → 승인 → 반영.** `extend_license`는 기본이 미리보기이고 `confirm=true`일 때만 저장합니다. 현재보다 이른 날짜·무기한 라이선스는 거부합니다. 삭제·발급·기기 해제는 도구로 노출하지 않습니다.
- **남은 일수 규칙은 프론트엔드와 같다.** 백엔드의 tz 없는 UTC를 KST 달력 기준으로 셉니다(`frontend/lib/license-status.ts`).

## 도구

| 도구 | 성격 | 설명 |
|---|---|---|
| `list_programs` | 조회 | 프로그램 목록과 라이선스 수 |
| `list_expiring(days=30, program_id?)` | 조회 | 활성 라이선스 중 N일 안에 만료되는 것, 남은 일수 순 |
| `get_license(license_id)` | 조회 | 상태·만료일·등록 기기(이름, 마지막 접속) |
| `export_expiring_contacts(days=30, program_id?)` | 로컬 파일 쓰기 | 안내용 연락처 CSV 저장, 경로·건수만 반환 |
| `extend_license(license_id, new_expiry_date, confirm=false)` | 쓰기 | 만료일 연장(기존 시:분 유지) |

## 실행

```bash
cd mcp
python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q   # 관리자 API를 MockTransport로 흉내 낸 테스트
```

Claude Code에 등록(관리자 계정은 환경변수로만 전달):

```bash
claude mcp add licenseos \
  -e LICENSEOS_API_URL=https://<api-host> \
  -e LICENSEOS_ADMIN_USERNAME=<admin> \
  -e LICENSEOS_ADMIN_PASSWORD=<password> \
  -- /절대경로/license-system/mcp/.venv/bin/python /절대경로/license-system/mcp/server.py
```

예: "이번 달 안에 만료되는 라이선스 알려줘" → `list_expiring`, "안내용 연락처 뽑아줘" → `export_expiring_contacts`, "3번 고객 12월 말까지 연장해줘" → `extend_license` 미리보기 후 승인 시 반영.
