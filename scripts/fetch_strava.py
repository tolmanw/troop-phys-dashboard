import os
import json
import requests
from datetime import datetime, timedelta, timezone
from calendar import monthrange

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

DISTANCE_TYPES = ["Run", "Ride", "Swim"]
TIME_TYPES = ["Workout"]
ALL_TYPES = DISTANCE_TYPES + TIME_TYPES

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

def days_in_month(dt):
    return monthrange(dt.year, dt.month)[1]

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

# --- Challenge months setup ---
def get_challenge_months(start_year, start_month, count):
    months = []
    year, month = start_year, start_month
    for _ in range(count):
        months.append((year, month))
        month += 1
        if month > 12:
            month = 1
            year += 1
    return months

TARGET_MONTHS = get_challenge_months(2026, 1, 3)  # Jan, Feb, Mar 2026

# --- Prepare athletes.json structures ---
athletes_out = {}
found_athletes = []
skipped_athletes = []

for username, info in refresh_tokens.items():
    print(f"Processing athlete '{username}'")
    access_token = refresh_access_token(info["refresh_token"])
    if not access_token:
        skipped_athletes.append(username)
        continue

    alias = USERNAME_ALIASES_NORMALIZED.get(username.lower())
    if not alias:
        print(f"Skipping '{username}': no alias defined")
        skipped_athletes.append(username)
        continue

    # --- Fetch all activities since first target month ---
    earliest_year, earliest_month = TARGET_MONTHS[0]
    after_ts = int(datetime(earliest_year, earliest_month, 1, tzinfo=timezone.utc).timestamp())
    all_activities = fetch_activities(access_token, after_ts)
    all_activities = [a for a in all_activities if a.get("type") in activity_types]

    # --- Athlete profile ---
    athlete_url = "https://www.strava.com/api/v3/athlete"
    headers = {"Authorization": f"Bearer {access_token}"}
    profile_data = requests.get(athlete_url, headers=headers).json()
    profile_img = profile_data.get("profile", "")

    # --- Build athletes.json cumulative data ---
    monthly_distances = []
    monthly_time = []
    daily_distance = []
    daily_time_min = []

    for year, month in TARGET_MONTHS:
        days = monthrange(year, month)[1]
        monthly_distances.append(0.0)
        monthly_time.append(0.0)
        daily_distance.append([0.0] * days)
        daily_time_min.append([0.0] * days)

    # Aggregate actual activities
    processed_activities = set()
    for act in all_activities:
        act_id = act.get("id")
        if act_id in processed_activities:
            continue
        processed_activities.add(act_id)

        dt = datetime.strptime(act["start_date_local"], "%Y-%m-%dT%H:%M:%S%z")
        dist_km = act.get("distance", 0) / 1000
        time_min = act.get("moving_time", 0) / 60

        for idx, (year_m, month_m) in enumerate(TARGET_MONTHS):
            if dt.year == year_m and dt.month == month_m:
                day_idx = dt.day - 1
                monthly_distances[idx] += dist_km
                monthly_time[idx] += time_min
                daily_distance[idx][day_idx] += dist_km
                daily_time_min[idx][day_idx] += time_min

    athletes_out[alias] = {
        "display_name": alias,
        "profile": profile_img,
        "monthly_distances": [round(d, 2) for d in monthly_distances],
        "monthly_time": [round(t) for t in monthly_time],
        "daily_distance_km": [[round(d,2) for d in month] for month in daily_distance],
        "daily_time_min": [[round(t,2) for t in month] for month in daily_time_min]
    }
    found_athletes.append(alias)

# --- Save athletes.json ---
month_names = [datetime(y,m,1).strftime("%B %Y") for y,m in TARGET_MONTHS]
os.makedirs("data", exist_ok=True)
with open("data/athletes.json", "w") as f:
    json.dump({
        "athletes": athletes_out,
        "month_names": month_names,
        "last_synced": uk_now().strftime("%d-%m-%Y %H:%M")
    }, f, indent=2)
print("athletes.json updated successfully.")

# --- Generate per-activity JSONs for each month ---
for year, month in TARGET_MONTHS:
    month_name = datetime(year, month, 1).strftime("%B %Y")
    days = monthrange(year, month)[1]
    month_short = datetime(year, month, 1).strftime("%b")

    for act_type in ALL_TYPES:
        activity_json = {}
        for alias, athlete_info in athletes_out.items():
            # Initialize daily array with zeros
            daily_array = [0.0] * days
            monthly_total = sum(daily_array)

            # Use actual data for January
            if year == 2026 and month == 1:
                if act_type in DISTANCE_TYPES:
                    if alias in athletes_out:
                        daily_array = athletes_out[alias]["daily_distance_km"][0]
                        monthly_total = sum(daily_array)
                else:
                    if alias in athletes_out:
                        daily_array = athletes_out[alias]["daily_time_min"][0]
                        monthly_total = sum(daily_array)

            monthly_field = "monthly_distances" if act_type in DISTANCE_TYPES else "monthly_time"
            daily_field = "daily_distance_km" if act_type in DISTANCE_TYPES else "daily_time_min"

            activity_json[alias] = {
                "display_name": alias,
                "profile": athletes_out[alias]["profile"],
                monthly_field: round(monthly_total,2) if act_type in DISTANCE_TYPES else int(monthly_total),
                daily_field: [daily_array]
            }

        filename = f"data/{month_short}_Challenge_{act_type}.json"
        with open(filename, "w") as f:
            json.dump({
                "athletes": activity_json,
                "month_names": [month_name],
                "last_synced": uk_now().strftime("%d-%m-%Y %H:%M")
            }, f, indent=2)
        print(f"{filename} updated successfully.")

print(f"Found athletes: {found_athletes}")
print(f"Skipped athletes: {skipped_athletes}")
