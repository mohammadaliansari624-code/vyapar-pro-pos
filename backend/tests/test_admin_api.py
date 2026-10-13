"""API tests for admin endpoints using an in-memory SQLite database.

Needs the packages in requirements.txt (fastapi, sqlalchemy, httpx, passlib...).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User, Shop, AuditLog
from app.security import passwords

PW = "correct-horse-battery"


@pytest.fixture()
def env():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override():
        db = Session()
        try: yield db
        finally: db.close()

    app.dependency_overrides[get_db] = override
    db = Session()
    for name, role, status in [("Admin", "admin", "approved"), ("Sam", "user", "approved"), ("Pat", "user", "pending")]:
        u = User(name=name, email=f"{name.lower()}@example.com", password_hash=passwords.hash(PW), role=role, status=status)
        u.shop = Shop(name=f"{name}'s Shop"); db.add(u)
    db.commit()
    yield db
    app.dependency_overrides.clear()


def client_for(email):
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    return c


def uid(db, name): return db.query(User).filter_by(name=name).one().id


def test_anonymous_and_regular_users_cannot_call_admin_apis(env):
    anon = TestClient(app)
    assert anon.get("/api/admin/users").status_code == 401
    sam = client_for("sam@example.com")
    assert sam.get("/api/admin/users").status_code == 403
    assert sam.patch(f"/api/admin/users/{uid(env,'Pat')}/role", json={"role": "admin"}).status_code == 403
    assert sam.patch(f"/api/admin/users/{uid(env,'Pat')}/status", params={"status": "approved"}).status_code == 403


def test_promote_then_demote_persists_and_is_audited(env):
    admin = client_for("admin@example.com")
    sam = uid(env, "Sam")
    r = admin.patch(f"/api/admin/users/{sam}/role", json={"role": "admin"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"
    assert client_for("sam@example.com").get("/api/admin/users").status_code == 200
    assert admin.patch(f"/api/admin/users/{sam}/role", json={"role": "user"}).status_code == 200
    assert env.query(AuditLog).filter_by(action="user.role_changed").count() == 2


def test_cannot_promote_pending_user_or_demote_self(env):
    admin = client_for("admin@example.com")
    assert admin.patch(f"/api/admin/users/{uid(env,'Pat')}/role", json={"role": "admin"}).status_code == 400
    assert admin.patch(f"/api/admin/users/{uid(env,'Admin')}/role", json={"role": "user"}).status_code == 400


def test_invalid_role_body_is_rejected(env):
    admin = client_for("admin@example.com")
    assert admin.patch(f"/api/admin/users/{uid(env,'Sam')}/role", json={"role": "root"}).status_code == 422


def test_blocked_user_loses_session_and_cannot_log_in(env):
    admin = client_for("admin@example.com"); sam = client_for("sam@example.com")
    assert admin.patch(f"/api/admin/users/{uid(env,'Sam')}/status", params={"status": "blocked"}).status_code == 200
    assert sam.get("/api/products").status_code in (401, 403)
    assert TestClient(app).post("/api/auth/login", json={"email": "sam@example.com", "password": PW}).status_code == 403
    assert admin.patch(f"/api/admin/users/{uid(env,'Sam')}/status", params={"status": "approved"}).status_code == 200
    assert client_for("sam@example.com").get("/api/products").status_code == 200
