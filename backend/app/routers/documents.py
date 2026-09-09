import hashlib
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.db import models
from app.ingest.parse import parse_pdf
from app.ingest.chunk import chunk_pages
from app.ingest.embed import embed_texts
from app.ingest.store import store_document
from app.cache import clear_answers

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read()
    content_hash = hashlib.sha256(data).hexdigest()
    existing = db.query(models.Document).filter(models.Document.content_hash == content_hash).first()
    if existing is not None:
        chunk_count = db.query(models.Chunk).filter(models.Chunk.document_id == existing.id).count()
        return {"document_id": str(existing.id), "chunks": chunk_count, "cached": True}
    try:
        pages = parse_pdf(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    chunks = chunk_pages(pages)
    embeddings = embed_texts([c["content"] for c in chunks])
    doc_id = store_document(file.filename, len(pages), chunks, embeddings, db, content_hash=content_hash)
    clear_answers()
    return {"document_id": str(doc_id), "chunks": len(chunks), "cached": False}
