import sys
import os
import types

# Vercel deploys backend/ as /var/task, so all code lives at /var/task/app/...
# But the codebase uses 'from backend.app.X import Y' everywhere.
# We inject a virtual 'backend' package whose __path__ points to /var/task,
# so Python resolves backend.app.* -> /var/task/app/*.
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if "backend" not in sys.modules:
    _pkg = types.ModuleType("backend")
    _pkg.__path__ = [_root]
    _pkg.__package__ = "backend"
    sys.modules["backend"] = _pkg

sys.path.insert(0, _root)

from backend.app.main import app  # noqa: E402
