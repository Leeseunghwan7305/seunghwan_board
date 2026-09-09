from app.config import settings


def test_settings_defaults():
    assert settings.EMBED_MODEL == "text-embedding-3-small"
    assert settings.EMBED_DIM == 1536
    assert settings.CHAT_MODEL == "gpt-4.1-mini"
    assert settings.RRF_K == 60
    assert settings.SIMILARITY_THRESHOLD == 0.3
