from functools import lru_cache

from cryptography.fernet import Fernet

from config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        if not settings.ENCRYPTION_KEY:
            raise RuntimeError("ENCRYPTION_KEY is not set")
        _fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    return _fernet


def encrypt(value: str | None) -> str | None:
    if value is None:
        return None
    return _get_fernet().encrypt(value.encode()).decode()


@lru_cache(maxsize=4096)
def decrypt(value: str | None) -> str | None:
    if value is None:
        return None
    return _get_fernet().decrypt(value.encode()).decode()
