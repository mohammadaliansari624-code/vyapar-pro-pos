import hashlib, secrets
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import LoginSession, User

passwords = CryptContext(schemes=["argon2"], deprecated="auto")
COOKIE_NAME = "vyapar_session"

def hash_token(token: str) -> str: return hashlib.sha256(token.encode()).hexdigest()
def new_token() -> str: return secrets.token_urlsafe(48)
def issue_session(db: Session, user: User, remember: bool):
    token = new_token()
    days = settings.remember_session_days if remember else settings.session_days
    row = LoginSession(token_hash=hash_token(token), user_id=user.id, expires_at=datetime.now(timezone.utc) + timedelta(days=days))
    db.add(row)
    return token, row.expires_at

def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token: raise HTTPException(401, "Please sign in")
    row = db.query(LoginSession).filter_by(token_hash=hash_token(token)).first()
    if not row: raise HTTPException(401, "Session expired")
    expiry = row.expires_at
    if expiry.tzinfo is None: expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry <= datetime.now(timezone.utc):
        db.delete(row); db.commit(); raise HTTPException(401, "Session expired")
    user = db.get(User, row.user_id)
    if not user: raise HTTPException(401, "Session expired")
    if user.status == "blocked": raise HTTPException(403, "This account is blocked")
    return user

def approved_user(user: User = Depends(current_user)) -> User:
    if user.status != "approved": raise HTTPException(403, "Your account is awaiting administrator approval")
    return user

def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin" or user.status != "approved": raise HTTPException(403, "Administrator access required")
    return user
