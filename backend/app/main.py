from fastapi import FastAPI
from app.db.init_db import init_db
from app.routers import documents, chat

app = FastAPI(title="PDF-RAG")


@app.on_event("startup")
def _startup():
    init_db()


app.include_router(documents.router)
app.include_router(chat.router)
