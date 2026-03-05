import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Annotated
from urllib.parse import parse_qs, unquote
from uuid import UUID

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import Staff, async_session

# Telegram Ed25519 public key for production
_TG_PUBLIC_KEY_HEX = "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d"
_TG_PUBLIC_KEY = Ed25519PublicKey.from_public_bytes(bytes.fromhex(_TG_PUBLIC_KEY_HEX))

security = HTTPBearer()

ALGORITHM = "HS256"


def create_token(staff_id: UUID, token_type: str = "access") -> str:
    if token_type == "access":
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)

    return jwt.encode(
        {"sub": str(staff_id), "type": token_type, "exp": expire},
        settings.JWT_SECRET,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")


# --- Dependencies ---

async def get_db():
    async with async_session() as session:
        yield session


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Staff:
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    staff_id = payload.get("sub")
    result = await db.execute(select(Staff).where(Staff.id == staff_id, Staff.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def require_role(*roles: str):
    """Dependency factory: restrict endpoint to specific roles."""
    async def checker(user: Annotated[Staff, Depends(get_current_user)]) -> Staff:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return checker


def _extract_bot_id() -> str:
    """Extract bot ID (numeric part before ':') from bot token."""
    return settings.TG_BOT_TOKEN.split(":")[0]


def validate_tg_init_data(init_data: str) -> dict:
    """Validate Telegram Mini App initData using Ed25519 signature.

    Supports the new Telegram validation format (2024+) with Ed25519 signatures,
    and falls back to HMAC-SHA256 for older clients.

    Returns parsed user data dict with keys like 'id', 'first_name', etc.
    Raises HTTPException if validation fails.
    """
    if not settings.TG_BOT_TOKEN:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Bot token not configured")

    parsed = parse_qs(init_data)

    # Try Ed25519 validation first (new format with 'signature' field)
    signature_b64 = parsed.get("signature", [None])[0]
    if signature_b64:
        # Build data-check-string: "{bot_id}:WebAppData\n{sorted_pairs}"
        # Values must be URL-decoded; exclude 'hash' and 'signature'
        decoded_init = unquote(init_data)
        data_pairs = []
        for key_val in decoded_init.split("&"):
            key = key_val.split("=", 1)[0]
            if key not in ("hash", "signature"):
                data_pairs.append(key_val)
        data_pairs.sort()

        bot_id = _extract_bot_id()
        data_check_string = f"{bot_id}:WebAppData\n" + "\n".join(data_pairs)

        # Fix base64url padding
        sig_padded = signature_b64 + "=" * (4 - len(signature_b64) % 4) if len(signature_b64) % 4 else signature_b64
        try:
            sig_bytes = base64.urlsafe_b64decode(sig_padded)
            print(f"[TG_AUTH] bot_id: {bot_id}")
            print(f"[TG_AUTH] data_check_string: {repr(data_check_string[:400])}")
            print(f"[TG_AUTH] signature_b64: {signature_b64}")
            print(f"[TG_AUTH] sig_bytes len: {len(sig_bytes)}")
            _TG_PUBLIC_KEY.verify(sig_bytes, data_check_string.encode())
        except Exception as e:
            print(f"[TG_AUTH] Ed25519 verification failed: {type(e).__name__}: {e}")
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid initData signature")
    else:
        # Fallback to HMAC-SHA256 (old format)
        received_hash = parsed.get("hash", [None])[0]
        if not received_hash:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing hash/signature in initData")

        data_pairs = []
        for key_val in init_data.split("&"):
            key = key_val.split("=", 1)[0]
            if key != "hash":
                data_pairs.append(key_val)
        data_pairs.sort()
        data_check_string = "\n".join(data_pairs)

        secret_key = hmac.new(b"WebAppData", settings.TG_BOT_TOKEN.encode(), hashlib.sha256).digest()
        computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(computed_hash, received_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid initData signature")

    # Parse user JSON
    user_json = parsed.get("user", [None])[0]
    if not user_json:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No user data in initData")

    return json.loads(unquote(user_json))
