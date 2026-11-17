"""The Lab: stream the evaluation one simulated meeting at a time (see app/lab.py)."""

import asyncio
import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.lab import ATTACKS, MECHANISMS, SIZES, lab_instance, lab_meeting, lab_row

router = APIRouter(prefix="/lab", tags=["lab"])
MAX_RUN = 510  # the instances per group size that docs/eval/RESULTS.md reports on


def _parse(mechs: str, n: int, attack: str) -> list[str]:
    names = [m for m in mechs.split(",") if m]
    if not names or any(m not in MECHANISMS for m in names):
        raise HTTPException(400, f"mechs must be a comma list of: {', '.join(MECHANISMS)}")
    if n not in SIZES:
        raise HTTPException(400, f"n must be one of {SIZES}")
    if attack not in ATTACKS:
        raise HTTPException(400, f"attack must be one of {ATTACKS}")
    return names


@router.get("/options")
def options():
    return {"mechanisms": MECHANISMS, "attacks": ATTACKS, "sizes": SIZES, "max_run": MAX_RUN}


@router.get("/run")
async def run(
    mechs: str = "nash,old,utilitarian,borda,when2meet",
    n: int = 5,
    attack: str = "none",
    count: int = Query(200, ge=1, le=MAX_RUN),
    start: int = Query(0, ge=0, le=MAX_RUN - 1),
):
    """Newline-delimited JSON, one line per meeting, as each one is scored. Stops when the client leaves."""
    names = _parse(mechs, n, attack)

    async def lines():
        for idx in range(start, min(MAX_RUN, start + count)):
            row = await asyncio.to_thread(lab_row, idx, n, names, attack)
            if row:
                yield json.dumps(row) + "\n"

    return StreamingResponse(lines(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})


@router.get("/instance")
async def instance(idx: int, n: int = 5, mechs: str = "nash,old,utilitarian,borda,when2meet", attack: str = "none"):
    names = _parse(mechs, n, attack)
    data = await asyncio.to_thread(lab_instance, idx, n, names, attack)
    if data is None:
        raise HTTPException(404, "That instance was dropped by the generator.")
    return data


@router.get("/meeting")
async def meeting(idx: int = 0, n: int = 5, attack: str = "none"):
    """One meeting under every rule, for the playground."""
    _parse("nash", n, attack)
    data = await asyncio.to_thread(lab_meeting, idx, n, attack)
    if data is None:
        raise HTTPException(404, "That instance was dropped by the generator.")
    return data
