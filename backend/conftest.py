import os

# Ensure a non-empty key exists at import time so module-level OpenAI(...) clients
# (embed.py, and later answer.py) can be constructed during test collection.
# Tests mock the client, so no real API call is made.
os.environ.setdefault("OPENAI_API_KEY", "test-dummy-key")
