# NOTE: ragas는 최상단에서 import하지 않는다(무겁고, 미설치 환경에서도 다른 코드가 import되어야 함).
# 실제 RAGAS 배선은 _run_ragas 내부에만 존재하며, 설치된 ragas==0.4.3의 API로 채운다.

def score_samples(samples: list[dict], metric_names: list[str], api_key: str) -> dict:
    if not samples:
        return {name: 0.0 for name in metric_names}
    return _run_ragas(samples, metric_names, api_key)


def _run_ragas(samples: list[dict], metric_names: list[str], api_key: str) -> dict:
    # BYOK: ragas의 기본 OpenAI LLM/임베딩이 이 프로세스 환경변수에서 키를 읽으므로,
    # ragas를 import/호출하기 전에 요청 단위 키를 환경에 반영한다(서버에 영구 저장하지 않음).
    import os
    os.environ["OPENAI_API_KEY"] = api_key

    # 지연 import (테스트는 이 함수를 patch하므로 ragas 없이도 통과)
    from ragas import evaluate, EvaluationDataset
    from ragas import metrics as M

    metric_map = {
        "faithfulness": M.faithfulness,
        "answer_relevancy": M.answer_relevancy,
        "context_precision": M.context_precision,
        "context_recall": M.context_recall,
    }
    metrics = [metric_map[n] for n in metric_names]

    dataset = EvaluationDataset.from_list([
        {
            "user_input": s["question"],
            "response": s["answer"],
            "retrieved_contexts": s["contexts"],
            "reference": s["ground_truth"],
        }
        for s in samples
    ])
    result = evaluate(dataset=dataset, metrics=metrics)
    # result를 지표별 평균 스칼라로 환원
    df = result.to_pandas()
    return {n: float(df[n].mean()) for n in metric_names}
