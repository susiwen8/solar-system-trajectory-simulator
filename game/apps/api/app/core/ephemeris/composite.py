from app.core.ephemeris.base import BodyState, Ephemeris, MAJOR_BODY_IDS


class CompositeEphemeris:
    def __init__(self, primary: Ephemeris, fallback: Ephemeris) -> None:
        self.primary = primary
        self.fallback = fallback

    @property
    def source_name(self) -> str:
        return f"{self.primary.source_name}+fallback:{self.fallback.source_name}"

    def get_body_state(self, body_id: str, epoch: str) -> BodyState:
        try:
            return self.primary.get_body_state(body_id, epoch)
        except KeyError:
            return self.fallback.get_body_state(body_id, epoch)

    def get_all_body_states(self, epoch: str) -> list[BodyState]:
        return [self.get_body_state(body_id, epoch) for body_id in MAJOR_BODY_IDS]
