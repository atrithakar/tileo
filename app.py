from flask import Flask, jsonify, request, send_from_directory, abort
import subprocess
import os
import json
from pathlib import Path

# ---------- CONFIG ----------
CONFIG_PATH = Path(__file__).with_name("app_config.json")
# Change HOST if you want to expose to LAN. For phone on same Wi-Fi use host="0.0.0.0".
FLASK_HOST = "0.0.0.0"
FLASK_PORT = 5000
# A simple token to avoid casual access on your LAN. Change this before using on network.
LAUNCH_TOKEN = "atri"
# ----------------------------

app = Flask(__name__, static_folder="static", static_url_path="/static")

def load_config():
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Missing config: {CONFIG_PATH}")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/config")
def get_config():
    cfg = load_config()
    # Return only metadata useful for frontend (id, label, icon)
    return jsonify([{"id": k, "label": v.get("label",""), "icon": v.get("icon","")} for k,v in cfg.items()])

@app.route("/launch/<app_id>", methods=["POST"])
def launch(app_id):
    token = request.headers.get("X-Launch-Token", "")
    if token != LAUNCH_TOKEN:
        return jsonify({"ok": False, "error": "invalid token"}), 403

    cfg = load_config()
    if app_id not in cfg:
        return jsonify({"ok": False, "error": "unknown app id"}), 404

    item = cfg[app_id]
    cmd = item.get("command")
    mode = item.get("mode", "popen")  # popen | startfile
    try:
        if mode == "startfile":
            # Use os.startfile for simple files/executables/shortcuts
            os.startfile(cmd)
        elif isinstance(cmd, list):
            # If command is list, use direct Popen
            subprocess.Popen(cmd, shell=False)
        else:
            # Try to run as a single string command
            # Use shell=True to support shell builtins like "explorer" or "control"
            subprocess.Popen(cmd, shell=True)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

    return jsonify({"ok": True, "launched": app_id})

if __name__ == "__main__":
    print(f"Starting launcher on http://{FLASK_HOST}:{FLASK_PORT}")
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=False)
