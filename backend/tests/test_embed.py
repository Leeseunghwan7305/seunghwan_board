from unittest.mock import patch, MagicMock
from app.ingest import embed

def test_embed_texts_returns_vectors():
    fake = MagicMock()
    fake.data = [MagicMock(embedding=[0.1] * 1536), MagicMock(embedding=[0.2] * 1536)]
    mock_client = MagicMock()
    mock_client.embeddings.create.return_value = fake
    with patch.object(embed, "OpenAI", return_value=mock_client) as MockOpenAI:
        vecs = embed.embed_texts(["a", "b"], "test-key")
    MockOpenAI.assert_called_once_with(api_key="test-key")
    assert len(vecs) == 2
    assert len(vecs[0]) == 1536
