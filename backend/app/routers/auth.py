from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import wechat_exchange, create_session, get_current_user
from ..database import get_session
from ..models import User
from ..config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/wechat", response_model=schemas.LoginOut)
def wechat_login(payload: schemas.WechatLoginIn, session: Session = Depends(get_session)):
    data = wechat_exchange(payload.js_code)
    openid = data.get("openid")
    session_key = data.get("session_key", "")
    unionid = data.get("unionid")
    user = session.query(User).filter(User.openid == openid).first()
    if not user:
        user = User(openid=openid, unionid=unionid)
        session.add(user)
        session.commit()
        session.refresh(user)
    s = create_session(session, user, session_key)
    return schemas.LoginOut(token=s.token, expires_at=s.expires_at)


@router.get("/status")
def auth_status():
    settings = get_settings()
    configured = bool(settings.effective_wx_app_id) and bool(settings.effective_wx_app_secret)
    return {"configured": configured}


@router.get("/me", response_model=schemas.UserProfileOut)
def get_me(user = Depends(get_current_user)):
    return schemas.UserProfileOut(id=user.id, nickname=getattr(user, "nickname", None), avatar_url=getattr(user, "avatar_url", None))


@router.patch("/profile", response_model=schemas.UserProfileOut)
def update_profile(payload: schemas.UserProfileUpdate, session: Session = Depends(get_session), user = Depends(get_current_user)):
    updated = False
    data = payload.model_dump(exclude_unset=True)
    if "nickname" in data:
        user.nickname = data["nickname"]
        updated = True
    if "avatar_url" in data:
        user.avatar_url = data["avatar_url"]
        updated = True
    if updated:
        session.add(user)
        session.commit()
        session.refresh(user)
    return schemas.UserProfileOut(id=user.id, nickname=getattr(user, "nickname", None), avatar_url=getattr(user, "avatar_url", None))
