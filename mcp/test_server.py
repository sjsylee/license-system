"""LicenseOS MCP 서버 테스트. 관리자 API는 httpx.MockTransport 로 흉내 낸다.

실행: .venv/bin/python -m pytest -q
"""

import asyncio
import csv
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest

import server

NOW = datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(tzinfo=None).isoformat()  # 백엔드처럼 tz 없는 UTC


def lic(id, days, active=True, email=None, phone=None, **kw):
    return {
        "id": id, "program_id": 1, "username": f"user{id}", "license_key": "AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDD1234",
        "expires_at": iso(NOW + timedelta(days=days)) if days is not None else None, "max_devices": 2,
        "is_active": active, "created_at": iso(NOW), "user_id": f"u{id}", "email": email, "phone": phone,
        "meta": [], "devices": [], **kw,
    }


class FakeAPI:
    def __init__(self, licenses):
        self.licenses = {l["id"]: l for l in licenses}
        self.logins = 0
        self.patches = []
        self.expire_next_token = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth/login":
            self.logins += 1
            return httpx.Response(200, json={"access_token": f"t{self.logins}"})
        if request.headers.get("Authorization") != f"Bearer t{self.logins}" or self.expire_next_token:
            self.expire_next_token = False
            return httpx.Response(401, json={"detail": "expired"})
        path = request.url.path
        if path == "/admin/programs":
            return httpx.Response(200, json=[{"id": 1, "name": "program-a", "description": None}])
        if path == "/admin/licenses":
            return httpx.Response(200, json=list(self.licenses.values()))
        license_id = int(path.rsplit("/", 1)[1])
        if request.method == "PATCH":
            body = json.loads(request.content)
            self.patches.append(body)
            self.licenses[license_id]["expires_at"] = body["expires_at"]
        return httpx.Response(200, json=self.licenses[license_id])


@pytest.fixture
def api(tmp_path, monkeypatch):
    fake = FakeAPI([lic(1, 2, email="a@x.com", phone="010-1111-2222", devices=[{"id": 1, "hwid": "HW", "device_name": "PC", "activated_at": iso(NOW), "last_seen_at": iso(NOW)}]), lic(2, 10), lic(3, 40), lic(4, 5, active=False), lic(5, -1), lic(6, None)])
    server._client = server.LicenseOSClient("http://test", "admin", "pw", transport=httpx.MockTransport(fake.handler))
    monkeypatch.setattr(server, "EXPORT_DIR", tmp_path)
    yield fake
    server._client = None


def run(coro):
    return asyncio.run(coro)


def test_list_expiring_filters_and_hides_secrets(api):
    rows = run(server.list_expiring(days=30))
    assert [r["license_id"] for r in rows] == [1, 2]  # 비활성·만료·무기한·30일 초과 제외, 남은 일수 순
    assert rows[0]["license_key_tail"] == "1234" and rows[0]["has_email"] is True


def test_no_tool_output_leaks_key_or_contact(api):
    """모델로 나가는 모든 도구 응답에 키 원문·연락처가 없어야 한다 (export 는 경로만)."""
    target = (NOW + timedelta(days=40)).astimezone(server.KST).strftime("%Y-%m-%d")
    outputs = [
        run(server.list_programs()),
        run(server.list_expiring(days=365)),
        run(server.get_license(1)),
        run(server.export_expiring_contacts(days=365)),
        run(server.extend_license(1, target)),
        run(server.extend_license(1, target, confirm=True)),
    ]
    flat = json.dumps(outputs, ensure_ascii=False)
    assert "a@x.com" not in flat and "AAAAAAAA" not in flat and "010-" not in flat


def test_relogin_once_on_401(api):
    run(server.list_programs())
    api.expire_next_token = True
    run(server.list_programs())
    assert api.logins == 2


def test_export_writes_contacts_only_to_file(api):
    result = run(server.export_expiring_contacts(days=30))
    assert result["count"] == 2 and result["without_contact"] == 1
    rows = list(csv.reader(open(result["path"], encoding="utf-8-sig")))
    assert rows[1][3] == "a@x.com"
    assert "a@x.com" not in json.dumps(result)


def test_extend_preview_does_not_write(api):
    target = (NOW + timedelta(days=40)).astimezone(server.KST).strftime("%Y-%m-%d")
    result = run(server.extend_license(1, target))
    assert result["applied"] is False and api.patches == []


def test_extend_confirm_writes_and_keeps_time(api):
    before = server.parse_backend_date(api.licenses[1]["expires_at"])
    target = (NOW + timedelta(days=40)).astimezone(server.KST).strftime("%Y-%m-%d")
    result = run(server.extend_license(1, target, confirm=True))
    assert result["applied"] is True and result["expires_at_kst"] == target
    after = server.parse_backend_date(api.licenses[1]["expires_at"])
    assert (after.hour, after.minute) == (before.hour, before.minute)


def test_extend_rejects_earlier_date_and_permanent(api):
    with pytest.raises(server.ToolError):
        run(server.extend_license(1, "2000-01-01", confirm=True))
    with pytest.raises(server.ToolError):
        run(server.extend_license(6, "2099-01-01"))
    assert api.patches == []


def test_expiry_days_left_uses_kst_calendar():
    now = datetime(2026, 10, 12, 14, 0, tzinfo=timezone.utc)  # KST 10/12 23:00
    assert server.Expiry(datetime(2026, 10, 12, 16, 0, tzinfo=timezone.utc)).days_left(now) == 1  # KST 10/13 01:00


def test_expiry_extended_to_rules():
    expiry = server.Expiry.of({"expires_at": "2026-10-20T05:30:00"})  # KST 10/20 14:30
    assert expiry.extended_to("2026-12-31").astimezone(server.KST).strftime("%Y-%m-%d %H:%M") == "2026-12-31 14:30"
    for bad in ("2026-10-20", "2026-10-01", "12/31"):
        with pytest.raises(server.ToolError):
            expiry.extended_to(bad)
    assert server.Expiry.of({"expires_at": None}) is None
