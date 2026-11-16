import os
import tempfile

# Must be set before the app (and its engine) is imported.
_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.name}"
os.environ["MEETMIND_AGENTS"] = "simulated"
