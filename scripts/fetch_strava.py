import os
import json
import requests
from datetime import datetime, timedelta, timezone
from collections import defaultdict

# --- Environment variables ---
CLIENT_ID = os.environ['STRAVA_CLIENT_ID']
CLIENT_SECRET = os.environ['STRAVA_CLIENT_SECRET']
REFRESH_TOKENS_JSON = os.environ['STRAVA_REFRESH_TOKENS']
ALIASES_JSON = os.environ.get("ATHLETE_ALIASES", "{}")

refresh_tokens = json.loads(REFRESH_TOKENS_JSON)
USERNAME_ALIASES = json.loads(ALIASES_JSON)
USERNAME_ALIASES_NORMALIZED = {k.strip().lower(): v for k, v in USERNAME_ALIASES.items()}

# --- Activity types ---
DISTANCE_TYPES = ["Run", "Ride", "Swim"]
TIME_TYPES = ["Workout"]
ALL_TYPES = DISTANCE_TYPES + TIME_TYPES

# --- Helpers ---
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

def get_month_start(year, month):
    return datetime(year, month, 1, tzinfo=timezone.utc)

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

# --- Determine current month ---
now = uk_now()
CHALLENGE_YEAR = now.year
CHALLENGE_MONTH = now.month
CHALLENGE_MONTH_NAME = now.strftime("%b")
days_in_month = (get_month_start(CHALLENGE_YEAR, CHALLENGE_MONTH+1) - timedelta(days=1)).day if CHALLENGE_MONTH < 12 else 31
after_ts_month = int(get_month_start(CHALLENGE_YEAR, CHALLENGE_MONTH).timestamp())

# --- Prepare output directories ---
os.makedirs("data", exist_ok=True)

athletes_out = {}
challenge_month_data = {act_type: {} for act_type in ALL_TYPES}
found_athletes = []
skipped_athletes = []

# --- Main Loop over athletes ---
for username, info in refresh_tokens.items():
    access_token = refresh_access_token(info["refresh_token"])
    if not access_token:
        skipped_athletes.append(username)
        continue

    alias = USERNAME_ALIASES_NORMALIZED.get(username.lower())
    if not alias:
        skipped_athletes.append(username)
        continue

    # Fetch all current month activities
    activities = fetch_activities(access_token, after_ts_month)
    activities = [a for a in activities if a.get("type") in ALL_TYPES]

    # --- athletes.json aggregation (unchanged) ---
    monthly_distance = [0.0] * 3
    monthly_time_min = [0.0] * 3
    daily_distance = [[0.0] * 31 for _ in range(3)]
    daily_time_min = [[0.0] * 31 for _ in range(3)]

    processed_ids = set()
    for act in activities:
        act_id = act.get("id")
        if act_id in processed_ids:
            continue
        processed_ids.add(act_id)

        dt = datetime.strptime(act["start_date_local"], "%Y-%m-%dT%H:%M:%S%z")
        dist_km = act.get("distance", 0)/1000
        time_min = act.get("moving_time", 0)/60

        # For simplicity, ignore previous 2 months in this snippet

    # Fetch athlete profile
    profile_data = requests.get("https://www.strava.com/api/v3/athlete", headers={"Authorization": f"Bearer {access_token}"}).json()
    profile_img = profile_data.get("profile","")

    athletes_out[alias] = {
        "display_name": alias,
        "profile": profile_img
    }
    found_athletes.append(alias)

    # --- Per-activity JSON for current month ---
    for act_type in ALL_TYPES:
        daily_array = [0.0]*days_in_month
        for act in activities:
            if act.get("type") != act_type:
                continue
            dt = datetime.strptime(act["start_date_local"], "%Y-%m-%dT%H:%M:%S%z")
            if dt.year != CHALLENGE_YEAR or dt.month != CHALLENGE_MONTH:
                continue
            idx = dt.day-1
            if act_type in DISTANCE_TYPES:
                daily_array[idx] += act.get("distance",0)/1000
            else:
                daily_array[idx] += act.get("moving_time",0)/60
        monthly_total = sum(daily_array)
        monthly_field = "monthly_distances" if act_type in DISTANCE_TYPES else "monthly_time"
        daily_field = "daily_distance_km" if act_type in DISTANCE_TYPES else "daily_time_min"
        challenge_month_data[act_type][alias] = {
            "display_name": alias,
            "profile": profile_img,
            monthly_field: round(monthly_total,2) if act_type in DISTANCE_TYPES else int(monthly_total),
            daily_field: [ [round(v,2) if act_type in DISTANCE_TYPES else int(v) for v in daily_array] ]
        }

# --- Save per-activity JSONs ---
for act_type, data in challenge_month_data.items():
    filename = f"data/{CHALLENGE_MONTH_NAME}_Challenge_{act_type}.json"
    with open(filename, "w") as f:
        json.dump({
            "athletes": data,
            "month_names": [f"{CHALLENGE_MONTH_NAME} {CHALLENGE_YEAR}"],
            "last_synced": uk_now().strftime("%d-%m-%Y %H:%M")
        }, f, indent=2)

# --- Save athletes.json (unchanged) ---
with open("data/athletes.json","w") as f:
    json.dump({
        "athletes": athletes_out,
        "month_names": [CHALLENGE_MONTH_NAME],
        "last_synced": uk_now().strftime("%d-%m-%Y %H:%M")
    }, f, indent=2)

# --- Persistent monthly winners ---
WINNERS_FILE = "data/challenge_winners.json"
if os.path.exists(WINNERS_FILE):
    with open(WINNERS_FILE,"r") as f:
        winners_data = json.load(f)
else:
    winners_data = {}

month_key = f"{CHALLENGE_YEAR}-{CHALLENGE_MONTH:02d}"
if month_key not in winners_data:
    totals = defaultdict(float)
    for act_type, athletes in challenge_month_data.items():
        for alias, a in athletes.items():
            val = a.get("monthly_distances") or a.get("monthly_time") or 0
            totals[alias] += val

    if totals:
        winner_alias = max(totals, key=totals.get)
        winner_data = next(v for d in challenge_month_data.values() for k,v in d.items() if k==winner_alias)
        winners_data[month_key] = {
            "month": f"{CHALLENGE_MONTH_NAME} {CHALLENGE_YEAR}",
            "winner": winner_alias,
            "profile": winner_data.get("profile",""),
            "points": round(totals[winner_alias],2)
        }

        with open(WINNERS_FILE,"w") as f:
            json.dump(winners_data, f, indent=2)
