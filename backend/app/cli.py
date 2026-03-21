"""
어드민 계정 관리 CLI

사용법:
    python -m app.cli create-admin <username> <password>
    python -m app.cli list-admins
    python -m app.cli deactivate-admin <username>
"""
import sys

from app.core.database import SessionLocal
from app.crud import admin as crud_admin


def create_admin(username: str, password: str) -> None:
    db = SessionLocal()
    try:
        existing = crud_admin.get_by_username(db, username)
        if existing:
            print(f"[ERROR] 이미 존재하는 계정: {username}")
            sys.exit(1)
        admin = crud_admin.create(db, username, password)
        print(f"[OK] 어드민 계정 생성 완료: {admin.username} (id={admin.id})")
    finally:
        db.close()


def list_admins() -> None:
    db = SessionLocal()
    try:
        admins = db.query(__import__("app.models.admin", fromlist=["Admin"]).Admin).all()
        if not admins:
            print("등록된 어드민 계정이 없습니다.")
            return
        for a in admins:
            status = "active" if a.is_active else "disabled"
            print(f"  id={a.id}  username={a.username}  status={status}  created={a.created_at}")
    finally:
        db.close()


def deactivate_admin(username: str) -> None:
    db = SessionLocal()
    try:
        admin = crud_admin.get_by_username(db, username)
        if not admin:
            print(f"[ERROR] 존재하지 않는 계정: {username}")
            sys.exit(1)
        admin.is_active = False
        db.commit()
        print(f"[OK] 비활성화 완료: {username}")
    finally:
        db.close()


COMMANDS = {
    "create-admin": (create_admin, ["username", "password"]),
    "list-admins": (list_admins, []),
    "deactivate-admin": (deactivate_admin, ["username"]),
}

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] not in COMMANDS:
        print(__doc__)
        sys.exit(1)

    cmd, (fn, params) = args[0], COMMANDS[args[0]]
    if len(args) - 1 != len(params):
        print(f"Usage: python -m app.cli {cmd} {' '.join(f'<{p}>' for p in params)}")
        sys.exit(1)

    fn(*args[1:])
