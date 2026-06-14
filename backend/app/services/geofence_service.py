import math


def _haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Returns distance in metres between two GPS coordinates."""
    R = 6_371_000  # Earth radius metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_within_geofence(
    student_lat: float,
    student_lng: float,
    college_lat: float,
    college_lng: float,
    radius_meters: int,
) -> bool:
    if student_lat is None or student_lng is None:
        return False
    distance = _haversine_distance(student_lat, student_lng, college_lat, college_lng)
    return distance <= radius_meters
