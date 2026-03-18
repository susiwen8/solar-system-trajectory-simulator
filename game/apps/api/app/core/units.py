from datetime import datetime, timezone

J2000 = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)


def seconds_since_j2000(epoch: str) -> float:
    current = datetime.fromisoformat(epoch.replace("Z", "+00:00"))
    return (current - J2000).total_seconds()
