import os

# Ensure a non-empty key exists at import time so module-level OpenAI(...) clients
# (embed.py, and later answer.py) can be constructed during test collection.
# Tests mock the client, so no real API call is made.
os.environ.setdefault("OPENAI_API_KEY", "test-dummy-key")

import pytest


@pytest.fixture(autouse=True)
def _clear_answer_cache():
    # 인메모리 답변 캐시가 테스트 간 새지 않도록 각 테스트 전에 비웁니다.
    from app import cache

    cache.clear_answers()
    yield
