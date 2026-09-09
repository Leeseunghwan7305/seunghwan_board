import uuid
from sqlalchemy.orm import Session
from app.db import models

def store_document(filename, page_count, chunks, embeddings, db: Session) -> uuid.UUID:
    doc = models.Document(filename=filename, page_count=page_count)
    db.add(doc)
    db.flush()  # doc.id 확보
    for ch, emb in zip(chunks, embeddings):
        db.add(models.Chunk(
            document_id=doc.id, page=ch["page"],
            chunk_index=ch["chunk_index"], content=ch["content"], embedding=emb,
        ))
    db.commit()
    return doc.id
