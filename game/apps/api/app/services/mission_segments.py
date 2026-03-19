from typing import Dict, List, Sequence


def segment_to_dict(segment) -> Dict[str, object]:
    payload = {
        "segmentType": segment.segment_type,
        "startEpoch": segment.start_epoch,
        "endEpoch": segment.end_epoch,
        "samples": segment.samples,
        "events": segment.events,
    }
    if getattr(segment, "initial_state", None) is not None:
        payload["initialState"] = segment.initial_state
        payload["referenceFrame"] = segment.initial_state.get("referenceFrame", "unknown")
    if getattr(segment, "final_state", None) is not None:
        payload["finalState"] = segment.final_state
        payload["referenceFrame"] = segment.final_state.get("referenceFrame", payload.get("referenceFrame", "unknown"))
    if getattr(segment, "orbit_summary", None) is not None:
        payload["orbitSummary"] = segment.orbit_summary
    if getattr(segment, "warnings", None) is not None:
        payload["warnings"] = list(segment.warnings)
    if getattr(segment, "metadata", None) is not None:
        payload["metadata"] = dict(segment.metadata)
    if getattr(segment, "mass_summary", None) is not None:
        payload["massSummary"] = dict(segment.mass_summary)
    return payload


def merge_segment_samples(segments: Sequence[Dict[str, object]]) -> List[Dict[str, object]]:
    merged: List[Dict[str, object]] = []
    epoch_offset = 0.0
    for segment in segments:
        samples = segment.get("samples", [])
        if not samples:
            continue
        for index, sample in enumerate(samples):
            if merged and index == 0 and float(sample.get("epochSeconds", 0.0)) == 0.0:
                continue
            merged_sample = dict(sample)
            merged_sample["epochSeconds"] = epoch_offset + float(sample.get("epochSeconds", 0.0))
            merged.append(merged_sample)
        epoch_offset = merged[-1]["epochSeconds"] if merged else epoch_offset
    return merged


def merge_segment_events(segments: Sequence[Dict[str, object]]) -> List[Dict[str, object]]:
    merged: List[Dict[str, object]] = []
    for segment in segments:
        for event in segment.get("events", []):
            merged.append(dict(event))
    return merged


def build_segment_boundary_state(
    *,
    epoch: str,
    reference_frame: str,
    position_km,
    velocity_km_per_s,
    reference_body_id: str = None,
) -> Dict[str, object]:
    payload = {
        "epoch": epoch,
        "referenceFrame": reference_frame,
        "positionKm": tuple(float(component) for component in position_km),
        "velocityKmPerSec": tuple(float(component) for component in velocity_km_per_s),
    }
    if reference_body_id is not None:
        payload["referenceBodyId"] = reference_body_id
    return payload
