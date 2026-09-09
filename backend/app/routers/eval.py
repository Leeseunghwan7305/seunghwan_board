from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db, get_openai_key
from app.eval.runner import run_ab_eval
from app.eval.store import save_results, load_results

router = APIRouter(prefix="/eval", tags=["eval"])

@router.post("")
def run_eval(db: Session = Depends(get_db), api_key: str = Depends(get_openai_key)):
    results = run_ab_eval(db, api_key)
    save_results(results)
    return results

@router.get("/latest")
def latest():
    results = load_results()
    if results is None:
        raise HTTPException(status_code=404, detail="no eval results yet")
    return results
