import os
import json
import requests
from datetime import datetime, timedelta, timezone
from calendar import monthrange

# --- Load environment variables ---
CLIENT_ID = os.environ['STRAVA_CLIENT_ID']
CLIENT_SECRET = os.environ['STRAVA_CLIENT_SECRET']
REFRESH_TOKENS_JSON = os.environ['STRAVA_REFRESH_TOKENS']

# Parse refresh tokens
refresh_tokens = json.loads(REFRESH_TOKENS_JSON)

# Activity types
ACTIVITY_TYPES = ["Run", "Trail Run", "Walk", "Hike", "Ride", "Virtual Ride"]
ALL_KEY = "All"

# --- Helper functions ---
def refresh_access_token(refresh_token):
    r = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
    )
    data = r.json()
    if "access_token" not in data:
        print("Error refreshing token:", data)
        return None
    return data["access_token"]

def get_month_start_dates():
    now = datetime.now(timezone.utc)
    current_first = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    prev_last = current_first - timedelta(days=1)
    prev_first = datetime(prev_last.year, prev_last.month, 1, tzinfo=timezone.utc)
    return int(prev_first.timestamp()), int(current_first.timestamp()), [prev_first, current_first]

def fetch_activities(access_token, after_ts):
    url = "https://www.strava.com/api/v3/athlete/activities"
    params = {"after": after_ts, "per_page": 200}
    headers = {"Authorization": f"Bearer {access_token}"}
    r = requests.get(url, headers=headers, params=params)
    if r.status_code != 200:
        print("Error fetching activities:", r.text)
        return []
    activities = r.json()
    return activities if isinstance(activities, list) else []

# --- Main ---
prev_ts, curr_ts, month_starts = get_month_start_dates()
month_names = [m.strftime("%B %Y") for m in month_starts]

athletes_out = {}

for username, info in refresh_tokens.items():
    print(f"Fetching data for {username}...")
    refresh_token = info.get("refresh_token")
    if not refresh_token:
        continue

    access_token = refresh_access_token(refresh_token)
    if not access_token:
        continue

    activities = fetch_activities(access_token, prev_ts)
    print(f"Total activities fetched: {len(activities)}")

    # Prepare containers
    monthly_by_type = {act: [0.0, 0.0] for act in ACTIVITY_TYPES}
    monthly_total = [0.0, 0.0]

    now = datetime.now(timezone.utc)
    days_in_month = monthrange(now.year, now.month)[1]
    daily_by_type = {act: [0.0]*days_in_month for act in ACTIVITY_TYPES}
    daily_total = [0.0]*days_in_month

    for act in activities:
        if not isinstance(act, dict):
            continue
        a_type = act.get("type")
        if a_type not in ACTIVITY_TYPES:
            continue

        try:
            dist_km = float(act.get("distance",0))/1000.0
        except Exception:
            dist_km = 0.0

        try:
            dt = datetime.strptime(act.get("start_date_local"), "%Y-%m-%dT%H:%M:%S%z")
        except Exception:
            try:
                dt = datetime.strptime(act.get("start_date_local"), "%Y-%m-%dT%H:%M:%S")
            except Exception:
                continue

        # Previous month
        if dt.year == month_starts[0].year and dt.month == month_starts[0].month:
            monthly_by_type[a_type][0] += dist_km
            monthly_total[0] += dist_km

        # Current month
        if dt.year == month_starts[1].year and dt.month == month_starts[1].month:
            monthly_by_type[a_type][1] += dist_km
            monthly_total[1] += dist_km
            day_idx = dt.day - 1
            if 0 <= day_idx < days_in_month:
                daily_by_type[a_type][day_idx] += dist_km
                daily_total[day_idx] += dist_km

    # Fetch athlete profile
    profile_data = requests.get("https://www.strava.com/api/v3/athlete", headers={"Authorization": f"Bearer {access_token}"}).json()
    profile_img = profile_data.get("profile_medium") or profile_data.get("profile") or ""

    athletes_out[username] = {
        "firstname": profile_data.get("firstname", ""),
        "lastname": profile_data.get("lastname", ""),
        "username": username,
        "profile": profile_img,
        "monthly_total": [round(d,2) for d in monthly_total],
        "monthly_by_type": {k:[round(x,2) for x in v] for k,v in monthly_by_type.items()},
        "daily_total": [round(d,2) for d in daily_total],
        "daily_by_type": {k:[round(x,2) for x in v] for k,v in daily_by_type.items()}
    }

# Write JSON
os.makedirs("data", exist_ok=True)
with open("data/athletes.json", "w") as f:
    json.dump({"athletes": athletes_out, "month_names": month_names}, f, indent=2)

print("athletes.json updated successfully.")
