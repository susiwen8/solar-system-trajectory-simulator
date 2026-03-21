from app.mission.models import MissionCandidate, MissionSamples, SpacecraftSample, parse_timestamp


def sample_candidate(candidate: MissionCandidate, step_seconds: int) -> MissionSamples:
    spacecraft_samples: list[SpacecraftSample] = []
    for leg in candidate.legs:
        departure_dt = parse_timestamp(leg.departure_time)
        arrival_dt = parse_timestamp(leg.arrival_time)
        duration_seconds = max(int((arrival_dt - departure_dt).total_seconds()), step_seconds)
        steps = max(duration_seconds // step_seconds, 1)

        for index in range(steps + 1):
            fraction = index / steps
            timestamp = departure_dt.timestamp() + duration_seconds * fraction
            position = [
                start + (end - start) * fraction
                for start, end in zip(leg.departure_position_km, leg.arrival_position_km)
            ]
            if spacecraft_samples and timestamp <= spacecraft_samples[-1].timestamp:
                continue
            spacecraft_samples.append(
                SpacecraftSample(timestamp=timestamp, position_km=position)
            )

    return MissionSamples(spacecraft=spacecraft_samples)

