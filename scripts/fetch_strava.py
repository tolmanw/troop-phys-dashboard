import os, json, requests
from datetime import datetime, timedelta, timezone

# Environment variables
CLIENT_ID = os.environ['STRAVA_CLIENT_ID']
CLIENT_SECRET = os.environ['STRAVA_CLIENT_SECRET']
REFRESH_TOKENS_JSON = os.environ['STRAVA_REFRESH_TOKENS']

refresh_tokens = json.loads(REFRESH_TOKENS_JSON)

now = datetime.now(timezone.utc)
# Timestamps for last month and current month
month_starts = []
for i in range(1, -1, -1):
    first_day = datetime(now.year, now.month, 1, tzinfo=timezone.utc) - timedelta(days=30*i)
    month_starts.append(int(first_day.timestamp()))

athletes_out = {}

for username, info in refresh_tokens.items():
    try:
        # Refresh access token
        r = requests.post("https://www.strava.com/oauth/token", data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": info['refresh_token']
        })
        token_data = r.json()
        access_token = token_data.get('access_token')
        if not access_token:
            print(f"Failed to get access token for {username}, skipping.")
            continue

        # Fetch athlete profile
        r = requests.get("https://www.strava.com/api/v3/athlete",
                         headers={"Authorization": f"Bearer {access_token}"})
        athlete = r.json()

        # Monthly distances
        monthly_distances = []

        for start in month_starts:
            r = requests.get("https://www.strava.com/api/v3/athlete/activities",
                             headers={"Authorization": f"Bearer {access_token}"},
                             params={"after": start, "per_page": 200})
            try:
                activities = r.json()
                if not isinstance(activities, list):
                    print(f"Unexpected response for {username}: {activities}")
                    activities = []
            except Exception as e:
                print(f"Failed to parse activities for {username}: {r.text}")
                activities = []

            leg_activities = [a for a in activities if isinstance(a, dict) and a.get('type') in ['Run','Walk','Hike']]
            total_km = sum(a.get('distance',0)/1000 for a in leg_activities)
            monthly_distances.append(round(total_km,2))

        # Current month daily distances
        month_start_current = month_starts[-1]
        r = requests.get("https://www.strava.com/api/v3/athlete/activities",
                         headers={"Authorization": f"Bearer {access_token}"},
                         params={"after": month_start_current, "per_page": 200})
        try:
            activities = r.json()
            if not isinstance(activities, list):
                activities = []
        except Exception:
            activities = []

        daily_distance = [0]*30
        for a in activities:
            if not isinstance(a, dict): 
                continue
            try:
                day = datetime.fromisoformat(a['start_date_local']).day - 1
                if 0 <= day < 30:
                    daily_distance[day] += a.get('distance',0)/1000
            except Exception:
                continue

        athletes_out[username] = {
            "firstname": athlete.get("firstname",""),
            "lastname": athlete.get("lastname",""),
            "username": athlete.get("username",""),
            "profile": athlete.get("profile_medium") or athlete.get("profile") or "",
            "monthly_distances": monthly_distances,
            "daily_distance_km": daily_distance
        }

    except Exception as e:
        print(f"Error fetching data for {username}: {e}")

# Write JSON
os.makedirs("data", exist_ok=True)
with open("data/athletes.json","w") as f:
    json.dump({"athletes": athletes_out}, f, indent=2)

print("Strava data fetch complete.")
