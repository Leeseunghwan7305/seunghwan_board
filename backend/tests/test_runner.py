from unittest.mock import patch
from app.eval import runner

def test_build_samples_shapes_rows():
    qa = [{"question": "q1", "ground_truth": "g1"}]
    with patch.object(runner, "answer_for_eval",
                      return_value={"answer": "a1", "contexts": ["c1"]}) as af:
        rows = runner.build_samples(qa, db=None, mode="dense", api_key="k")
    af.assert_called_once_with("q1", None, "dense", "k")
    assert rows == [{"question": "q1", "answer": "a1", "contexts": ["c1"], "ground_truth": "g1"}]

def test_run_ab_eval_scores_both_modes():
    with patch.object(runner, "_load_qa_set", return_value=[{"question":"q","ground_truth":"g"}]), \
         patch.object(runner, "answer_for_eval", return_value={"answer":"a","contexts":["c"]}), \
         patch.object(runner, "score_samples", return_value={"faithfulness":0.9,"answer_relevancy":0.8,"context_precision":0.7,"context_recall":0.6}):
        out = runner.run_ab_eval(db=None, api_key="k")
    assert set(out.keys()) == {"dense", "hybrid"}
    assert out["hybrid"]["faithfulness"] == 0.9
