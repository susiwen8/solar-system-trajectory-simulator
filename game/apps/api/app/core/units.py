from datetime import datetime, timezone

J2000 = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
SECONDS_PER_DAY = 86_400.0


def seconds_since_j2000(epoch: str) -> float:
    current = datetime.fromisoformat(epoch.replace("Z", "+00:00"))
    return (current - J2000).total_seconds()


def julian_date(epoch: str) -> float:
    return 2_451_545.0 + seconds_since_j2000(epoch) / SECONDS_PER_DAY


def julian_centuries_since_j2000(epoch: str) -> float:
    return (julian_date(epoch) - 2_451_545.0) / 36_525.0
