from app.services.mission_service import MissionService


def test_mission_service_returns_closest_approach_metric(bundled_ephemeris, sample_mission_request) -> None:
    service = MissionService(ephemeris=bundled_ephemeris)
    result = service.propagate(sample_mission_request)

    assert result.closest_approach["bodyId"] == "mars"
    assert result.flight_time_seconds > 0
    assert len(result.samples) > 1
    assert result.mission_timeline is not None
    assert result.mission_timeline["phases"]


def test_mission_service_warns_for_extreme_probe_distance(bundled_ephemeris, sample_mission_request) -> None:
    service = MissionService(ephemeris=bundled_ephemeris)
    request = sample_mission_request.model_copy(
        update={
            "initialState": sample_mission_request.initialState.model_copy(
                update={
                    "stateVector": sample_mission_request.initialState.stateVector.model_copy(
                        update={
                            "positionKm": (5_000_000_000.0, 0.0, 0.0),
                            "velocityKmPerSec": (0.0, 0.0, 0.0)
                        }
                    )
                }
            )
        }
    )

    result = service.propagate(request)

    assert any("distance" in warning.lower() for warning in result.warnings)


def test_mission_service_uses_time_varying_target_states_for_closest_approach(sample_mission_request) -> None:
    class RecordingEphemeris:
        def __init__(self) -> None:
            self.target_epochs: list[str] = []

        def get_body_state(self, body_id: str, epoch: str):
            from app.core.ephemeris.base import BodyState

            if body_id == "sun":
                return BodyState("sun", epoch, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0), 132_712_440_018.0)
            if body_id == "mars":
                self.target_epochs.append(epoch)
                if epoch.endswith("06:00:00.000Z"):
                    return BodyState("mars", epoch, (149_500_000.0, 643_248.0, 0.0), (0.0, 0.0, 0.0), 42_828.375_816)
                return BodyState("mars", epoch, (-159_185_432.0, 188_245_763.0, 7_650_983.0), (0.0, 0.0, 0.0), 42_828.375_816)
            raise KeyError(body_id)

        def get_all_body_states(self, epoch: str):
            return [self.get_body_state("sun", epoch)]

    ephemeris = RecordingEphemeris()
    service = MissionService(ephemeris=ephemeris)

    result = service.propagate(sample_mission_request)

    assert "2026-01-01T06:00:00.000Z" in ephemeris.target_epochs
    assert result.closest_approach["epochSeconds"] == 21600.0


def test_mission_service_queries_time_varying_all_body_states_during_propagation(sample_mission_request) -> None:
    class RecordingEphemeris:
        def __init__(self) -> None:
            self.dynamic_epochs: list[str] = []

        def get_body_state(self, body_id: str, epoch: str):
            from app.core.ephemeris.base import BodyState

            if body_id == "mars":
                return BodyState("mars", epoch, (227_900_000.0, 0.0, 0.0), (0.0, 0.0, 0.0), 42_828.375_816)
            if body_id == "sun":
                return BodyState("sun", epoch, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0), 132_712_440_018.0)
            raise KeyError(body_id)

        def get_all_body_states(self, epoch: str):
            from app.core.ephemeris.base import BodyState

            self.dynamic_epochs.append(epoch)
            return [
                BodyState("sun", epoch, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0), 132_712_440_018.0),
                BodyState("earth", epoch, (149_597_870.7, 10_000.0, 0.0), (0.0, 29.78, 0.0), 398_600.435_436),
                BodyState("mars", epoch, (227_900_000.0, 0.0, 0.0), (0.0, 0.0, 0.0), 42_828.375_816),
            ]

    ephemeris = RecordingEphemeris()
    service = MissionService(ephemeris=ephemeris)

    service.propagate(sample_mission_request)

    assert ephemeris.dynamic_epochs
    assert len(set(ephemeris.dynamic_epochs)) > 1


def test_mission_service_can_plan_a_full_auto_transfer(bundled_ephemeris) -> None:
    from app.schemas.mission import InitialStateInput, MissionRequest

    request = MissionRequest(
        departureBody="earth",
        targetBody="mars",
        launchEpoch="2026-01-01T00:00:00Z",
        initialState=InitialStateInput(launchFromBody={"mode": "autoTransfer"}),
        durationSeconds=None,
        outputStepSeconds=None,
    )

    result = MissionService(ephemeris=bundled_ephemeris).propagate(request)

    assert result.flight_time_seconds > 100 * 24 * 3600
    assert len(result.samples) > 100
    assert result.closest_approach["distanceKm"] < 2_000_000
    assert any(phase["type"] == "targetApproach" for phase in result.mission_timeline["phases"])


def test_mission_service_builds_staged_departure_segments(bundled_ephemeris) -> None:
    from app.schemas.mission import InitialStateInput, MissionRequest

    request = MissionRequest(
        departureBody="earth",
        targetBody="mars",
        launchEpoch="2026-01-01T00:00:00Z",
        initialState=InitialStateInput(launchFromBody={"mode": "autoTransfer"}),
    )

    result = MissionService(ephemeris=bundled_ephemeris).propagate(request)

    assert result.segments is not None
    assert [segment["segmentType"] for segment in result.segments][:2] == [
        "launchParkingOrbit",
        "earthEscape",
    ]
    segment_types = [segment["segmentType"] for segment in result.segments]
    assert "arrivalHyperbolicApproach" in segment_types
    assert "orbitInsertionBurn" in segment_types
    assert "parkingOrbit" in segment_types


def test_phase_a_timeline_includes_parking_orbit_and_earth_escape(bundled_ephemeris) -> None:
    from app.schemas.mission import InitialStateInput, MissionRequest

    request = MissionRequest(
        departureBody="earth",
        targetBody="mars",
        launchEpoch="2026-01-01T00:00:00Z",
        initialState=InitialStateInput(launchFromBody={"mode": "autoTransfer"}),
    )

    result = MissionService(ephemeris=bundled_ephemeris).propagate(request)

    phase_types = [phase["type"] for phase in result.mission_timeline["phases"]]
    assert "launchParkingOrbit" in phase_types
    assert "earthEscape" in phase_types


def test_mission_service_builds_cruise_segment_metadata_for_auto_transfer(bundled_ephemeris) -> None:
    from app.schemas.mission import InitialStateInput, MissionRequest

    request = MissionRequest(
        departureBody="earth",
        targetBody="mars",
        launchEpoch="2026-01-01T00:00:00Z",
        initialState=InitialStateInput(launchFromBody={"mode": "autoTransfer"}),
    )

    result = MissionService(ephemeris=bundled_ephemeris).propagate(request)

    cruise_segment = next(segment for segment in result.segments if segment["segmentType"] == "heliocentricCruise")
    arrival_approach_segment = next(segment for segment in result.segments if segment["segmentType"] == "arrivalHyperbolicApproach")
    insertion_burn_segment = next(segment for segment in result.segments if segment["segmentType"] == "orbitInsertionBurn")
    parking_orbit_segment = next(segment for segment in result.segments if segment["segmentType"] == "parkingOrbit")
    assert cruise_segment["metadata"]["targetBody"] == "mars"
    assert "maneuverCount" in cruise_segment["metadata"]
    assert "massSummary" in cruise_segment
    assert arrival_approach_segment["initialState"]["referenceBodyId"] == "mars"
    assert any(event["type"] == "hyperbolicPeriapsis" for event in arrival_approach_segment["events"])
    assert any(event["type"] == "orbitInsertionBurnStart" for event in insertion_burn_segment["events"])
    assert parking_orbit_segment["orbitSummary"]["isBound"] is True
    assert parking_orbit_segment["samples"]


def test_mission_service_keeps_cruise_mass_summary_in_sync_with_propulsion_outputs(bundled_ephemeris) -> None:
    from app.schemas.mission import InitialStateInput, MissionRequest, PropulsionConfig

    request = MissionRequest(
        departureBody="earth",
        targetBody="mars",
        launchEpoch="2026-01-01T00:00:00Z",
        initialState=InitialStateInput(launchFromBody={"mode": "autoTransfer"}),
        propulsionConfig=PropulsionConfig(
            initialMassKg=1800.0,
            propellantMassKg=420.0,
            maxThrustN=0.8,
            ispSeconds=3200.0,
        ),
    )

    result = MissionService(ephemeris=bundled_ephemeris).propagate(request)

    cruise_segment = next(segment for segment in result.segments if segment["segmentType"] == "heliocentricCruise")
    assert cruise_segment["massSummary"]["massAfterKg"] == result.final_mass_kg
    assert cruise_segment["massSummary"]["propellantUsedKg"] == result.total_propellant_used_kg
