"""
Ekstrahiraj Google credentials iz .env.local in shrani kot credentials.json
"""
import json
import os
from pathlib import Path

def setup_credentials():
    """Preberi GOOGLE_CREDENTIALS iz .env.local in shrani kot credentials.json"""

    # Najdi .env.local
    env_file = Path(__file__).parent.parent / ".env.local"

    if not env_file.exists():
        print(f"[X] .env.local ni najden: {env_file}")
        return False

    # Preberi .env.local
    credentials_json = None
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('GOOGLE_CREDENTIALS='):
                # Vzemi vse po "="
                credentials_json = line.split('=', 1)[1].strip()
                break

    if not credentials_json:
        print("[X] GOOGLE_CREDENTIALS ni najden v .env.local")
        return False

    # Parse JSON
    try:
        credentials = json.loads(credentials_json)
    except json.JSONDecodeError as e:
        print(f"[X] Napaka pri parsanju JSON: {e}")
        return False

    # Shrani kot credentials.json
    output_file = Path(__file__).parent / "credentials.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(credentials, f, indent=2)

    print(f"[OK] Credentials shranjeni v: {output_file}")
    print(f"    Service Account: {credentials.get('client_email', 'N/A')}")

    return True


if __name__ == "__main__":
    print("=" * 50)
    print("SETUP GOOGLE CREDENTIALS")
    print("=" * 50)

    if setup_credentials():
        print("\n[OK] Credentials pripravljeni!")
        print("\nZdaj lahko zaženete:")
        print("  python google_sheets.py")
    else:
        print("\n[X] Setup ni uspel!")
