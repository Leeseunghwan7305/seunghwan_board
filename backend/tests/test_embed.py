from unittest.mock import patch, MagicMock
from app.ingest import embed

def test_embed_texts_returns_vectors():
    fake = MagicMock()
    fake.data = [MagicMock(embedding=[0.1] * 1536), MagicMock(embedding=[0.2] * 1536)]
    with patch.object(embed, "_client") as client:
        client.embeddings.create.return_value = fake
        vecs = embed.embed_texts(["a", "b"])
    assert len(vecs) == 2
    assert len(vecs[0]) == 1536
