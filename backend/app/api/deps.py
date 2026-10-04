import jwt
from jwt import PyJWKClient
from typing import Optional
from fastapi import Header, HTTPException, status
from app.core.config import settings

_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> Optional[PyJWKClient]:
    """Get or create cached PyJWKClient for Clerk public JWKS."""
    global _jwks_client
    jwks_url = settings.CLERK_JWKS_URL
    if not jwks_url:
        return None

    if _jwks_client is None:
        try:
            _jwks_client = PyJWKClient(jwks_url, cache_keys=True, max_cached_keys=10)
        except Exception:
            return None
    return _jwks_client


def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """
    Validates Clerk RS256 JWT from Authorization: Bearer <token>.
    Extracts and returns the Clerk user ID ('sub').
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1].strip()
    jwks_client = get_jwks_client()

    if not jwks_client:
        # If Clerk keys are not yet configured in .env, decode without verification in dev or prompt setup
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            return unverified.get("sub", "dev_user")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Clerk authentication is not configured. Please add CLERK_FRONTEND_API to backend/.env",
            )

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing subject (user_id).")
        return user_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session has expired. Please sign in again.")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Allows anonymous evaluations while capturing user_id when signed in."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return get_current_user_id(authorization)
    except Exception:
        return None
