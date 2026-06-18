import logging
from config import settings

logger = logging.getLogger(__name__)


def is_rate_limit_error(e: Exception) -> bool:
    """Check if an exception is related to rate limits or resource exhaustion."""
    err_str = str(e).lower()
    return (
        "429" in err_str or
        "resourceexhausted" in err_str or
        "rate limit" in err_str or
        "quota" in err_str or
        "resource_exhausted" in err_str
    )


class APIKeyManager:
    def __init__(self):
        self._keys = []
        self._current_index = 0
        self.initialize_keys()

    def initialize_keys(self):
        keys = []
        
        # Load from GEMINI_API_KEYS setting if populated
        setting_keys = getattr(settings, "GEMINI_API_KEYS", [])
        for k in setting_keys:
            clean_k = k.strip().replace('"', '').replace("'", "")
            if clean_k and clean_k not in keys:
                keys.append(clean_k)
                
        # Also fall back to the single GEMINI_API_KEY if not already included
        single_key = getattr(settings, "GEMINI_API_KEY", "")
        if single_key:
            # In case the user specified multiple comma-separated keys inside GEMINI_API_KEY directly
            for k in single_key.split(","):
                clean_k = k.strip().replace('"', '').replace("'", "")
                if clean_k and clean_k not in keys:
                    keys.append(clean_k)
            
        self._keys = keys
        self._current_index = 0
        
        # Mask keys for logging safety
        masked_keys = [self._mask(k) for k in self._keys]
        logger.info(f"APIKeyManager initialized with keys: {masked_keys}")

    def _mask(self, key: str) -> str:
        if not key:
            return "None"
        return f"...{key[-6:]}" if len(key) > 6 else "..."

    def get_current_key(self) -> str | None:
        if not self._keys:
            return None
        return self._keys[self._current_index]

    def rotate_key(self) -> str | None:
        if not self._keys or len(self._keys) <= 1:
            return self.get_current_key()
            
        old_key = self.get_current_key()
        self._current_index = (self._current_index + 1) % len(self._keys)
        new_key = self.get_current_key()
        
        logger.warning(
            f"Rotating API Key: switched from {self._mask(old_key)} to {self._mask(new_key)}."
        )
        return new_key

    def has_multiple_keys(self) -> bool:
        return len(self._keys) > 1

    @property
    def keys(self) -> list[str]:
        return self._keys


# Global singleton instance
key_manager = APIKeyManager()
