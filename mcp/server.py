"""LicenseOS MCP 서버.

기존 관리자 REST API를 AI 에이전트용 도구로 연결한다. DB에 직접 붙지 않고
/auth/login → /admin/* 를 그대로 호출하므로 인증·검증 규칙은 백엔드 한 곳에서 관리된다.

모델 컨텍스트에 넘기지 않는 값: 라이선스 키 원문, 이메일·전화번호.
연락처가 필요한 안내 작업은 export_expiring_contacts 로 로컬 CSV에만 저장한다.
"""

import csv
import logging
import os
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations

KST = ZoneInfo("Asia/Seoul")
logging.getLogger("httpx").setLevel(logging.WARNING)  # 요청 URL 로그가 stdio 클라이언트 로그를 덮지 않게

API_URL = os.environ.get("LICENSEOS_API_URL", "http://localhost:8001").rstrip("/")
EXPORT_DIR = Path(os.environ.get("LICENSEOS_EXPORT_DIR", Path(__file__).parent / "exports"))


class LicenseOSClient:
    """관리자 API 호출. Access Token(30분)이 만료되면 한 번 재로그인한다."""

    def __init__(self, base_url: str, username: str, password: str, transport: httpx.AsyncBaseTransport | None = None):
        self._http = httpx.AsyncClient(base_url=base_url, timeout=15, transport=transport)
        self._username = username
        self._password = password
        self._token: str | None = None

    async def _login(self) -> None:
        res = await self._http.post("/auth/login", json={"username": self._username, "password": self._password})
        res.raise_for_status()
        self._token = res.json()["access_token"]

    async def request(self, method: str, path: str, **kwargs) -> httpx.Response:
        if self._token is None:
            await self._login()
        for attempt in range(2):
            res = await self._http.request(method, path, headers={"Authorization": f"Bearer {self._token}"}, **kwargs)
            if res.status_code == 401 and attempt == 0:
                await self._login()
                continue
            res.raise_for_status()
            return res
        raise RuntimeError("unreachable")

    async def programs(self) -> list[dict]:
        return (await self.request("GET", "/admin/programs")).json()

    async def licenses(self, program_id: int) -> list[dict]:
        return (await self.request("GET", "/admin/licenses", params={"program_id": program_id})).json()

    async def license(self, license_id: int) -> dict:
        return (await self.request("GET", f"/admin/licenses/{license_id}")).json()

    async def update_license(self, license_id: int, body: dict) -> dict:
        return (await self.request("PATCH", f"/admin/licenses/{license_id}", json=body)).json()


# ── 날짜 규칙: 프론트엔드 lib/license-status.ts 와 동일 ─────────────
# 백엔드는 tz 없는 UTC를 내려주고, 남은 일수는 KST 달력 기준으로 센다.

def parse_backend_date(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def days_until(expires_at: datetime, now: datetime) -> int:
    return (expires_at.astimezone(KST).date() - now.astimezone(KST).date()).days


def expiring_within(licenses: list[dict], days: int, now: datetime) -> list[dict]:
    """활성 상태이고 아직 만료되지 않았으며 남은 일수가 0~days 인 라이선스 (남은 일수 오름차순)."""
    result = []
    for lic in licenses:
        if not lic.get("is_active") or not lic.get("expires_at"):
            continue
        expires_at = parse_backend_date(lic["expires_at"])
        if expires_at < now:
            continue
        left = days_until(expires_at, now)
        if 0 <= left <= days:
            result.append({**lic, "days_left": left})
    return sorted(result, key=lambda lic: lic["days_left"])


def public_view(lic: dict, program_name: str | None = None) -> dict:
    """모델에 넘겨도 되는 필드만 남긴다. 키는 끝 4자리, 연락처는 보유 여부만."""
    view = {
        "license_id": lic["id"],
        "program": program_name,
        "username": lic["username"],
        "user_id": lic.get("user_id"),
        "license_key_tail": lic["license_key"][-4:],
        "expires_at_kst": parse_backend_date(lic["expires_at"]).astimezone(KST).strftime("%Y-%m-%d") if lic.get("expires_at") else None,
        "is_active": lic["is_active"],
        "max_devices": lic["max_devices"],
        "active_devices": len(lic.get("devices") or []),
        "has_email": bool(lic.get("email")),
        "has_phone": bool(lic.get("phone")),
    }
    if "days_left" in lic:
        view["days_left"] = lic["days_left"]
    return view


# ── MCP 도구 ──────────────────────────────────────────────────

mcp = MCPServer(
    name="licenseos",
    instructions=(
        "LicenseOS 라이선스 운영 도구. 조회 결과에는 라이선스 키 원문과 연락처가 없다. "
        "고객 안내용 연락처가 필요하면 export_expiring_contacts 로 로컬 CSV를 만들고 경로만 사용자에게 알린다. "
        "extend_license 는 먼저 confirm=false 로 미리보기를 보여주고, 사용자가 승인한 경우에만 confirm=true 로 다시 호출한다."
    ),
)
_client: LicenseOSClient | None = None


def client() -> LicenseOSClient:
    global _client
    if _client is None:
        user, password = os.environ.get("LICENSEOS_ADMIN_USERNAME"), os.environ.get("LICENSEOS_ADMIN_PASSWORD")
        if not user or not password:
            raise RuntimeError("LICENSEOS_ADMIN_USERNAME / LICENSEOS_ADMIN_PASSWORD 환경변수가 필요합니다.")
        _client = LicenseOSClient(API_URL, user, password)
    return _client


async def _expiring(days: int, program_id: int | None) -> list[tuple[dict, str]]:
    programs = await client().programs()
    if program_id is not None:
        programs = [p for p in programs if p["id"] == program_id]
    now = datetime.now(timezone.utc)
    rows = []
    for program in programs:
        for lic in expiring_within(await client().licenses(program["id"]), days, now):
            rows.append((lic, program["name"]))
    return sorted(rows, key=lambda row: row[0]["days_left"])


READ_ONLY = ToolAnnotations(read_only_hint=True, open_world_hint=False)


@mcp.tool(annotations=READ_ONLY)
async def list_programs() -> list[dict]:
    """등록된 프로그램(제품) 목록과 프로그램별 라이선스 수를 반환한다."""
    programs = await client().programs()
    return [
        {"program_id": p["id"], "name": p["name"], "description": p.get("description"), "license_count": len(await client().licenses(p["id"]))}
        for p in programs
    ]


@mcp.tool(annotations=READ_ONLY)
async def list_expiring(days: int = 30, program_id: int | None = None) -> list[dict]:
    """활성 라이선스 중 오늘부터 days 일 안에 만료되는 것을 남은 일수 순으로 반환한다(KST 달력 기준).

    program_id 를 주면 해당 프로그램만 본다. 연락처 원문은 포함하지 않는다.
    """
    if not 0 <= days <= 365:
        raise ToolError("days 는 0~365 사이여야 합니다.")
    return [public_view(lic, name) for lic, name in await _expiring(days, program_id)]


@mcp.tool(annotations=READ_ONLY)
async def get_license(license_id: int) -> dict:
    """라이선스 한 건의 상태, 만료일, 등록 기기(이름·마지막 접속)를 반환한다."""
    lic = await client().license(license_id)
    view = public_view(lic)
    view["devices"] = [
        {"device_name": d.get("device_name"), "last_seen_at_kst": parse_backend_date(d["last_seen_at"]).astimezone(KST).strftime("%Y-%m-%d %H:%M")}
        for d in lic.get("devices") or []
    ]
    return view


@mcp.tool(annotations=ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=True, open_world_hint=False))
async def export_expiring_contacts(days: int = 30, program_id: int | None = None) -> dict:
    """만료 예정 고객 안내용 연락처를 로컬 CSV로 저장하고, 파일 경로와 건수만 반환한다.

    연락처는 모델에 전달되지 않는다. 저장 위치는 서버 설정(LICENSEOS_EXPORT_DIR)으로 고정된다.
    """
    rows = await _expiring(days, program_id)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / f"expiring-{days}d-{datetime.now(KST):%Y%m%d-%H%M%S}.csv"
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["프로그램", "사용자", "사용자 ID", "이메일", "전화번호", "만료일(KST)", "남은 일수", "license_id"])
        for lic, name in rows:
            view = public_view(lic, name)
            writer.writerow([name, lic["username"], lic.get("user_id") or "", lic.get("email") or "", lic.get("phone") or "", view["expires_at_kst"], lic["days_left"], lic["id"]])
    return {"path": str(path), "count": len(rows), "without_contact": sum(1 for lic, _ in rows if not lic.get("email") and not lic.get("phone"))}


@mcp.tool(annotations=ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=True, open_world_hint=False))
async def extend_license(license_id: int, new_expiry_date: str, confirm: bool = False) -> dict:
    """라이선스 만료일을 new_expiry_date(YYYY-MM-DD, KST)로 연장한다.

    confirm=false(기본)면 변경 전/후만 보여주고 저장하지 않는다. 사용자가 승인한 뒤에만 confirm=true 로 호출한다.
    기존 만료 시각(시:분)은 유지하며, 현재 만료일보다 늦은 날짜만 허용한다.
    """
    lic = await client().license(license_id)
    if not lic.get("expires_at"):
        raise ToolError("무기한 라이선스는 연장할 수 없습니다.")
    current = parse_backend_date(lic["expires_at"]).astimezone(KST)
    target_date = date.fromisoformat(new_expiry_date)
    new_kst = current.replace(year=target_date.year, month=target_date.month, day=target_date.day)
    if new_kst <= current:
        raise ToolError(f"새 만료일은 현재 만료일({current:%Y-%m-%d})보다 늦어야 합니다.")

    preview = {
        "license_id": license_id,
        "username": lic["username"],
        "current_expiry_kst": f"{current:%Y-%m-%d}",
        "new_expiry_kst": f"{new_kst:%Y-%m-%d}",
        "extended_days": (new_kst.date() - current.date()).days,
        "is_active": lic["is_active"],
    }
    if not confirm:
        return {**preview, "applied": False, "note": "미리보기입니다. 사용자 승인 후 confirm=true 로 다시 호출하세요."}

    updated = await client().update_license(license_id, {"expires_at": new_kst.astimezone(timezone.utc).isoformat()})
    return {**preview, "applied": True, "saved_expiry_kst": parse_backend_date(updated["expires_at"]).astimezone(KST).strftime("%Y-%m-%d")}


if __name__ == "__main__":
    mcp.run("stdio")
