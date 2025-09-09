from flask import Flask, jsonify, request, send_from_directory
import subprocess
import os
import json
from pathlib import Path
import shlex
import sys

# ---------- CONFIG ----------
CONFIG_PATH = Path(__file__).with_name("app_config.json")
FLASK_HOST = "0.0.0.0"
FLASK_PORT = 5000
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
    mode = item.get("mode", "popen")
    try:
        if mode == "startfile":
            os.startfile(cmd)
        elif isinstance(cmd, list):
            subprocess.Popen(cmd, shell=False)
        else:
            subprocess.Popen(cmd, shell=True)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

    return jsonify({"ok": True, "launched": app_id})

# ---------------- System control endpoints ----------------

def run_cmd(cmd_list, shell=False):
    try:
        p = subprocess.Popen(cmd_list, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=shell)
        out, err = p.communicate(timeout=6)
        return p.returncode, out.decode('utf-8', errors='ignore'), err.decode('utf-8', errors='ignore')
    except Exception as e:
        return -1, "", str(e)

@app.route("/system/status")
def system_status():
    # best-effort: try to read volume via nircmd if available
    status = {}
    # volume via nircmd (returns value 0..65535)
    nircmd = Path("C:/Windows/nircmd.exe")
    if nircmd.exists():
        rc, out, err = run_cmd([str(nircmd), "getvolume"])
        try:
            v = int(out.strip())
            # normalize: nircmd getvolume returns 0-65535
            status['volume'] = round((v/65535.0)*100)
        except:
            pass
    # brightness via powershell WMI (best-effort)
    try:
        ps = ['powershell', '-Command', "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness"]
        rc, out, err = run_cmd(ps)
        if rc == 0 and out.strip().isdigit():
            status['brightness'] = int(out.strip())
    except:
        pass

    # placeholder for media now playing
    status['now_playing'] = {}
    return jsonify(status)

@app.route("/system/volume", methods=["POST"])
def system_volume():
    data = request.json or {}
    val = data.get("value")
    if val is None:
        return jsonify({"ok": False, "error": "missing value"}), 400
    try:
        v = int(val)
        v = max(0, min(100, v))
    except:
        return jsonify({"ok": False, "error": "invalid value"}), 400

    # try nircmd if available: setsysvolume takes 0..65535
    nircmd = Path("C:/Windows/nircmd.exe")
    if nircmd.exists():
        scaled = int((v/100.0)*65535)
        code, out, err = run_cmd([str(nircmd), "setsysvolume", str(scaled)])
        if code == 0:
            return jsonify({"ok": True, "volume": v})
        else:
            return jsonify({"ok": False, "error": f"nircmd failed: {err}"}), 500

    # fallback: Windows PowerShell - attempt using Audio endpoint (requires additional modules; likely not available)
    return jsonify({"ok": False, "error": "nircmd not found; install nircmd and place in C:\\Windows to enable volume control"}), 501

@app.route("/system/mute", methods=["POST"])
def system_mute():
    nircmd = Path("C:/Windows/nircmd.exe")
    if nircmd.exists():
        code, out, err = run_cmd([str(nircmd), "mutesysvolume", "2"])
        if code == 0:
            return jsonify({"ok": True})
        return jsonify({"ok": False, "error": err}), 500
    return jsonify({"ok": False, "error": "nircmd not found; install nircmd"}), 501

@app.route("/system/brightness", methods=["POST"])
def system_brightness():
    data = request.json or {}
    val = data.get("value")
    if val is None:
        return jsonify({"ok": False, "error": "missing value"}), 400
    try:
        v = int(val)
        v = max(0, min(100, v))
    except:
        return jsonify({"ok": False, "error": "invalid value"}), 400

    # Use PowerShell WMI method to set brightness (requires admin on some systems)
    try:
        ps = ['powershell', '-Command', f"$b = {v}; (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, $b)"]
        code, out, err = run_cmd(ps, shell=False)
        if code == 0:
            return jsonify({"ok": True, "brightness": v})
        else:
            return jsonify({"ok": False, "error": f"powershell failed: {err}"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/system/media", methods=["POST"])
def system_media():
    data = request.json or {}
    action = data.get("action")
    if not action:
        return jsonify({"ok": False, "error": "missing action"}), 400

    nircmd = Path("C:/Windows/nircmd.exe")
    if nircmd.exists():
        keymap = {
            'playpause': 'mediaplaypause',
            'next': 'medianext',
            'prev': 'mediaprev',
            'stop': 'mediastop'
        }
        k = keymap.get(action)
        if not k:
            return jsonify({"ok": False, "error": "unknown action"}), 400
        code, out, err = run_cmd([str(nircmd), "sendkeypress", k])
        if code == 0:
            return jsonify({"ok": True})
        return jsonify({"ok": False, "error": err}), 500

    return jsonify({"ok": False, "error": "nircmd not found; install nircmd to enable media controls"}), 501

@app.route("/system/theme", methods=["POST"])
def system_theme():
    # toggle Windows theme by registry change (HKCU)
    try:
        # read current AppsUseLightTheme
        ps_read = ['powershell', '-Command', "(Get-ItemProperty -Path HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize -Name AppsUseLightTheme).AppsUseLightTheme"]
        code, out, err = run_cmd(ps_read)
        if code == 0:
            cur = out.strip()
            new = "0" if cur == "1" else "1"
            ps_write = ['powershell', '-Command', f"Set-ItemProperty -Path HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize -Name AppsUseLightTheme -Value {new}; Set-ItemProperty -Path HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize -Name SystemUsesLightTheme -Value {new}"]
            code2, out2, err2 = run_cmd(ps_write)
            if code2 == 0:
                # advise to refresh explorer for immediate effect (not executed here)
                return jsonify({"ok": True, "theme": ("light" if new=="1" else "dark")})
            else:
                return jsonify({"ok": False, "error": err2}), 500
        else:
            return jsonify({"ok": False, "error": "could not determine current theme"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/system/power", methods=["POST"])
def system_power():
    data = request.json or {}
    action = data.get("action")
    if not action:
        return jsonify({"ok": False, "error": "missing action"}), 400

    try:
        if action == "shutdown":
            cmd = ["shutdown", "/s", "/t", "5"]
        elif action == "restart":
            cmd = ["shutdown", "/r", "/t", "5"]
        elif action == "sleep":
            # use rundll32 to put system to sleep
            cmd = ["rundll32.exe", "powrprof.dll,SetSuspendState", "0", "1", "0"]
        elif action == "hibernate":
            cmd = ["shutdown", "/h"]
        else:
            return jsonify({"ok": False, "error": "unknown action"}), 400

        code, out, err = run_cmd(cmd)
        if code == 0:
            return jsonify({"ok": True, "action": action})
        else:
            return jsonify({"ok": False, "error": err}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    print(f"Starting launcher on http://{FLASK_HOST}:{FLASK_PORT}")
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=False)
