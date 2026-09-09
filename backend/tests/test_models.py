import pytest
from sqlalchemy import inspect
from app.db.session import engine
from app.db.init_db import init_db


@pytest.fixture(scope="module", autouse=True)
def _db():
    init_db()


def test_tables_exist():
    names = inspect(engine).get_table_names()
    assert "documents" in names
    assert "chunks" in names
