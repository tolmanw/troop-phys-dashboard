import os
import json
import requests

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


# ============================================================
# Configuration
# ============================================================

CLIENT_ID = os.environ["STRAVA_CLIENT_ID"]
CLIENT_SECRET = os.environ["STRAVA_CLIENT_SECRET"]
REFRESH_TOKENS_JSON = os.environ["STRAVA_REFRESH_TOKENS"]
ALIASES_JSON = os.environ.get("ATHLETE_ALIASES", "{}")

UK_TZ = ZoneInfo("Europe/London")

refresh_tokens = json.loads(REFRESH_TOKENS_JSON)
USERNAME_ALIASES = json.loads(ALIASES_JSON)

USERNAME_ALIASES_NORMALIZED = {
    key.strip().lower(): value
    for key, value in USERNAME_ALIASES.items()
}


# ============================================================
# Activity Types
# ============================================================

activity_types = [
    "Run",
    "Trail Run",
    "Walk",
    "Hike",
    "Virtual Run",

    "Ride",
    "Mountain Bike Ride",
    "Gravel Ride",
    "E-Bike Ride",
    "E-Mountain Bike Ride",
    "Velomobile",
    "Virtual Ride",

    "Canoe",
    "Kayak",
    "Kitesurf",
    "Rowing",
    "Stand Up Paddling",
    "Surf",
    "Windsurf",
    "Sail",

    "Ice Skate",
    "Alpine Ski",
    "Backcountry Ski",
    "Nordic Ski",
    "Snowboard",
    "Snowshoe",

    "Handcycle",
    "Inline Skate",
    "Rock Climb",
    "Roller Ski",
    "Golf",
    "Skateboard",
    "Football (Soccer)",
    "Wheelchair",

    "Badminton",
    "Tennis",
    "Pickleball",
    "Crossfit",
    "Elliptical",
    "Stair Stepper",
    "Weight Training",
    "Yoga",
    "Workout",
    "HIIT",
    "Pilates",
    "Table Tennis",
    "Squash",
    "Racquetball",
    "Virtual Rowing",
]


# Challenge categories
DISTANCE_TYPES = ["Run", "Ride", "Swim"]
TIME_TYPES = ["Workout"]
ALL_TYPES = DISTANCE_TYPES + TIME_TYPES


# ============================================================
# Helper Functions
# ============================================================

def uk_now():
    """
    Return current UK local time.
    Automatically handles GMT/BST.
    """
    return datetime.now(UK_TZ)


def refresh_access_token(refresh_token):
    """
    Exchange a Strava refresh token for a fresh access token.
    """

    try:
        response = requests.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            timeout=30,
        )

        response.raise_for_status()

    except requests.RequestException as exc:
        print(f"Error refreshing Strava access token: {exc}")
        return None

    try:
        data = response.json()
    except ValueError:
        print("Error refreshing token: Strava returned invalid JSON")
        return None

    access_token = data.get("access_token")

    if not access_token:
        print("Error refreshing token:", data)
        return None

    return access_token


def get_last_three_month_starts():
    """
    Return UTC datetimes for the first day of the current month
    and previous two months.
    """

    now = uk_now()

    month_starts = []

    for months_back in range(2, -1, -1):
        year = now.year
        month = now.month - months_back

        while month <= 0:
            month += 12
            year -= 1

        month_starts.append(
            datetime(
                year,
                month,
                1,
                tzinfo=timezone.utc,
            )
        )

    return month_starts


def fetch_activities(access_token, after_ts):
    """
    Fetch all athlete activities after the supplied Unix timestamp.
    Handles Strava pagination automatically.
    """

    url = "https://www.strava.com/api/v3/athlete/activities"

    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    activities = []
    page = 1

    while True:
        params = {
            "after": after_ts,
            "per_page": 200,
            "page": page,
        }

        try:
            response = requests.get(
                url,
                headers=headers,
                params=params,
                timeout=30,
            )

        except requests.RequestException as exc:
            print(
                f"Error fetching activities "
                f"(page {page}): {exc}"
            )
            break

        if response.status_code != 200:
            print(
                f"Error fetching activities "
                f"(page {page}): "
                f"{response.status_code} "
                f"{response.text}"
            )
            break

        try:
            page_activities = response.json()
        except ValueError:
            print(
                f"Error fetching activities "
                f"(page {page}): invalid JSON response"
            )
            break

        if not isinstance(page_activities, list):
            print(
                f"Unexpected activities response "
                f"on page {page}: {page_activities}"
            )
            break

        if not page_activities:
            break

        activities.extend(page_activities)

        print(
            f"Fetched {len(page_activities)} activities "
            f"from page {page}"
        )

        page += 1

    return activities


def fetch_profile(access_token):
    """
    Fetch current athlete profile data.
    """

    url = "https://www.strava.com/api/v3/athlete"

    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=30,
        )

        response.raise_for_status()

    except requests.RequestException as exc:
        print(f"Error fetching athlete profile: {exc}")
        return {}

    try:
        return response.json()

    except ValueError:
        print("Error fetching athlete profile: invalid JSON")
        return {}


def days_in_month(dt):
    """
    Return the number of days in the supplied month.
    """

    next_month = dt.replace(day=28) + timedelta(days=4)

    return (
        next_month
        - timedelta(days=next_month.day)
    ).day


def parse_activity_datetime(activity):
    """
    Parse Strava start_date_local.

    Returns None if no valid date is present.
    """

    start_date = activity.get("start_date_local")

    if not start_date:
        return None

    try:
        return datetime.strptime(
            start_date,
            "%Y-%m-%dT%H:%M:%S%z",
        )

    except ValueError:
        print(
            "Unable to parse activity date:",
            start_date,
        )
        return None


# ============================================================
# Month Setup
# ============================================================

month_starts = get_last_three_month_starts()

month_names = [
    month.strftime("%B %Y")
    for month in month_starts
]

oldest_month_timestamp = int(
    month_starts[0].timestamp()
)


# ============================================================
# Challenge Month Setup
# ============================================================

now = uk_now()

CHALLENGE_YEAR = now.year
CHALLENGE_MONTH = now.month
CHALLENGE_MONTH_NAME = now.strftime("%b")

challenge_month_start = datetime(
    CHALLENGE_YEAR,
    CHALLENGE_MONTH,
    1,
    tzinfo=timezone.utc,
)

days_in_challenge_month = days_in_month(
    challenge_month_start
)

challenge_data = {
    activity_type: {}
    for activity_type in ALL_TYPES
}


# ============================================================
# Output Containers
# ============================================================

athletes_out = {}

found_athletes = []
skipped_athletes = []


# ============================================================
# Main Athlete Processing
# ============================================================

for username, info in refresh_tokens.items():

    print()
    print("=" * 60)
    print(f"Processing athlete '{username}'")
    print("=" * 60)

    # --------------------------------------------------------
    # Validate refresh token
    # --------------------------------------------------------

    refresh_token = info.get("refresh_token")

    if not refresh_token:
        print(
            f"Skipping '{username}': "
            "refresh_token missing"
        )
        skipped_athletes.append(username)
        continue

    # --------------------------------------------------------
    # Resolve display alias
    # --------------------------------------------------------

    alias = USERNAME_ALIASES_NORMALIZED.get(
        username.strip().lower()
    )

    if not alias:
        print(
            f"Skipping '{username}': "
            "no alias defined"
        )
        skipped_athletes.append(username)
        continue

    # --------------------------------------------------------
    # Refresh Strava access token
    # --------------------------------------------------------

    access_token = refresh_access_token(
        refresh_token
    )

    if not access_token:
        skipped_athletes.append(username)
        continue

    # --------------------------------------------------------
    # Fetch activities ONCE
    #
    # This fetch covers the oldest of the last three months
    # through the present, so the same dataset can also be
    # used for the current-month challenges.
    # --------------------------------------------------------

    activities = fetch_activities(
        access_token,
        oldest_month_timestamp,
    )

    print(
        f"Total activities returned for "
        f"{alias}: {len(activities)}"
    )

    # --------------------------------------------------------
    # Deduplicate activities
    # --------------------------------------------------------

    unique_activities = []
    processed_activity_ids = set()

    for activity in activities:

        activity_id = activity.get("id")

        if activity_id is None:
            continue

        if activity_id in processed_activity_ids:
            continue

        processed_activity_ids.add(
            activity_id
        )

        unique_activities.append(activity)

    activities = unique_activities

    print(
        f"Unique activities for "
        f"{alias}: {len(activities)}"
    )

    # --------------------------------------------------------
    # Activities used for main athletes.json
    # --------------------------------------------------------

    dashboard_activities = [
        activity
        for activity in activities
        if activity.get("type") in activity_types
    ]

    # --------------------------------------------------------
    # Initialise monthly arrays
    # --------------------------------------------------------

    monthly_distance = [0.0] * 3
    monthly_time_min = [0.0] * 3

    daily_distance = [
        [0.0] * days_in_month(month)
        for month in month_starts
    ]

    daily_time_min = [
        [0.0] * days_in_month(month)
        for month in month_starts
    ]

    # --------------------------------------------------------
    # Aggregate main dashboard data
    # --------------------------------------------------------

    for activity in dashboard_activities:

        dt = parse_activity_datetime(
            activity
        )

        if dt is None:
            continue

        distance_km = (
            activity.get("distance", 0) or 0
        ) / 1000

        time_min = (
            activity.get("moving_time", 0) or 0
        ) / 60

        for index, month_start in enumerate(
            month_starts
        ):

            if (
                dt.year == month_start.year
                and dt.month == month_start.month
            ):

                day_index = dt.day - 1

                monthly_distance[index] += (
                    distance_km
                )

                monthly_time_min[index] += (
                    time_min
                )

                daily_distance[index][
                    day_index
                ] += distance_km

                daily_time_min[index][
                    day_index
                ] += time_min

                break

    # --------------------------------------------------------
    # Fetch athlete profile
    # --------------------------------------------------------

    profile_data = fetch_profile(
        access_token
    )

    profile_img = profile_data.get(
        "profile",
        "",
    )

    # --------------------------------------------------------
    # Save athlete dashboard data
    # --------------------------------------------------------

    athletes_out[alias] = {
        "display_name": alias,
        "profile": profile_img,

        "monthly_distances": [
            round(value, 2)
            for value in monthly_distance
        ],

        "monthly_time": [
            round(value)
            for value in monthly_time_min
        ],

        "daily_distance_km": [
            [
                round(value, 2)
                for value in month
            ]
            for month in daily_distance
        ],

        "daily_time_min": [
            [
                round(value, 2)
                for value in month
            ]
            for month in daily_time_min
        ],
    }

    found_athletes.append(alias)

    # ========================================================
    # Current Month Challenge Processing
    # ========================================================

    for activity_type in ALL_TYPES:

        daily_array = (
            [0.0] * days_in_challenge_month
        )

        for activity in activities:

            if activity.get("type") != activity_type:
                continue

            dt = parse_activity_datetime(
                activity
            )

            if dt is None:
                continue

            if (
                dt.year != CHALLENGE_YEAR
                or dt.month != CHALLENGE_MONTH
            ):
                continue

            day_index = dt.day - 1

            if activity_type in DISTANCE_TYPES:

                distance_km = (
                    activity.get(
                        "distance",
                        0,
                    )
                    or 0
                ) / 1000

                daily_array[
                    day_index
                ] += distance_km

            else:

                moving_minutes = (
                    activity.get(
                        "moving_time",
                        0,
                    )
                    or 0
                ) / 60

                daily_array[
                    day_index
                ] += moving_minutes

        monthly_total = sum(
            daily_array
        )

        if activity_type in DISTANCE_TYPES:

            challenge_data[
                activity_type
            ][alias] = {
                "display_name": alias,
                "profile": profile_img,
                "monthly_distances": round(
                    monthly_total,
                    2,
                ),
                "daily_distance_km": [
                    round(value, 2)
                    for value in daily_array
                ],
            }

        else:

            challenge_data[
                activity_type
            ][alias] = {
                "display_name": alias,
                "profile": profile_img,
                "monthly_time": round(
                    monthly_total
                ),
                "daily_time_min": [
                    round(value)
                    for value in daily_array
                ],
            }


# ============================================================
# Save Output
# ============================================================

os.makedirs(
    "data",
    exist_ok=True,
)

sync_timestamp = uk_now().strftime(
    "%d-%m-%Y %H:%M"
)


# ------------------------------------------------------------
# athletes.json
# ------------------------------------------------------------

athletes_output = {
    "athletes": athletes_out,
    "month_names": month_names,
    "last_synced": sync_timestamp,
}

with open(
    "data/athletes.json",
    "w",
    encoding="utf-8",
) as file:

    json.dump(
        athletes_output,
        file,
        indent=2,
        ensure_ascii=False,
    )

    file.write("\n")

print(
    "data/athletes.json "
    "updated successfully."
)


# ------------------------------------------------------------
# Challenge JSON files
# ------------------------------------------------------------

for activity_type, data in challenge_data.items():

    filename = (
        f"data/"
        f"{CHALLENGE_MONTH_NAME}"
        f"_Challenge_"
        f"{activity_type}.json"
    )

    challenge_output = {
        "athletes": data,
        "month_names": [
            f"{CHALLENGE_MONTH_NAME} "
            f"{CHALLENGE_YEAR}"
        ],
        "last_synced": sync_timestamp,
    }

    with open(
        filename,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            challenge_output,
            file,
            indent=2,
            ensure_ascii=False,
        )

        file.write("\n")

    print(
        f"{filename} "
        "updated successfully."
    )


# ============================================================
# Summary
# ============================================================

print()
print("=" * 60)
print("Strava sync complete")
print("=" * 60)

print(
    f"Found athletes "
    f"({len(found_athletes)}): "
    f"{found_athletes}"
)

print(
    f"Skipped athletes "
    f"({len(skipped_athletes)}): "
    f"{skipped_athletes}"
)

print(
    f"Last synced: "
    f"{sync_timestamp}"
)
