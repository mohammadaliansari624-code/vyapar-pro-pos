from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from decimal import Decimal, ROUND_HALF_UP
import csv, io, secrets
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload
from .config import settings
from .database import Base, engine, get_db
from .models import User, Shop, LoginSession, Product, Invoice, InvoiceItem, IdempotencyRecord, AuditLog
from .schemas import RegisterIn, LoginIn, UserOut, ProductIn, ProductOut, ShopSettingsIn, CheckoutIn, RoleChangeIn
from .security import passwords, COOKIE_NAME, current_user, approved_user, admin_user, issue_session, hash_token
from .rbac import RuleError, check_role_change, check_status_change, is_active_admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Vyapar Pro POS API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True, allow_methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"], allow_headers=["Content-Type","X-CSRF-Token","Idempotency-Key"])

@app.get("/api/health")
def health(): return {"status":"ok"}

@app.post("/api/auth/register", response_model=UserOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    if db.query(User).filter(func.lower(User.email)==email).first(): raise HTTPException(409, "An account with this email already exists")
    # Registration never grants administrator privileges from an email address alone.
    user = User(name=data.name.strip(), email=email, password_hash=passwords.hash(data.password), role="user", status="pending")
    user.shop = Shop(name=f"{data.name.strip()}'s Shop")
    db.add(user); db.commit(); db.refresh(user)
    db.add(AuditLog(actor_user_id=user.id, action="account.registered", detail=f"status={user.status}")); db.commit()
    return user

@app.post("/api/auth/login", response_model=UserOut)
def login(data: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email)==str(data.email).lower()).first()
    if not user or not passwords.verify(data.password, user.password_hash): raise HTTPException(401, "Email or password is incorrect")
    if user.status == "blocked": raise HTTPException(403, "This account is blocked")
    token, expiry = issue_session(db, user, data.remember_me); db.commit()
    response.set_cookie(
    key=COOKIE_NAME,
    value=token,
    httponly=True,
    secure=True,
    samesite="none",
    expires=expiry,
    path="/",
)
    return user

@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        row = db.query(LoginSession).filter_by(token_hash=hash_token(token)).first()
        if row: db.delete(row); db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"message":"Signed out"}

@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)): return user

@app.post("/api/auth/forgot-password")
def forgot_password():
    # Safe response until an email provider and reset-token delivery are configured.
    return {"message":"If this account exists, password reset instructions will be sent when email delivery is configured."}

@app.delete("/api/auth/account")
def delete_account(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(user); db.commit(); response.delete_cookie(COOKIE_NAME, path="/")
    return {"message":"Account deleted"}

def get_shop_id(db: Session, user: User) -> int:
    shop = db.query(Shop).filter_by(owner_id=user.id).first()
    if not shop: raise HTTPException(404, "Shop settings not found")
    return shop.id

@app.get("/api/products", response_model=list[ProductOut])
def products(q: str = "", user: User = Depends(approved_user), db: Session = Depends(get_db)):
    sid = get_shop_id(db,user)
    query = db.query(Product).filter(Product.shop_id==sid)
    if q.strip(): query = query.filter((Product.name.ilike(f"%{q.strip()}%")) | (Product.code.ilike(f"%{q.strip()}%")))
    return query.order_by(Product.name).limit(500).all()

@app.post("/api/products", response_model=ProductOut, status_code=201)
def create_product(data: ProductIn, user: User = Depends(approved_user), db: Session = Depends(get_db)):
    sid = get_shop_id(db,user)
    p = Product(shop_id=sid, code=data.code.strip(), name=data.name.strip(), price=data.price, stock=data.stock, unit=data.unit)
    db.add(p)
    try: db.commit(); db.refresh(p)
    except Exception:
        db.rollback(); raise HTTPException(409, "Could not save product. Check that the product code is unique.")
    return p

@app.put("/api/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductIn, user: User = Depends(approved_user), db: Session = Depends(get_db)):
    p = db.query(Product).filter_by(id=product_id, shop_id=get_shop_id(db,user)).first()
    if not p: raise HTTPException(404, "Product not found")
    for key,value in data.model_dump().items(): setattr(p,key,value)
    try: db.commit(); db.refresh(p)
    except Exception: db.rollback(); raise HTTPException(409,"Could not update product; check product code uniqueness")
    return p

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, user: User = Depends(approved_user), db: Session = Depends(get_db)):
    p = db.query(Product).filter_by(id=product_id, shop_id=get_shop_id(db,user)).first()
    if not p: raise HTTPException(404,"Product not found")
    if db.query(InvoiceItem).filter_by(product_id=p.id).first(): raise HTTPException(409,"This product has invoice history and cannot be deleted")
    db.delete(p); db.commit(); return {"message":"Product deleted"}

@app.get("/api/settings")
def get_settings(user: User = Depends(approved_user), db: Session = Depends(get_db)):
    s = db.query(Shop).filter_by(owner_id=user.id).first()
    return {"name":s.name,"address":s.address,"phone":s.phone,"receipt_width":s.receipt_width,"receipt_font_size":s.receipt_font_size}

@app.put("/api/settings")
def save_settings(data: ShopSettingsIn, user: User = Depends(approved_user), db: Session = Depends(get_db)):
    s = db.query(Shop).filter_by(owner_id=user.id).first()
    for k,v in data.model_dump().items(): setattr(s,k,v.strip() if isinstance(v,str) else v)
    db.commit(); return {"message":"Settings saved","settings":data.model_dump()}

def invoice_json(inv: Invoice):
    return {"id":inv.id,"invoice_number":inv.invoice_number,"customer_name":inv.customer_name,"customer_phone":inv.customer_phone,"subtotal":str(inv.subtotal),"discount":str(inv.discount),"total":str(inv.total),"payment_method":inv.payment_method,"created_at":inv.created_at.isoformat(),"items":[{"product_id":i.product_id,"product_name":i.product_name,"unit":i.unit,"quantity":str(i.quantity),"unit_price":str(i.unit_price),"line_total":str(i.line_total)} for i in inv.items]}

@app.post("/api/checkout", status_code=201)
def checkout(data: CheckoutIn, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"), user: User = Depends(approved_user), db: Session = Depends(get_db)):
    sid=get_shop_id(db,user)
    if idempotency_key:
        old=db.query(IdempotencyRecord).filter_by(shop_id=sid,key=idempotency_key).first()
        if old:
            inv=db.query(Invoice).options(joinedload(Invoice.items)).filter_by(id=old.invoice_id,shop_id=sid).first()
            if inv: return invoice_json(inv)
    quantities={}
    for item in data.items: quantities[item.product_id]=quantities.get(item.product_id,Decimal("0"))+item.quantity
    try:
        product_rows=db.execute(select(Product).where(Product.shop_id==sid, Product.id.in_(quantities.keys())).with_for_update()).scalars().all()
        by_id={p.id:p for p in product_rows}
        if len(by_id)!=len(quantities): raise HTTPException(400,"One or more products were not found")
        subtotal=Decimal("0.00"); line_snapshots=[]
        for pid,qty in quantities.items():
            p=by_id[pid]
            if qty<=0 or Decimal(p.stock)<qty: raise HTTPException(409,f"Insufficient stock for {p.name}")
            unit_price=Decimal(p.price); line=(unit_price*qty).quantize(Decimal("0.01"),rounding=ROUND_HALF_UP); subtotal+=line
            line_snapshots.append((p,qty,unit_price,line))
        discount=data.discount.quantize(Decimal("0.01"),rounding=ROUND_HALF_UP)
        if discount>subtotal: raise HTTPException(400,"Discount cannot exceed subtotal")
        total=(subtotal-discount).quantize(Decimal("0.01"),rounding=ROUND_HALF_UP)
        inv=Invoice(shop_id=sid,invoice_number=f"VP-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(4).upper()}",customer_name=data.customer_name.strip() or "Walk-in Customer",customer_phone=data.customer_phone.strip(),subtotal=subtotal,discount=discount,total=total,payment_method=data.payment_method)
        for p,qty,price,line in line_snapshots:
            p.stock=Decimal(p.stock)-qty
            inv.items.append(InvoiceItem(product_id=p.id,product_name=p.name,unit=p.unit,quantity=qty,unit_price=price,line_total=line))
        db.add(inv); db.flush()
        if idempotency_key: db.add(IdempotencyRecord(shop_id=sid,key=idempotency_key,invoice_id=inv.id))
        db.add(AuditLog(actor_user_id=user.id,action="invoice.created",detail=f"invoice={inv.invoice_number};total={total}"))
        db.commit(); db.refresh(inv)
        return invoice_json(inv)
    except HTTPException:
        db.rollback(); raise
    except Exception as exc:
        db.rollback()
        if idempotency_key and "uq_idempotency_shop_key" in str(exc):
            old=db.query(IdempotencyRecord).filter_by(shop_id=sid,key=idempotency_key).first()
            if old:
                inv=db.query(Invoice).options(joinedload(Invoice.items)).filter_by(id=old.invoice_id).first()
                if inv:return invoice_json(inv)
        raise HTTPException(500,"Checkout failed; no changes were saved")

@app.get("/api/invoices")
def invoices(user: User = Depends(approved_user), db: Session = Depends(get_db)):
    rows=db.query(Invoice).options(joinedload(Invoice.items)).filter_by(shop_id=get_shop_id(db,user)).order_by(Invoice.created_at.desc()).limit(1000).all()
    return [invoice_json(x) for x in rows]

@app.get("/api/invoices/{invoice_id}")
def invoice_detail(invoice_id: int,user: User = Depends(approved_user),db: Session=Depends(get_db)):
    inv=db.query(Invoice).options(joinedload(Invoice.items)).filter_by(id=invoice_id,shop_id=get_shop_id(db,user)).first()
    if not inv: raise HTTPException(404,"Invoice not found")
    return invoice_json(inv)

@app.get("/api/analytics/summary")
def analytics(user: User=Depends(approved_user),db: Session=Depends(get_db)):
    sid=get_shop_id(db,user)
    # "Today" follows the shop's timezone (APP_TIMEZONE), not UTC, so late-night Indian sales land on the right day.
    try: tz=ZoneInfo(settings.app_timezone)
    except (ZoneInfoNotFoundError, ValueError): tz=timezone.utc
    start_today=datetime.now(tz).replace(hour=0,minute=0,second=0,microsecond=0).astimezone(timezone.utc); start_week=start_today-timedelta(days=6)
    all_invoices=db.query(Invoice).filter_by(shop_id=sid).all()
    def revenue(start=None):
        return sum((Decimal(i.total) for i in all_invoices if start is None or (i.created_at.replace(tzinfo=timezone.utc) if i.created_at.tzinfo is None else i.created_at)>=start),Decimal("0.00"))
    return {"today_revenue":str(revenue(start_today)),"last_7_days_revenue":str(revenue(start_week)),"lifetime_revenue":str(revenue()),"invoice_count":len(all_invoices),"transactions":[invoice_json(i) for i in sorted(all_invoices,key=lambda x:x.created_at,reverse=True)[:200]]}

@app.get("/api/analytics/export")
def export_csv(user: User=Depends(approved_user),db: Session=Depends(get_db)):
    sid=get_shop_id(db,user); rows=db.query(Invoice).filter_by(shop_id=sid).order_by(Invoice.created_at.desc()).all(); out=io.StringIO(); w=csv.writer(out)
    w.writerow(["Invoice Number","Date","Customer","Phone","Subtotal","Discount","Total","Payment Method"])
    for x in rows:
        vals=[x.invoice_number,x.created_at.isoformat(),x.customer_name,x.customer_phone,str(x.subtotal),str(x.discount),str(x.total),x.payment_method]
        vals=[("'"+v if isinstance(v,str) and v.lstrip().startswith(("=","+","-","@","\t","\r")) else v) for v in vals]
        w.writerow(vals)
    return StreamingResponse(iter(["\ufeff"+out.getvalue()]),media_type="text/csv",headers={"Content-Disposition":"attachment; filename=vyapar-invoices.csv"})

@app.delete("/api/analytics/reports")
def clear_reports(user: User=Depends(approved_user),db: Session=Depends(get_db)):
    sid=get_shop_id(db,user)
    db.add(AuditLog(actor_user_id=user.id,action="reports.clear_requested",detail="Historical invoices retained; use archival policy for removal")); db.commit()
    return {"message":"Historical invoice records are retained for audit integrity. CSV export is available; implement a documented retention policy before deleting invoices."}

def admin_user_json(u: User):
    return {"id":u.id,"name":u.name,"email":u.email,"role":u.role,"status":u.status,"created_at":u.created_at.isoformat()}

def active_admin_count(db: Session) -> int:
    return db.query(User).filter(User.role=="admin", User.status=="approved").count()

@app.get("/api/admin/users")
def admin_users(user: User=Depends(admin_user),db: Session=Depends(get_db)):
    return [admin_user_json(u) for u in db.query(User).order_by(User.created_at.desc()).all()]

# Kept compatible with the original API: status is still sent as a query parameter.
@app.patch("/api/admin/users/{user_id}/status")
def update_status(user_id:int,status:str,user:User=Depends(admin_user),db:Session=Depends(get_db)):
    target=db.get(User,user_id)
    if not target: raise HTTPException(404,"User not found")
    try: check_status_change(user,target,status)
    except RuleError as e: raise HTTPException(e.status_code,e.message)
    old=target.status; target.status=status
    if status=="blocked": db.query(LoginSession).filter_by(user_id=target.id).delete()
    db.add(AuditLog(actor_user_id=user.id,action="user.status_changed",detail=f"target={target.id};from={old};to={status}")); db.commit()
    return {"message":"User status updated","status":status,"user":admin_user_json(target)}

@app.patch("/api/admin/users/{user_id}/role")
def update_role(user_id:int,data:RoleChangeIn,user:User=Depends(admin_user),db:Session=Depends(get_db)):
    # Lock the admin rows so two administrators cannot demote each other at the same moment.
    db.execute(select(User.id).where(User.role=="admin").with_for_update())
    target=db.get(User,user_id)
    if not target: raise HTTPException(404,"User not found")
    try: check_role_change(user,target,data.role,active_admin_count(db))
    except RuleError as e:
        db.rollback(); raise HTTPException(e.status_code,e.message)
    old=target.role; target.role=data.role
    db.add(AuditLog(actor_user_id=user.id,action="user.role_changed",detail=f"target={target.id};from={old};to={data.role}")); db.commit()
    return {"message":"User role updated","role":data.role,"user":admin_user_json(target)}
