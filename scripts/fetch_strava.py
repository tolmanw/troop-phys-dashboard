import os
import json
import requests
from datetime import datetime, timedelta, timezone

# --- Environment variables ---
CLIENT_ID = os.environ['STRAVA_CLIENT_ID']
CLIENT_SECRET = os.environ['STRAVA_CLIENT_SECRET']
REFRESH_TOKENS_JSON = os.environ['STRAVA_REFRESH_TOKENS']
ALIASES_JSON = os.environ.get("ATHLETE_ALIASES", "{}")

refresh_tokens = json.loads(REFRESH_TOKENS_JSON)
USERNAME_ALIASES = json.loads(ALIASES_JSON)
USERNAME_ALIASES_NORMALIZED = {k.strip().lower(): v for k, v in USERNAME_ALIASES.items()}

# --- Activity types ---
activity_types = [
    "Run", "Trail Run", "Walk", "Hike", "Virtual Run",
    "Ride", "Mountain Bike Ride", "Gravel Ride", "E-Bike Ride", "E-Mountain Bike Ride",
    "Velomobile", "Virtual Ride",
    "Canoe", "Kayak", "Kitesurf", "Rowing", "Stand Up Paddling", "Surf", "Windsurf", "Sail",
    "Ice Skate", "Alpine Ski", "Backcountry Ski", "Nordic Ski", "Snowboard", "Snowshoe",
    "Handcycle", "Inline Skate", "Rock Climb", "Roller Ski", "Golf", "Skateboard", "Football (Soccer)",
    "Wheelchair", "Badminton", "Tennis", "Pickleball", "Crossfit", "Elliptical", "Stair Stepper",
    "Weight Training", "Yoga", "Workout", "HIIT", "Pilates", "Table Tennis", "Squash", "Racquetball",
    "Virtual Rowing"
]

# --- Functions ---
def refresh_access_token(refresh_token):
    response = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
    )
    data = response.json()
    if "access_token" not in data:
        print("Error refreshing token:", data)
        return None
    return data["access_token"]

def get_last_three_month_starts():
    now = datetime.now(timezone.utc)
    month_starts = []
    for i in range(2, -1, -1):
        month = now.month - i
        year = now.year
        if month <= 0:
            month += 12
            year -= 1
        month_starts.append(datetime(year, month, 1, tzinfo=timezone.utc))
    timestamps = [int(d.timestamp()) for d in month_starts]
    return timestamps, month_starts

def fetch_activities(access_token, after_ts):
    url = "https://www.strava.com/api/v3/athlete/activities"
    activities = []
    page = 1
    while True:
        params = {"after": after_ts, "per_page": 200, "page": page}
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(url, headers=headers, params=params)
        if response.status_code != 200:
            print(f"Error fetching activities (page {page}):", response.status_code, response.text)
            break
        page_activities = response.json()
        if not page_activities:
            break
        activities.extend(page_activities)
        page += 1
    return activities if isinstance(activities, list) else []

def days_in_month(dt):
    next_month = dt.replace(day=28) + timedelta(days=4)
    return (next_month - timedelta(days=next_month.day)).day

def uk_now():
    now_utc = datetime.now(timezone.utc)
    year = now_utc.year
    dst_start = datetime(year, 3, 31, 1, 0, tzinfo=timezone.utc)
    while dst_start.weekday() != 6:
        dst_start -= timedelta(days=1)
    dst_end = datetime(year, 10, 31, 1, 0, tzinfo=timezone.utc)
    while dst_end.weekday() != 6:
        dst_end -= timedelta(days=1)
    offset = timedelta(hours=1) if dst_start <= now_utc < dst_end else timedelta(hours=0)
    return now_utc + offset

# --- Determine last three months for athletes.json ---
prev_ts, month_starts = get_last_three_month_starts()
month_names = [m.strftime("%B %Y") for m in month_starts]

athletes_out = {}
found_athletes = []
skipped_athletes = []

# --- Current month setup for per-activity JSONs ---
now_uk = uk_now()
CURRENT_YEAR = now_uk.year
CURRENT_MONTH = now_uk.month

# 🔧 FIX: derive month start from uk_now(), then convert to UTC
current_month_start = now_uk.replace(
    day=1,
    hour=0,
    minute=0,
    second=0,
    microsecond=0
).astimezone(timezone.utc)

after_current_month_ts = int(current_month_start.timestamp())
days_in_current_month = days_in_month(current_month_start)
MONTH_ABBR = now_uk.strftime("%b")  # e.g., "Jan", "Feb"

DISTANCE_TYPES = ["Run", "Ride", "Swim"]
TIME_TYPES = ["Workout"]
ALL_TYPES = DISTANCE_TYPES + TIME_TYPES

# Prepare current month per-activity data
challenge_month_data = {act_type: {} for act_type in ALL_TYPES}

# --- Main loop over athletes ---
for username, info in refresh_tokens.items():
    print(f"Processing athlete '{username}'")
    access_token = refresh_access_token(info["refresh_token"])
    if not access_token:
        skipped_athletes.append(username)
        continue

    # --- Fetch activities for athletes.json (current + last two months) ---
    after_ts_current = int(month_starts[0].timestamp())
    activities = fetch_activities(access_token, after_ts_current)
    activities = [a for a in activities if a.get("type") in activity_types]

    alias = USERNAME_ALIASES_NORMALIZED.get(username.lower())
    if not alias:
        print(f"Skipping '{username}': no alias defined")
        skipped_athletes.append(username)
        continue

    # --- athletes.json aggregation (unchanged) ---
    monthly_distance = [0.0] * 3
    monthly_time_min = [0.0] * 3
    daily_distance = [[0.0] * days_in_month(m) for m in month_starts]
    daily_time_min = [[0.0] * days_in_month(m) for m in month_starts]

    processed_activities = set()
    for act in activities:
        act_id = act.get("id")
        if act_id in processed_activities:
            continue
        processed_activities.add(act_id)

        dt = datetime.strptime(act["start_date_local"], "%Y-%m-%dT%H:%M:%S%z")
        dist_km = act.get("distance", 0) / 1000
        time_min = act.get("moving_time", 0) / 60

        for idx, start in enumerate(month_starts):
            if dt.year == start.year and dt.month == start.month:
                day_idx = dt.day - 1
                monthly_distance[idx] += dist_km
                monthly_time_min[idx] += time_min
                daily_distance[idx][day_idx] += dist_km
                daily_time_min[idx][day_idx] += time_min

    # --- Fetch athlete profile ---
    athlete_url = "https://www.strava.com/api/v3/athlete"
    headers = {"Authorization": f"Bearer {access_token}"}
    profile_data = requests.get(athlete_url, headers=headers).json()
    profile_img = profile_data.get("profile", "")

    athletes_out[alias] = {
        "display_name": alias,
        "profile": profile_img,
        "monthly_distances": [round(d, 2) for d in monthly_distance],
        "monthly_time": [round(t, 2) for t in monthly_time_min],
        "daily_distance_km": [[round(d, 2) for d in month] for month in daily_distance],
        "daily_time_min": [[round(t, 2) for t in month] for t in daily_time_min]
    }
    found_athletes.append(alias)

    # --- Fetch activities for current month per-activity JSONs ---
    current_month_activities = fetch_activities(access_token, after_current_month_ts)

    for act_type in ALL_TYPES:
        daily_array = [0.0] * days_in_current_month
        for act in current_month_activities:
            if act.get("type") != act_type:
                continue
            dt = datetime.strptime(act["start_date_local"], "%Y-%m-%dT%H:%M:%S%z")
            if dt.year != CURRENT_YEAR or dt.month != CURRENT_MONTH:
                continue
            idx = dt.day - 1
            if act_type in DISTANCE_TYPES:
                daily_array[idx] += act.get("distance", 0) / 1000
            else:
                daily_array[idx] += act.get("moving_time", 0) / 60

        monthly_total = sum(daily_array)
        monthly_field = "monthly_distances" if act_type in DISTANCE_TYPES else "monthly_time"
        daily_field = "daily_distance_km" if act_type in DISTANCE_TYPES else "daily_time_min"

        challenge_month_data[act_type][alias] = {
            "display_name": alias,
            "profile": profile_img,
            monthly_field: round(monthly_total, 2) if act_type in DISTANCE_TYPES else int(monthly_total),
            daily_field: [[round(v, 2) if act_type in DISTANCE_TYPES else int(v) for v in daily_array]]
        }

# --- Save athletes.json (unchanged) ---
os.makedirs("data", exist_ok=True)
with open("data/athletes.json", "w") as f:
    json.dump({
        "athletes": athletes_out,
        "month_names": month_names,
        "last_synced": now_uk.strftime("%d-%m-%Y %H:%M")
    }, f, indent=2)

print("athletes.json updated successfully.")

# --- Save current month per-activity JSONs ---
for act_type, data in challenge_month_data.items():
    filename = f"data/{MONTH_ABBR}_Challenge_{act_type}.json"
    with open(filename, "w") as f:
        json.dump({
            "athletes": data,
            "month_names": [f"{MONTH_ABBR} {CURRENT_YEAR}"],
            "last_synced": now_uk.strftime("%d-%m-%Y %H:%M")
        }, f, indent=2)

    print(f"{filename} updated successfully.")

print(f"Found athletes: {found_athletes}")
print(f"Skipped athletes: {skipped_athletes}")
