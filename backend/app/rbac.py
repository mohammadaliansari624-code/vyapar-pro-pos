"""Rules for changing user roles and statuses.

This file has no web or database imports on purpose, so the rules are easy to
read and to unit-test. main.py loads the data and calls these functions.
"""

ROLES = {"user", "admin"}
STATUSES = {"pending", "approved", "blocked"}


class RuleError(Exception):
    """Raised when a requested change breaks a rule. `status_code` maps to HTTP."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def is_active_admin(user) -> bool:
    return user.role == "admin" and user.status == "approved"


def check_role_change(actor, target, new_role: str, active_admin_count: int) -> None:
    """Raise RuleError if `actor` may not set `target.role` to `new_role`.

    `active_admin_count` is the number of approved admins in the database right now.
    """
    if new_role not in ROLES:
        raise RuleError("Invalid role")
    if not is_active_admin(actor):
        raise RuleError("Administrator access required", 403)
    if target.id == actor.id:
        raise RuleError("You cannot change your own role. Ask another administrator.", 400)
    if target.role == new_role:
        raise RuleError(f"This user is already {'an administrator' if new_role == 'admin' else 'a regular user'}", 409)
    if new_role == "admin" and target.status != "approved":
        raise RuleError("Only approved users can be promoted to administrator", 400)
    if new_role == "user" and is_active_admin(target) and active_admin_count <= 1:
        raise RuleError("At least one active administrator must remain", 400)


def check_status_change(actor, target, new_status: str) -> None:
    """Raise RuleError if `actor` may not set `target.status` to `new_status`."""
    if new_status not in STATUSES:
        raise RuleError("Invalid account status")
    if not is_active_admin(actor):
        raise RuleError("Administrator access required", 403)
    if target.id == actor.id:
        raise RuleError("You cannot change your own account status", 400)
    if target.role == "admin" and new_status != "approved":
        raise RuleError("Remove administrator access first, then change this account's status", 400)
    if target.status == new_status:
        raise RuleError(f"This account is already {new_status}", 409)
