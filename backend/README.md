## RAGAS 평가 (실제 수치 생성)

자동 테스트는 RAGAS를 mock한다. 실제 A/B 점수를 뽑으려면 OpenAI 키와 인제스트된 문서가 필요하다.

1. `pip install -r backend/requirements-eval.txt`  (ragas==0.4.3)
2. `backend/.env`에 실제 `OPENAI_API_KEY` 설정
3. 샘플 PDF 인제스트: `curl -F "file=@backend/tests/fixtures/sample.pdf" http://localhost:8000/documents`
4. 평가 실행: `curl -X POST http://localhost:8000/eval`  → dense vs hybrid 4지표 반환
5. 최근 결과 조회: `curl http://localhost:8000/eval/latest`

지표: faithfulness, answer_relevancy, context_precision, context_recall.
"hybrid"가 "dense"보다 context_precision/recall이 높으면 하이브리드+리랭크의 검색 품질 개선이 수치로 증명된 것.
