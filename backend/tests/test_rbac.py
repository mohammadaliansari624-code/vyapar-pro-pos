"""Unit tests for the role/status rules. They need no database or web server."""
from types import SimpleNamespace as U
import pytest
from app.rbac import RuleError, check_role_change, check_status_change


def user(id, role="user", status="approved"):
    return U(id=id, role=role, status=status)


def fails(fn, *args, code=None):
    with pytest.raises(RuleError) as info:
        fn(*args)
    if code: assert info.value.status_code == code
    return info.value.message


def test_admin_can_promote_approved_user():
    check_role_change(user(1, "admin"), user(2), "admin", active_admin_count=1)


def test_cannot_promote_pending_or_blocked_user():
    for st in ("pending", "blocked"):
        fails(check_role_change, user(1, "admin"), user(2, status=st), "admin", 1)


def test_non_admin_is_rejected_with_403():
    fails(check_role_change, user(1), user(2), "admin", 1, code=403)
    fails(check_role_change, user(1, "admin", "blocked"), user(2), "admin", 1, code=403)


def test_cannot_change_own_role():
    me = user(1, "admin")
    fails(check_role_change, me, me, "user", 2)


def test_cannot_demote_last_active_admin():
    fails(check_role_change, user(1, "admin"), user(2, "admin"), "user", 1)


def test_can_demote_when_another_admin_exists():
    check_role_change(user(1, "admin"), user(2, "admin"), "user", 2)


def test_invalid_role_and_no_op_rejected():
    fails(check_role_change, user(1, "admin"), user(2), "superuser", 1)
    fails(check_role_change, user(1, "admin"), user(2), "user", 1, code=409)


def test_status_rules():
    admin = user(1, "admin")
    check_status_change(admin, user(2, status="pending"), "approved")
    check_status_change(admin, user(2), "blocked")
    check_status_change(admin, user(2, status="blocked"), "approved")  # unblock
    fails(check_status_change, admin, user(2), "deleted")
    fails(check_status_change, admin, admin, "blocked")
    fails(check_status_change, admin, user(3, "admin"), "blocked")
    fails(check_status_change, user(5), user(2), "blocked", code=403)
    fails(check_status_change, admin, user(2), "approved", code=409)
