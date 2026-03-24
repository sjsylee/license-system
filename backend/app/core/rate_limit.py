from dataclasses import dataclass
from threading import Lock
from time import monotonic


@dataclass
class RateLimitState:
    count: int
    reset_at: float


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._state: dict[str, RateLimitState] = {}
        self._lock = Lock()
        self._access_count = 0

    def is_limited(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = monotonic()
        with self._lock:
            self._maybe_prune(now)
            state = self._state.get(key)
            if state is None or state.reset_at <= now:
                self._state.pop(key, None)
                return False, 0
            if state.count < limit:
                return False, 0
            retry_after = max(1, int(state.reset_at - now))
            return True, retry_after

    def hit(self, key: str, window_seconds: int) -> int:
        now = monotonic()
        with self._lock:
            self._maybe_prune(now)
            state = self._state.get(key)
            if state is None or state.reset_at <= now:
                self._state[key] = RateLimitState(count=1, reset_at=now + window_seconds)
                return 1
            state.count += 1
            return state.count

    def reset(self, key: str) -> None:
        with self._lock:
            self._state.pop(key, None)

    def _maybe_prune(self, now: float) -> None:
        self._access_count += 1
        if self._access_count % 128 != 0:
            return
        expired_keys = [key for key, state in self._state.items() if state.reset_at <= now]
        for key in expired_keys:
            self._state.pop(key, None)


login_rate_limiter = InMemoryRateLimiter()
validate_rate_limiter = InMemoryRateLimiter()
