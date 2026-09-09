from openai import OpenAI
from app.config import settings

_SYSTEM = (
    "너는 업로드된 문서에 근거해서만 답하는 어시스턴트야. "
    "아래 [근거] 각 항목은 (p.페이지) 형식으로 출처가 있어. "
    "답변에 사용한 근거의 출처를 문장 끝에 [p.페이지]로 표기해. "
    "근거에 없는 내용은 지어내지 말고 '문서에 근거가 없습니다.'라고만 답해."
)


def generate_answer(query: str, hits: list[dict], api_key: str) -> dict:
    if not hits or hits[0]["score"] < settings.SIMILARITY_THRESHOLD:
        return {"answer": "문서에 근거가 없습니다.", "citations": []}

    context = "\n".join(f"(p.{h['page']}) {h['content']}" for h in hits)
    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model=settings.CHAT_MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": f"{_SYSTEM}\n\n[근거]\n{context}"},
            {"role": "user", "content": query},
        ],
    )
    text = resp.choices[0].message.content.strip()
    citations = [
        {"page": h["page"], "snippet": h["content"][:120], "score": round(float(h["score"]), 4)}
        for h in hits
    ]
    return {"answer": text, "citations": citations}
