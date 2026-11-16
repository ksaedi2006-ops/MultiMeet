from dataclasses import dataclass

COMFORT = 50  # below this, a person is being asked to compromise


@dataclass(frozen=True)
class RankedSlot:
    slot_id: str
    min_score: int
    avg_score: float
    scores: dict[str, int]  # user_id -> score

    @property
    def unhappy(self) -> list[str]:
        """People below the comfort line, least happy first."""
        return sorted((u for u, s in self.scores.items() if s < COMFORT), key=lambda u: self.scores[u])

    @property
    def everyone_comfortable(self) -> bool:
        return self.min_score >= COMFORT

    def to_dict(self) -> dict:
        return {
            "slot_id": self.slot_id,
            "min_score": self.min_score,
            "avg_score": round(self.avg_score, 1),
            "scores": self.scores,
            "unhappy": self.unhappy,
        }


def rank_slots(slot_ids: list[str], scores: dict[str, dict[str, int]]) -> list[RankedSlot]:
    """Rank viable slots by Rawlsian fairness: best worst-off person first, then average.

    `scores` maps user_id -> {slot_id: 0..100}. A slot missing for a user (e.g. their
    agent never scored it) counts as 0, so gaps can't make a slot look better.
    Ties keep chronological order.
    """
    users = list(scores)
    if not users:
        return []
    ranked = []
    for slot_id in slot_ids:
        row = {u: int(scores[u].get(slot_id, 0)) for u in users}
        ranked.append(RankedSlot(slot_id, min(row.values()), sum(row.values()) / len(row), row))
    order = {sid: i for i, sid in enumerate(slot_ids)}
    ranked.sort(key=lambda r: (-r.min_score, -r.avg_score, order[r.slot_id]))
    return ranked
