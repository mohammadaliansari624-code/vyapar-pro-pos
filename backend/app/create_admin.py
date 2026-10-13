"""Create or promote an administrator from an interactive terminal."""
import getpass
from sqlalchemy import func
from .database import Base, engine, SessionLocal
from .models import User, Shop
from .security import passwords
from .config import settings

def main():
    Base.metadata.create_all(bind=engine)
    email=input("Admin email: ").strip().lower()
    if email not in settings.admins:
        raise SystemExit("Email must be listed in ADMIN_EMAILS in your backend .env")
    name=input("Admin display name: ").strip() or "Administrator"
    password=getpass.getpass("Set password (minimum 10 characters): ")
    if len(password)<10: raise SystemExit("Password must contain at least 10 characters")
    db=SessionLocal()
    try:
        user=db.query(User).filter(func.lower(User.email)==email).first()
        if user:
            user.role="admin"; user.status="approved"; user.name=name; user.password_hash=passwords.hash(password)
        else:
            user=User(name=name,email=email,password_hash=passwords.hash(password),role="admin",status="approved")
            user.shop=Shop(name=f"{name}'s Shop"); db.add(user)
        db.commit(); print("Administrator account is ready.")
    finally: db.close()
if __name__ == "__main__": main()
