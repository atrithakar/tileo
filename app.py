from flask import Flask, jsonify, request, send_from_directory
import subprocess
import os
import json
from pathlib import Path
from ctypes import POINTER
from comtypes import CLSCTX_ALL, CoInitialize, CoUninitialize
from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
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

    status = {}
    CoInitialize()

    try:
        # Get default speakers
        devices = AudioUtilities.GetSpeakers()
        # Activate the endpoint volume COM interface
        interface = devices.Activate(
            IAudioEndpointVolume._iid_, CLSCTX_ALL, None
        )
        # Query the interface properly
        volume = interface.QueryInterface(IAudioEndpointVolume)

        # Get master volume as scalar 0.0–1.0
        scalar = volume.GetMasterVolumeLevelScalar()
        percent = int(round(scalar * 100))
        status['volume'] = percent
    except:
        pass
    finally:
        CoUninitialize()

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

@app.route("/system/monitoring")
def system_monitoring():
    # print("System monitoring endpoint called")
    # Get system monitoring data: CPU, GPU, RAM, Battery
    monitoring = {}
    
    try:
        # CPU Usage via PowerShell
        ps_cpu = ['powershell', '-Command', 
                  'Get-Counter "\\Processor(_Total)\\% Processor Time" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue']
        code, out, err = run_cmd(ps_cpu)
        # print(f"CPU Usage: code={code}, out='{out.strip()}', err='{err.strip()}'")
        if code == 0 and out.strip():
            try:
                cpu_val = float(out.strip())
                monitoring['cpu_usage'] = min(100, max(0, cpu_val))
                # print(f"CPU Usage set to: {monitoring['cpu_usage']}")
            except Exception as e:
                print(f"CPU parsing error: {e}")
    except Exception as e:
        print(f"CPU command error: {e}")
    
    try:
        # CPU Temperature via WMI (try multiple approaches)
        # First try: Direct WMI thermal zone query (your working command)
        ps_thermal = ['powershell', '-Command', 
                     'Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace "root/wmi" | ForEach-Object { [PSCustomObject]@{ Zone = $_.InstanceName; TempK = $_.CurrentTemperature; TempC = [math]::Round(($_.CurrentTemperature / 10) - 273.15, 1) } } | Sort-Object TempC -Descending']
        code, out, err = run_cmd(ps_thermal)
        # print(f"CPU Temp (Thermal Zones): code={code}, out='{out.strip()}', err='{err.strip()}'")
        if code == 0 and out.strip():
            try:
                # Parse the output to find the highest temperature (likely CPU)
                lines = out.strip().split('\n')
                highest_temp = 0
                for line in lines:
                    if 'TempC' in line and ':' in line:
                        temp_str = line.split(':')[1].strip()
                        try:
                            temp_c = float(temp_str)
                            if 30 <= temp_c <= 100 and temp_c > highest_temp:
                                highest_temp = temp_c
                        except:
                            continue
                
                if highest_temp > 0:
                    monitoring['cpu_temp'] = highest_temp
                    # print(f"CPU Temp (Thermal Zones) set to: {monitoring['cpu_temp']}")
                else:
                    # Fallback: just get the first valid temperature
                    ps_simple = ['powershell', '-Command', 
                               'Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace "root/wmi" | Select-Object -First 1 -ExpandProperty CurrentTemperature']
                    code2, out2, err2 = run_cmd(ps_simple)
                    # print(f"CPU Temp (Simple Thermal): code={code2}, out='{out2.strip()}', err='{err2.strip()}'")
                    if code2 == 0 and out2.strip():
                        temp_val = float(out2.strip())
                        temp_c = (temp_val / 10) - 273.15
                        monitoring['cpu_temp'] = round(temp_c, 1)
                        # print(f"CPU Temp (Simple Thermal) set to: {monitoring['cpu_temp']}")
                        
            except Exception as e:
                print(f"CPU temp thermal parsing error: {e}")
                # Fallback to simple method
                ps_simple = ['powershell', '-Command', 
                           'Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace "root/wmi" | Select-Object -First 1 -ExpandProperty CurrentTemperature']
                code2, out2, err2 = run_cmd(ps_simple)
                # print(f"CPU Temp (Fallback): code={code2}, out='{out2.strip()}', err='{err2.strip()}'")
                if code2 == 0 and out2.strip():
                    temp_val = float(out2.strip())
                    temp_c = (temp_val / 10) - 273.15
                    monitoring['cpu_temp'] = round(temp_c, 1)
                    # print(f"CPU Temp (Fallback) set to: {monitoring['cpu_temp']}")
        
        # Second try: Get all thermal zones and pick the highest reasonable one
        if 'cpu_temp' not in monitoring:
            ps_all_zones = ['powershell', '-Command', 
                           'Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace "root/wmi" | ForEach-Object { ($_.CurrentTemperature / 10) - 273.15 } | Where-Object { $_ -gt 25 -and $_ -lt 100 } | Sort-Object -Descending | Select-Object -First 1']
            code, out, err = run_cmd(ps_all_zones)
            # print(f"CPU Temp (All Zones): code={code}, out='{out.strip()}', err='{err.strip()}'")
            if code == 0 and out.strip():
                try:
                    temp_c = float(out.strip())
                    monitoring['cpu_temp'] = round(temp_c, 1)
                    # print(f"CPU Temp (All Zones) set to: {monitoring['cpu_temp']}")
                except Exception as e:
                    print(f"CPU temp all zones parsing error: {e}")
                    
        # print(f"CPU temperature detection completed. Found: {'cpu_temp' in monitoring}")
    except Exception as e:
        print(f"CPU temp command error: {e}")
    
    try:
        # GPU Usage and Temperature via NVIDIA-SMI (for RTX 4060)
        nvidia_smi_paths = [
            Path("C:/Program Files/NVIDIA Corporation/NVSMI/nvidia-smi.exe"),
            Path("C:/Windows/System32/nvidia-smi.exe")
        ]
        
        nvidia_smi = None
        for path in nvidia_smi_paths:
            if path.exists():
                nvidia_smi = path
                break
        
        if nvidia_smi:
            # print(f"Using NVIDIA-SMI at: {nvidia_smi}")
            
            # GPU Usage
            gpu_usage_cmd = [str(nvidia_smi), '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits']
            code, out, err = run_cmd(gpu_usage_cmd)
            # print(f"GPU Usage: code={code}, out='{out.strip()}', err='{err.strip()}'")
            if code == 0 and out.strip():
                try:
                    gpu_usage = float(out.strip())
                    monitoring['gpu_usage'] = max(0, min(100, gpu_usage))
                    # print(f"GPU Usage set to: {monitoring['gpu_usage']}")
                except Exception as e:
                    print(f"GPU usage parsing error: {e}")
            
            # GPU Temperature
            gpu_temp_cmd = [str(nvidia_smi), '--query-gpu=temperature.gpu', '--format=csv,noheader,nounits']
            code, out, err = run_cmd(gpu_temp_cmd)
            # print(f"GPU Temp: code={code}, out='{out.strip()}', err='{err.strip()}'")
            if code == 0 and out.strip():
                try:
                    gpu_temp = float(out.strip())
                    monitoring['gpu_temp'] = gpu_temp
                    # print(f"GPU Temp set to: {monitoring['gpu_temp']}")
                except Exception as e:
                    print(f"GPU temp parsing error: {e}")
        else:
            print("NVIDIA-SMI not found - GPU monitoring unavailable")
            
    except Exception as e:
        print(f"GPU command error: {e}")
    
    try:
        # RAM Usage via PowerShell
        ps_ram = ['powershell', '-Command', 
                  '$mem = Get-WmiObject -Class Win32_OperatingSystem; [math]::Round(($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) / $mem.TotalVisibleMemorySize * 100, 1)']
        code, out, err = run_cmd(ps_ram)
        # print(f"RAM Usage: code={code}, out='{out.strip()}', err='{err.strip()}'")
        if code == 0 and out.strip():
            try:
                monitoring['ram_usage'] = float(out.strip())
                # print(f"RAM Usage set to: {monitoring['ram_usage']}")
            except Exception as e:
                print(f"RAM parsing error: {e}")
    except Exception as e:
        print(f"RAM command error: {e}")
    
    try:
        # Battery Level via PowerShell
        ps_battery = ['powershell', '-Command', 
                      'Get-WmiObject -Class Win32_Battery | Select-Object -ExpandProperty EstimatedChargeRemaining']
        code, out, err = run_cmd(ps_battery)
        # print(f"Battery: code={code}, out='{out.strip()}', err='{err.strip()}'")
        if code == 0 and out.strip():
            try:
                monitoring['battery_level'] = float(out.strip())
                # print(f"Battery set to: {monitoring['battery_level']}")
            except Exception as e:
                print(f"Battery parsing error: {e}")
    except Exception as e:
        print(f"Battery command error: {e}")
    
    # Set defaults for missing values (with some dummy data for testing)
    if 'cpu_usage' not in monitoring:
        monitoring['cpu_usage'] = -1  # dummy value for testing
    if 'cpu_temp' not in monitoring:
        monitoring['cpu_temp'] = -1  # dummy value for testing
    if 'gpu_usage' not in monitoring:
        monitoring['gpu_usage'] = -1   # dummy value for testing
    if 'gpu_temp' not in monitoring:
        monitoring['gpu_temp'] = -1   # dummy value for testing
    if 'ram_usage' not in monitoring:
        monitoring['ram_usage'] = -1  # dummy value for testing
    if 'battery_level' not in monitoring:
        monitoring['battery_level'] = -1  # dummy value for testing
    
    # print(f"Final monitoring data: {monitoring}")
    return jsonify(monitoring)

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
