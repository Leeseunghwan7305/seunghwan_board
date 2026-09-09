import os

# BYOK: server env key is only the fallback when no X-OpenAI-Key header is sent
# (see app.deps.get_openai_key). Set a dummy value so tests that hit endpoints
# without the header still pass through the dependency; the OpenAI client itself
# is always mocked in these tests, so no real API call is made.
os.environ.setdefault("OPENAI_API_KEY", "test-dummy-key")

import pytest


@pytest.fixture(autouse=True)
def _clear_answer_cache():
    # 인메모리 답변 캐시가 테스트 간 새지 않도록 각 테스트 전에 비웁니다.
    from app import cache

    cache.clear_answers()
    yield
