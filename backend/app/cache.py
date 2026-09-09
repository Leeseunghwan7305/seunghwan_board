_answer_cache: dict[str, dict] = {}


def _key(query: str) -> str:
    return query.strip()


def get_answer(query: str) -> dict | None:
    return _answer_cache.get(_key(query))


def put_answer(query: str, response: dict) -> None:
    _answer_cache[_key(query)] = response


def clear_answers() -> int:
    n = len(_answer_cache)
    _answer_cache.clear()
    return n
