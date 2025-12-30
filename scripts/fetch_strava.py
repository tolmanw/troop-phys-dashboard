import os
import json
import requests
from datetime import datetime, timedelta, timezone
import pytz  # needed for UK timezone

# --- Environment variables ---
CLIENT_ID = os.environ['STRAVA_CLIENT_ID']
CLIENT_SECRET = os.environ['STRAVA_CLIENT_SECRET']
REFRESH_TOKENS_JSON = os.environ['STRAVA_REFRESH_TOKENS']
ALIASES_JSON = os.environ.get("ATHLETE_ALIASES", "{}")

refresh_tokens = json.loads(REFRESH_TOKENS_JSON)
USERNAME_ALIASES = json.loads(ALIASES_JSON)
USERNAME_ALIASES_NORMALIZED = {k.strip().lower(): v for k, v in USERNAME_ALIASES.items()}

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
    params = {"after": after_ts, "per_page": 200}
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        print("Error fetching activities:", response.status_code, response.text)
        return []
    activities = response.json()
    return activities if isinstance(activities, list) else []

def days_in_month(dt):
    next_month = dt.replace(day=28) + timedelta(days=4)
    return (next_month - timedelta(days=next_month.day)).day

# --- Determine last three months ---
prev_ts, month_starts = get_last_three_month_starts()
month_names = [m.strftime("%B %Y") for m in month_starts]

athletes_out = {}
found_athletes = []
skipped_athletes = []

# --- Main loop ---
for username, info in refresh_tokens.items():
    print(f"Processing athlete '{username}'")

    access_token = refresh_access_token(info["refresh_token"])
    if not access_token:
        skipped_athletes.append(username)
        continue

    after_ts = int(month_starts[0].timestamp())
    activities = fetch_activities(access_token, after_ts)
    activities = [a for a in activities if a.get("type") in activity_types]

    alias = USERNAME_ALIASES_NORMALIZED.get(username.lower())
    if not alias:
        print(f"Skipping '{username}': no alias defined")
        skipped_athletes.append(username)
        continue

    # --- Fresh authoritative arrays ---
    monthly_distance = [0.0] * 3
    monthly_time_min = [0.0] * 3

    daily_distance = [
        [0.0] * days_in_month(m) for m in month_starts
    ]
    daily_time_min = [
        [0.0] * days_in_month(m) for m in month_starts
    ]

    processed_activities = set()

    for act in activities:
        act_id = act.get("id")
        if act_id in processed_activities:
            continue
        processed_activities.add(act_id)

        dt = datetime.strptime(act["start_date_local"], "%Y-%m-%dT%H:%M:%S%z")
        dist_km = act.get("distance", 0) / 1000
        time_min = act.get("moving_time", 0) / 60

        print(
            f"[DEBUG] {alias} | {dt.strftime('%Y-%m-%d')} | "
            f"{act.get('name')} | {act.get('type')} | "
            f"{dist_km:.2f} km | {time_min:.1f} min"
        )

        for idx, start in enumerate(month_starts):
            if dt.year == start.year and dt.month == start.month:
                day_idx = dt.day - 1
                monthly_distance[idx] += dist_km
                monthly_time_min[idx] += time_min
                daily_distance[idx][day_idx] += dist_km
                daily_time_min[idx][day_idx] += time_min

    # --- Fetch profile ---
    athlete_url = "https://www.strava.com/api/v3/athlete"
    headers = {"Authorization": f"Bearer {access_token}"}
    profile_data = requests.get(athlete_url, headers=headers).json()
    profile_img = profile_data.get("profile", "")

    athletes_out[alias] = {
        "display_name": alias,
        "profile": profile_img,
        "monthly_distances": [round(d, 2) for d in monthly_distance],
        "monthly_time": [round(t) for t in monthly_time_min],
        "daily_distance_km": [[round(d, 2) for d in month] for month in daily_distance],
        "daily_time_min": [[round(t, 2) for t in month] for month in daily_time_min]
    }

    found_athletes.append(alias)

# --- Save JSON in UK timezone ---
uk_tz = pytz.timezone("Europe/London")
last_synced_uk = datetime.now(uk_tz).strftime("%d-%m-%Y %H:%M")

os.makedirs("data", exist_ok=True)
with open("data/athletes.json", "w") as f:
    json.dump(
        {
            "athletes": athletes_out,
            "month_names": month_names,
            "last_synced": last_synced_uk
        },
        f,
        indent=2
    )

print("athletes.json updated successfully.")
print(f"Found athletes: {found_athletes}")
print(f"Skipped athletes: {skipped_athletes}")
