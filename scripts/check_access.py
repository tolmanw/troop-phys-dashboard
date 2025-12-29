import os
import json
import requests

# --- Load refresh tokens ---
REFRESH_TOKENS_JSON = os.environ['STRAVA_REFRESH_TOKENS']
refresh_tokens = json.loads(REFRESH_TOKENS_JSON)

CLIENT_ID = os.environ['STRAVA_CLIENT_ID']
CLIENT_SECRET = os.environ['STRAVA_CLIENT_SECRET']

def refresh_access_token(refresh_token):
    """
    Refresh Strava access token and return (access_token, scope)
    """
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
        print("Failed to refresh token:", data)
        return None, None
    return data["access_token"], data.get("scope", "")

# --- Check each athlete ---
print("Checking private activity access for all athletes...")
for username, info in refresh_tokens.items():
    access_token, scope = refresh_access_token(info["refresh_token"])
    if not access_token:
        print(f"{username}: ❌ Could not refresh token")
        continue

    if "activity:read_all" in scope:
        print(f"{username}: ✅ Token includes private activity access")
    else:
        print(f"{username}: ❌ Token does NOT include private activity access")
