from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    OPENAI_API_KEY: str = ""
    DATABASE_URL: str = "postgresql+psycopg://rag:rag@localhost:5433/ragdb"
    EMBED_MODEL: str = "text-embedding-3-small"
    EMBED_DIM: int = 1536
    CHAT_MODEL: str = "gpt-4.1-mini"
    RRF_K: int = 60
    SIMILARITY_THRESHOLD: float = 0.3


settings = Settings()
