from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Sequence, Tuple


@dataclass(frozen=True)
class _PhaseBlock:
    type: str
    start: datetime
    end: datetime
    title: str
    description: str
    related_body: Optional[str]
    event_ids: Tuple[str, ...]
    priority: int


def build_mission_timeline(
    *,
    launch_epoch: str,
    flight_time_seconds: float,
    target_body: str,
    samples: Sequence[Dict[str, object]],
    closest_approach: Optional[Dict[str, object]] = None,
    maneuver_events: Optional[Sequence[Dict[str, object]]] = None,
    flyby_events: Optional[Sequence[Dict[str, object]]] = None,
    visit_events: Optional[Sequence[Dict[str, object]]] = None,
    segment_events: Optional[Sequence[Dict[str, object]]] = None,
    departure_body: str = "earth",
) -> Dict[str, object]:
    mission_start = _parse_epoch(launch_epoch)
    mission_end = _infer_mission_end(
        mission_start=mission_start,
        flight_time_seconds=flight_time_seconds,
        samples=samples,
        closest_approach=closest_approach,
    )
    if mission_end <= mission_start:
        mission_end = mission_start + timedelta(hours=1)

    events: List[Dict[str, object]] = []
    blocks: List[_PhaseBlock] = []

    def add_event(
        event_type: str,
        epoch: datetime,
        title: str,
        description: str,
        related_body: Optional[str] = None,
    ) -> str:
        event_id = f"event-{len(events) + 1:03d}"
        events.append(
            {
                "id": event_id,
                "type": event_type,
                "epoch": _format_epoch(epoch),
                "title": title,
                "description": description,
                "relatedBody": related_body,
            }
        )
        return event_id

    def add_segment_event(event: Dict[str, object]) -> str:
        event_epoch = _segment_event_epoch(event)
        if event_epoch is None:
            raise ValueError(f"Segment event '{event.get('type', 'unknown')}' is missing an epoch")
        return add_event(
            str(event["type"]),
            event_epoch,
            str(event.get("title", event["type"])),
            str(event.get("description", event["type"])),
            str(event["relatedBody"]) if event.get("relatedBody") is not None else None,
        )

    launch_id = add_event(
        "launch",
        mission_start,
        "Launch",
        f"Depart {departure_body.title()} and begin the mission.",
        departure_body,
    )

    launch_end = min(mission_end, mission_start + timedelta(hours=6))
    if launch_end > mission_start:
        blocks.append(
            _PhaseBlock(
                type="launch",
                start=mission_start,
                end=launch_end,
                title="Launch",
                description=f"Initial departure from {departure_body.title()}.",
                related_body=departure_body,
                event_ids=(launch_id,),
                priority=40,
            )
        )

    segment_event_map = {
        str(event["type"]): event
        for event in (segment_events or [])
        if _segment_event_epoch(event) is not None
    }
    segment_event_ids = {
        event_type: add_segment_event(event) for event_type, event in segment_event_map.items()
    }

    if "launchParkingOrbitEnd" in segment_event_map:
        parking_end = _parse_epoch(str(segment_event_map["launchParkingOrbitEnd"]["epoch"]))
        if parking_end > mission_start:
            blocks.append(
                _PhaseBlock(
                    type="launchParkingOrbit",
                    start=mission_start,
                    end=parking_end,
                    title="Parking Orbit",
                    description="Coast in a bound Earth parking orbit before departure.",
                    related_body="earth",
                    event_ids=(segment_event_ids["launchParkingOrbitEnd"],),
                    priority=45,
                )
            )

    if departure_body == "earth":
        if "earthSoiExit" in segment_event_map:
            earth_escape_end = _parse_epoch(str(segment_event_map["earthSoiExit"]["epoch"]))
            earth_escape_start = mission_start
            if "launchParkingOrbitEnd" in segment_event_map:
                earth_escape_start = _parse_epoch(str(segment_event_map["launchParkingOrbitEnd"]["epoch"]))
            if earth_escape_end > earth_escape_start:
                blocks.append(
                    _PhaseBlock(
                        type="earthEscape",
                        start=earth_escape_start,
                        end=earth_escape_end,
                        title="Earth Escape",
                        description="Transition through Earth escape into heliocentric cruise.",
                        related_body="earth",
                        event_ids=(segment_event_ids["earthSoiExit"],),
                        priority=35,
                    )
                )
        else:
            earth_escape_end = min(mission_end, mission_start + min(timedelta(days=3), max(timedelta(hours=18), (mission_end - mission_start) * 0.05)))
            if earth_escape_end > launch_end:
                earth_escape_id = add_event(
                    "earthEscape",
                    earth_escape_end,
                    "Earth Escape",
                    "Exit the Earth departure regime and enter deep-space flight.",
                    "earth",
                )
                blocks.append(
                    _PhaseBlock(
                        type="earthEscape",
                        start=launch_end,
                        end=earth_escape_end,
                        title="Earth Escape",
                        description="Transition through Earth escape into heliocentric cruise.",
                        related_body="earth",
                        event_ids=(earth_escape_id,),
                        priority=35,
                    )
                )

    for maneuver_event in maneuver_events or []:
        start = _parse_epoch(str(maneuver_event["startEpoch"]))
        duration_seconds = max(float(maneuver_event.get("durationSeconds", 0.0)), 1.0)
        end = start + timedelta(seconds=duration_seconds)
        title = str(maneuver_event.get("type", "Maneuver"))
        event_id = add_event(
            "maneuver",
            start,
            title,
            f"{title} burn in progress.",
            None,
        )
        blocks.append(
            _PhaseBlock(
                type="maneuverExecution",
                start=start,
                end=end,
                title=title,
                description=f"{title} burn in progress.",
                related_body=None,
                event_ids=(event_id,),
                priority=90,
            )
        )

    for flyby_event in flyby_events or []:
        epoch = _parse_epoch(str(flyby_event["epoch"]))
        body_id = str(flyby_event["bodyId"])
        title = f"{body_id.title()} Flyby"
        event_id = add_event(
            "flyby",
            epoch,
            title,
            f"Execute gravity-assist flyby near {body_id.title()}.",
            body_id,
        )
        blocks.append(
            _PhaseBlock(
                type="gravityAssistFlyby",
                start=epoch - timedelta(hours=12),
                end=epoch + timedelta(hours=12),
                title=title,
                description=f"Execute gravity-assist flyby near {body_id.title()}.",
                related_body=body_id,
                event_ids=(event_id,),
                priority=85,
            )
        )

    if {
        "sphereOfInfluenceEntry",
        "hyperbolicPeriapsis",
        "sphereOfInfluenceExit",
    }.issubset(segment_event_map.keys()):
        soi_entry_event = segment_event_map["sphereOfInfluenceEntry"]
        periapsis_event = segment_event_map["hyperbolicPeriapsis"]
        soi_exit_event = segment_event_map["sphereOfInfluenceExit"]
        body_id = str(
            soi_entry_event.get("relatedBody")
            or periapsis_event.get("relatedBody")
            or soi_exit_event.get("relatedBody")
            or target_body
        )
        soi_entry = _parse_epoch(str(soi_entry_event["epoch"]))
        soi_exit = _parse_epoch(str(soi_exit_event["epoch"]))
        if soi_exit > soi_entry:
            blocks.append(
                _PhaseBlock(
                    type="flybyEncounter",
                    start=soi_entry,
                    end=soi_exit,
                    title=f"{body_id.title()} Flyby Encounter",
                    description=f"Traverse the primary encounter corridor around {body_id.title()}.",
                    related_body=body_id,
                    event_ids=(
                        segment_event_ids["sphereOfInfluenceEntry"],
                        segment_event_ids["hyperbolicPeriapsis"],
                        segment_event_ids["sphereOfInfluenceExit"],
                    ),
                    priority=88,
                )
            )

    encounters = list(visit_events or [])
    if not encounters and closest_approach is not None:
        encounters = [
            {
                "bodyId": closest_approach["bodyId"],
                "epoch": closest_approach["epoch"],
            }
        ]

    for encounter in encounters:
        encounter_epoch = _parse_epoch(str(encounter["epoch"]))
        body_id = str(encounter["bodyId"])
        approach_start = max(mission_start, encounter_epoch - timedelta(days=4))
        arrival_start = max(approach_start, encounter_epoch - timedelta(hours=6))
        arrival_end = min(mission_end, encounter_epoch + timedelta(hours=6))
        science_end = min(mission_end, arrival_end + timedelta(days=2))
        downlink_end = min(mission_end, science_end + timedelta(days=1))

        approach_id = add_event(
            "targetApproach",
            approach_start,
            f"{body_id.title()} Approach",
            f"Begin the final approach toward {body_id.title()}.",
            body_id,
        )
        arrival_id = add_event(
            "arrivalPass",
            encounter_epoch,
            f"{body_id.title()} Encounter",
            f"Reach closest approach to {body_id.title()}.",
            body_id,
        )
        science_id = add_event(
            "scienceWindowStart",
            arrival_end,
            f"{body_id.title()} Science Window",
            f"Science operations begin near {body_id.title()}.",
            body_id,
        )
        downlink_id = add_event(
            "downlinkWindowStart",
            science_end,
            f"{body_id.title()} Downlink",
            "Begin downlink after science operations.",
            body_id,
        )

        if approach_start < arrival_start:
            blocks.append(
                _PhaseBlock(
                    type="targetApproach",
                    start=approach_start,
                    end=arrival_start,
                    title=f"{body_id.title()} Approach",
                    description=f"Approach the {body_id.title()} encounter corridor.",
                    related_body=body_id,
                    event_ids=(approach_id,),
                    priority=50,
                )
            )
        if arrival_start < arrival_end:
            blocks.append(
                _PhaseBlock(
                    type="arrivalPass",
                    start=arrival_start,
                    end=arrival_end,
                    title=f"{body_id.title()} Encounter",
                    description=f"Execute the primary pass by {body_id.title()}.",
                    related_body=body_id,
                    event_ids=(arrival_id,),
                    priority=80,
                )
            )
        if arrival_end < science_end:
            blocks.append(
                _PhaseBlock(
                    type="scienceOperations",
                    start=arrival_end,
                    end=science_end,
                    title=f"{body_id.title()} Science",
                    description=f"Collect science observations around {body_id.title()}.",
                    related_body=body_id,
                    event_ids=(science_id,),
                    priority=45,
                )
            )
        if science_end < downlink_end:
            blocks.append(
                _PhaseBlock(
                    type="downlink",
                    start=science_end,
                    end=downlink_end,
                    title=f"{body_id.title()} Downlink",
                    description="Return science data to Earth after the encounter.",
                    related_body=body_id,
                    event_ids=(downlink_id,),
                    priority=30,
                )
            )

    add_event(
        "missionComplete",
        mission_end,
        "Mission Complete",
        "Reach the end of the currently planned mission timeline.",
        target_body,
    )

    phases = _build_non_overlapping_phases(
        mission_start=mission_start,
        mission_end=mission_end,
        blocks=blocks,
        fallback_body=target_body,
    )

    return {
        "events": sorted(events, key=lambda event: event["epoch"]),
        "phases": [
            {
                "id": f"phase-{index + 1:03d}",
                "type": phase["type"],
                "startEpoch": _format_epoch(phase["start"]),
                "endEpoch": _format_epoch(phase["end"]),
                "title": phase["title"],
                "description": phase["description"],
                "relatedBody": phase["relatedBody"],
                "eventIds": phase["eventIds"],
            }
            for index, phase in enumerate(phases)
        ],
        "currentObjective": f"Arrive at {target_body.title()}",
        "missionStartEpoch": _format_epoch(mission_start),
        "missionEndEpoch": _format_epoch(mission_end),
    }


def _build_non_overlapping_phases(
    *,
    mission_start: datetime,
    mission_end: datetime,
    blocks: Sequence[_PhaseBlock],
    fallback_body: str,
) -> List[Dict[str, object]]:
    normalized = []
    for block in blocks:
        start = max(mission_start, block.start)
        end = min(mission_end, block.end)
        if end <= start:
            continue
        normalized.append(
            _PhaseBlock(
                type=block.type,
                start=start,
                end=end,
                title=block.title,
                description=block.description,
                related_body=block.related_body,
                event_ids=block.event_ids,
                priority=block.priority,
            )
        )

    boundaries = sorted(
        {mission_start, mission_end, *(block.start for block in normalized), *(block.end for block in normalized)}
    )
    phases: List[Dict[str, object]] = []
    for left, right in zip(boundaries[:-1], boundaries[1:]):
        if right <= left:
            continue
        active = [block for block in normalized if block.start < right and block.end > left]
        if active:
            selected = max(active, key=lambda block: (block.priority, block.start))
            phase = {
                "type": selected.type,
                "start": left,
                "end": right,
                "title": selected.title,
                "description": selected.description,
                "relatedBody": selected.related_body,
                "eventIds": list(selected.event_ids),
            }
        else:
            phase = {
                "type": "deepSpaceCruise",
                "start": left,
                "end": right,
                "title": "Deep-Space Cruise",
                "description": "Cruise between major mission events.",
                "relatedBody": fallback_body,
                "eventIds": [],
            }
        if phases and _can_merge(phases[-1], phase):
            phases[-1]["end"] = phase["end"]
            phases[-1]["eventIds"] = list(dict.fromkeys([*phases[-1]["eventIds"], *phase["eventIds"]]))
        else:
            phases.append(phase)
    return phases


def _can_merge(left: Dict[str, object], right: Dict[str, object]) -> bool:
    return (
        left["type"] == right["type"]
        and left["title"] == right["title"]
        and left["description"] == right["description"]
        and left["relatedBody"] == right["relatedBody"]
        and left["end"] == right["start"]
    )


def _segment_event_epoch(event: Dict[str, object]) -> Optional[datetime]:
    raw_epoch = event.get("epoch") or event.get("startEpoch")
    if raw_epoch is None:
        return None
    return _parse_epoch(str(raw_epoch))


def _infer_mission_end(
    *,
    mission_start: datetime,
    flight_time_seconds: float,
    samples: Sequence[Dict[str, object]],
    closest_approach: Optional[Dict[str, object]],
) -> datetime:
    if samples:
        return mission_start + timedelta(seconds=float(samples[-1]["epochSeconds"]))
    if closest_approach is not None and "epoch" in closest_approach:
        return _parse_epoch(str(closest_approach["epoch"]))
    if closest_approach is not None and "epochSeconds" in closest_approach:
        return mission_start + timedelta(seconds=float(closest_approach["epochSeconds"]))
    return mission_start + timedelta(seconds=max(flight_time_seconds, 0.0))


def _parse_epoch(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _format_epoch(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
