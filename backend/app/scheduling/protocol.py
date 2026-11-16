"""Mediated single-text negotiation with monotonic concessions.

docs/research/negotiation-layer.md, "Recommended design", step 2:

1. The solver drafts s0 and a top-k shortlist (Raiffa's single negotiating text, 1982;
   Klein et al.'s mediator, 2003).
2. The mediator targets the concession that raises the Nash product most, a Zeuthen-style
   rule (Zeuthen 1930; Harsanyi 1956 links it to the Nash solution).
3. The targeted agent answers with exactly one structured move:
   accept(s) | flex(rule_id, new_weight) | hold.
4. Code enforces monotonic concession (Endriss 2006): a flex must lower a weight (which can
   only raise the agent's own reported utility, at every slot), must stay at or above the
   flexibility floor the person declared, and can never be retracted. Anything else is
   rejected and counts as a hold. We enforce this report-level criterion in code; we do not
   claim it coincides with any specific concession criterion analysed by Endriss.
5. At most 3 rounds; stop early when no concession would raise the Nash product (everyone
   accepts the draft) or a round passes with no concession.
6. The final pick is the solver's argmax on the final reports. An LLM only renders text.

Security (Vaccaro et al. 2025; Bianchi et al. 2024): a move's free text is untrusted and
never reaches the solver. Only the structured fields do, and only after validation.

Everything here is synchronous and database-free so the live negotiation and the
evaluation harness run exactly the same code.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field, replace
from typing import Callable, Literal

from app.scheduling.normalize import Scheme, normalizer
from app.scheduling.selector import EPS, Profile, Selection, gains, leximin_select, nash_select
from app.scheduling.utility import UtilityModel

MAX_ROUNDS = 3
SHORTLIST = 3
_TOL = 1e-9

DMode = Literal["default", "elicited"]


@dataclass
class AgentState:
    user_id: str
    model: UtilityModel  # the current report; weights only ever go down during a negotiation
    d_raw: float | None = None  # elicited "how bad if this doesn't happen", on the raw scale

    def weight(self, rule_id: str) -> float:
        c = self.model.criterion(rule_id)
        return c.weight if c else 0.0


@dataclass
class Draft:
    selection: Selection
    utilities: Profile  # agent -> slot -> utility on the common scale
    d: dict[str, float]  # disagreement point per agent, on the common scale

    @property
    def pick(self) -> str | None:
        return self.selection.slot_id

    @property
    def shortlist(self) -> list[str]:
        return self.selection.ranking[:SHORTLIST]

    def objective(self) -> float:
        best = self.selection.slot_id or self.selection.near_miss
        return self.selection.objective.get(best, float("-inf")) if best else float("-inf")


class Solver:
    """Reports in, draft out. Normalization, d and the selector are switchable for ablations."""

    def __init__(
        self,
        slots: list[str],
        *,
        scheme: Scheme = "borda",
        selector: Literal["nash", "leximin"] = "nash",
        d_mode: DMode = "default",
        eps: float = EPS,
        tau: float | None = None,
        floor_mode: Literal["strict", "prefer"] = "strict",
    ) -> None:
        self.slots = slots
        self.scheme = scheme
        self.selector = selector
        self.d_mode = d_mode
        self.eps = eps
        self.tau = tau
        # "strict": no slot above the floor means no meeting (an explicit outcome).
        # "prefer": the floor picks among slots that meet it, else the plain Nash pick stands.
        self.floor_mode = floor_mode
        self._cache: dict[tuple, tuple[dict[str, float], float]] = {}

    def _normalized(self, state: AgentState) -> tuple[dict[str, float], float]:
        key = (state.user_id, tuple(c.weight for c in state.model.criteria), state.d_raw)
        hit = self._cache.get(key)
        if hit is None:
            raw = state.model.raw(self.slots)
            f = normalizer(raw, self.scheme)
            # d: option 1 (elicited, mapped through the same normalization) when given;
            # otherwise option 3, d = 0 on the common scale. That default is an assumption.
            d = f(state.d_raw) if (self.d_mode == "elicited" and state.d_raw is not None) else 0.0
            hit = ({s: f(v) for s, v in raw.items()}, d)
            self._cache[key] = hit
        return hit

    def solve(self, states: list[AgentState]) -> Draft:
        u: Profile = {}
        d: dict[str, float] = {}
        for st in states:
            u[st.user_id], d[st.user_id] = self._normalized(st)
        if self.selector == "leximin":
            sel = leximin_select(u, d, self.slots)
        else:
            sel = nash_select(u, d, self.slots, eps=self.eps, tau=self.tau, require_ir=self.d_mode == "elicited")
            if sel.status == "floor_unmet" and self.floor_mode == "prefer":
                sel = nash_select(u, d, self.slots, eps=self.eps, require_ir=self.d_mode == "elicited")
        return Draft(sel, u, d)


# ---------- the mediator's request ----------

@dataclass(frozen=True)
class Request:
    user_id: str
    rule_id: str
    rule_label: str
    current_weight: float
    floor: float
    target: str  # the slot the solver would pick if this agent conceded fully
    draft: str | None  # the current draft s0
    gain: float  # increase in the Nash objective from that concession (Zeuthen-style target)
    reason_code: str  # e.g. "raises_nash_product"


def next_request(states: list[AgentState], solver: Solver, draft: Draft | None = None) -> Request | None:
    """The single concession that would raise the Nash product most, or None if no
    concession inside anyone's declared range would improve it (everyone accepts)."""
    draft = draft or solver.solve(states)
    base = draft.objective()
    best: Request | None = None
    for i, st in enumerate(states):
        for c in st.model.criteria:
            if c.weight <= c.floor + _TOL:
                continue  # already at the declared floor: nothing left to give
            trial = list(states)
            trial[i] = replace(st, model=st.model.with_weight(c.rule_id, c.floor))
            after = solver.solve(trial)
            gain = after.objective() - base
            if after.pick is None or gain <= 1e-6:
                continue
            if best is None or gain > best.gain + _TOL:
                best = Request(st.user_id, c.rule_id, c.label, c.weight, c.floor, after.pick, draft.pick,
                               gain, "raises_nash_product")
    return best


# ---------- the agent's answer ----------

MoveKind = Literal["accept", "flex", "hold"]


@dataclass
class Move:
    kind: MoveKind
    rule_id: str | None = None
    new_weight: float | None = None
    text: str = ""  # untrusted free text: shown to people, never read by the solver


@dataclass
class Applied:
    valid: bool
    kind: MoveKind  # what actually took effect ("hold" when a flex was rejected)
    rule_id: str | None
    old_weight: float | None
    new_weight: float | None
    reason: str | None = None  # why a move was rejected


def apply_move(state: AgentState, move: Move) -> tuple[AgentState, Applied]:
    """Validate a move in code. Only a valid flex changes the report."""
    if move.kind in ("accept", "hold"):
        return state, Applied(True, move.kind, None, None, None)
    if move.kind != "flex":
        return state, Applied(False, "hold", None, None, None, "unknown move")
    c = state.model.criterion(move.rule_id or "")
    if c is None:
        return state, Applied(False, "hold", move.rule_id, None, None, "no such rule")
    if move.new_weight is None:
        return state, Applied(False, "hold", c.rule_id, c.weight, None, "no weight given")
    new = float(move.new_weight)
    if new >= c.weight - _TOL:
        # Raising a weight would retract an earlier concession; equal is no concession at all.
        return state, Applied(False, "hold", c.rule_id, c.weight, new, "not a concession (weight must go down)")
    if new < c.floor - _TOL:
        return state, Applied(False, "hold", c.rule_id, c.weight, new, "below the flexibility the person allowed")
    updated = replace(state, model=state.model.with_weight(c.rule_id, new))
    return updated, Applied(True, "flex", c.rule_id, c.weight, new)


# ---------- display order ----------

def display_shortlist(shortlist: list[str], user_id: str, rnd: int) -> list[tuple[int, str]]:
    """The shortlist as one agent sees it: solver rank attached, display order shuffled per
    agent, so no slot benefits from being mentioned first (Magentic Marketplace, 2025)."""
    shown = list(enumerate(shortlist, start=1))
    random.Random(f"{user_id}:{rnd}").shuffle(shown)
    return shown


# ---------- explanation faithfulness ----------

@dataclass(frozen=True)
class Binding:
    """The solver's actual reason for its pick, which an explanation must name."""

    pick: str
    runner_up: str | None  # the best slot that differs from the pick for someone
    decisive: str | None  # the agent who would lose most if the runner-up were chosen
    decisive_label: str | None  # what the runner-up would cost them, if a rule explains it
    bottleneck: str | None  # lowest gain at the pick
    tied: tuple[str, ...] = ()  # slots identical to the pick for everyone; time order broke the tie

    def to_dict(self) -> dict:
        return dict(self.__dict__)


def binding_reason(draft: Draft, models: dict[str, UtilityModel]) -> Binding | None:
    pick = draft.pick
    if pick is None:
        return None
    ranking = draft.selection.ranking
    g = gains(draft.utilities, draft.d, ranking)

    def same(s: str) -> bool:
        return all(abs(g[a][s] - g[a][pick]) <= _TOL for a in g)

    # A slot identical for everyone is not a real alternative: only the time-order tie-break
    # separates it, and an explanation must not invent a person it "would have cost".
    tied = tuple(s for s in ranking if s != pick and same(s))
    runner = next((s for s in ranking if s != pick and not same(s)), None)
    decisive = None
    label = None
    if runner:
        decisive = max(g, key=lambda a: g[a][pick] - g[a][runner])
        worst = models[decisive].worst_criterion(runner) if decisive in models else None
        label = worst.label if worst else None
    return Binding(pick, runner, decisive, label, draft.selection.bottleneck, tied)


def faithful(text: str, binding: Binding | None, names: dict[str, str]) -> bool:
    """Does the explanation name the person the decision actually turned on?"""
    if binding is None or binding.decisive is None:
        return True  # a single feasible slot: there is no runner-up to explain away
    first = names.get(binding.decisive, "").split()[0] if names.get(binding.decisive) else ""
    return bool(first) and first.lower() in text.lower()


# ---------- the whole loop, for code that can answer synchronously ----------

@dataclass
class Round:
    number: int
    request: Request
    move: Move
    applied: Applied
    draft: Draft


@dataclass
class Outcome:
    final: Draft
    first: Draft
    rounds: list[Round] = field(default_factory=list)
    states: list[AgentState] = field(default_factory=list)
    stop: str = "max_rounds"


Responder = Callable[[AgentState, Request, Draft], Move]


def negotiate(
    states: list[AgentState], solver: Solver, respond: Responder, max_rounds: int = MAX_ROUNDS
) -> Outcome:
    states = list(states)
    draft = first = solver.solve(states)
    rounds: list[Round] = []
    stop = "max_rounds"
    for number in range(1, max_rounds + 1):
        req = next_request(states, solver, draft)
        if req is None:
            stop = "everyone_accepts"
            break
        i = next(k for k, st in enumerate(states) if st.user_id == req.user_id)
        move = respond(states[i], req, draft)
        states[i], applied = apply_move(states[i], move)
        draft = solver.solve(states)
        rounds.append(Round(number, req, move, applied, draft))
        if applied.kind != "flex":
            stop = "no_concession"
            break
    return Outcome(draft, first, rounds, states, stop)
