from pathlib import Path

from fastapi import APIRouter, Response, status

from app.core.ephemeris.factory import create_ephemeris
from app.schemas.mission import LaunchWindowRequest, MissionRequest, MissionTourRequest
from app.services.gravity_assist_search import GravityAssistSearchService
from app.services.launch_window_search import LaunchWindowSearchService
from app.services.mission_service import MissionService
from app.services.tour_planner import MissionTourPlanner

router = APIRouter(prefix="/missions", tags=["missions"])

DATA_PATH = Path(__file__).resolve().parents[2] / "data/ephemeris/major_bodies.json"


@router.post("/validate-initial-state", status_code=status.HTTP_204_NO_CONTENT)
def validate_initial_state(_: MissionRequest) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/propagate")
def propagate_mission(request: MissionRequest) -> dict:
    service = MissionService(ephemeris=create_ephemeris(DATA_PATH))
    return service.propagate(request).to_dict()


@router.post("/search-gravity-assist")
def search_gravity_assist(request: MissionRequest) -> dict:
    search_service = GravityAssistSearchService(ephemeris=create_ephemeris(DATA_PATH))
    candidates = search_service.search(
        departure_body=request.departureBody,
        target_body=request.targetBody,
        launch_epoch=request.launchEpoch,
    )
    return {
        "ephemerisSource": getattr(search_service.ephemeris, "source_name", "unknown"),
        "candidates": [candidate.to_dict() for candidate in candidates],
    }


@router.post("/launch-window")
def launch_window(request: LaunchWindowRequest) -> dict:
    service = LaunchWindowSearchService(ephemeris=create_ephemeris(DATA_PATH))
    if request.missionType == "trajectory":
        return service.search_trajectory_window(
            departure_body=request.departureBody,
            target_body=str(request.targetBody),
            earliest_launch_epoch=request.earliestLaunchEpoch,
        ).to_dict()

    return service.search_tour_window(
        departure_body=request.departureBody,
        required_visit_bodies=tuple(request.requiredVisitBodies or []),
        earliest_launch_epoch=request.earliestLaunchEpoch,
        max_assist_bodies_per_leg=request.maxAssistBodiesPerLeg,
        max_returned_candidates=request.maxReturnedCandidates,
        allow_assist_bodies=request.allowAssistBodies,
        allow_repeated_flybys=request.allowRepeatedFlybys,
        return_to_departure=request.returnToDeparture,
        propulsion_config=request.propulsionConfig,
    ).to_dict()


@router.post("/plan-tour")
def plan_tour(request: MissionTourRequest) -> dict:
    planner = MissionTourPlanner(ephemeris=create_ephemeris(DATA_PATH))
    candidates = planner.plan_tour(
        departure_body=request.departureBody,
        required_visit_bodies=tuple(request.requiredVisitBodies),
        launch_epoch=request.launchEpoch,
        max_assist_bodies_per_leg=request.maxAssistBodiesPerLeg,
        max_returned_candidates=request.maxReturnedCandidates,
        allow_assist_bodies=request.allowAssistBodies,
        allow_repeated_flybys=request.allowRepeatedFlybys,
        return_to_departure=request.returnToDeparture,
        propulsion_config=request.propulsionConfig,
        navigation_config=request.navigationConfig,
    )
    best_candidate = candidates[0] if candidates else None
    return {
        "referenceFrame": "heliocentric-inertial",
        "ephemerisSource": getattr(planner.ephemeris, "source_name", "unknown"),
        "samples": best_candidate.samples if best_candidate else [],
        "closestApproach": best_candidate.closest_approach if best_candidate else None,
        "flightTimeSeconds": best_candidate.total_flight_time_seconds if best_candidate else 0.0,
        "warnings": list(best_candidate.warnings) if best_candidate else [],
        "visitOrder": list(best_candidate.visit_order) if best_candidate else [],
        "fullSequenceBodies": list(best_candidate.full_sequence_bodies) if best_candidate else [],
        "score": best_candidate.score if best_candidate else None,
        "deltaVKmPerS": best_candidate.total_delta_v_km_per_s if best_candidate else None,
        "flybyEvents": list(best_candidate.flyby_events) if best_candidate else [],
        "segments": list(best_candidate.segments) if best_candidate and best_candidate.segments is not None else [],
        "visitEvents": [event.to_dict() for event in best_candidate.visit_events] if best_candidate else [],
        "legs": [leg.to_dict() for leg in best_candidate.legs] if best_candidate else [],
        "maneuverEvents": list(best_candidate.maneuver_events) if best_candidate and best_candidate.maneuver_events is not None else [],
        "finalMassKg": best_candidate.final_mass_kg if best_candidate else None,
        "totalPropellantUsedKg": best_candidate.total_propellant_used_kg if best_candidate else None,
        "propulsionConfig": best_candidate.propulsion_config if best_candidate else None,
        "navigationTelemetry": best_candidate.navigation_telemetry if best_candidate else None,
        "missionTimeline": best_candidate.mission_timeline if best_candidate else None,
        "candidates": [candidate.to_dict() for candidate in candidates],
    }
