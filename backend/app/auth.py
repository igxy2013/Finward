from datetime import datetime, timedelta, timezone
import json
import urllib.request
from secrets import token_urlsafe

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_session
from .models import User, Session as DbSession


def wechat_exchange(js_code: str) -> dict:
    settings = get_settings()
    appid = settings.effective_wx_app_id
    secret = settings.effective_wx_app_secret
    if not appid or not secret:
        raise HTTPException(status_code=500, detail="WeChat credentials not configured")
    url = (
        "https://api.weixin.qq.com/sns/jscode2session"
        f"?appid={appid}&secret={secret}&js_code={js_code}&grant_type=authorization_code"
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=502, detail="WeChat service unavailable")
    if "errcode" in data and data["errcode"] != 0:
        raise HTTPException(status_code=400, detail=f"WeChat error: {data.get('errmsg', '')}")
    return data


def create_session(session: Session, user: User, session_key: str) -> DbSession:
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    token = token_urlsafe(48)
    s = DbSession(user_id=user.id, token=token, session_key=session_key, expires_at=expires)
    session.add(s)
    session.commit()
    session.refresh(s)
    return s


def get_current_user(request: Request, session: Session = Depends(get_session)) -> User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    token = auth.removeprefix("Bearer ").strip()
    db_sess = session.query(DbSession).filter(DbSession.token == token).first()
    if not db_sess:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    # Normalize timezone for robust comparison
    def to_utc(dt: datetime) -> datetime:
        if dt is None:
            return datetime.now(timezone.utc)
        if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    if to_utc(db_sess.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    user = session.get(User, db_sess.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
