import { useState } from "react";
import type { ReminderSettings } from "./types";
import {
  notificationsSupported,
  permissionState,
  requestNotificationPermission,
  showNotification,
} from "./reminders";

interface Props {
  settings: ReminderSettings;
  onChange: (s: ReminderSettings) => void;
  onClose: () => void;
}

export default function SettingsSheet({ settings, onChange, onClose }: Props) {
  const [perm, setPerm] = useState(permissionState());
  const supported = notificationsSupported();

  async function enable() {
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") onChange({ ...settings, enabled: true });
  }

  function toggle() {
    if (!settings.enabled) {
      if (perm !== "granted") return void enable();
      onChange({ ...settings, enabled: true });
    } else {
      onChange({ ...settings, enabled: false });
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grabber" />
        <div className="sheet-head">
          <button onClick={onClose}>Close</button>
          <span className="t">Reminders</span>
          <span style={{ width: 48 }} />
        </div>

        <div className="sheet-body">
          {!supported && (
            <p className="note warn">
              This browser doesn't support notifications. On iPhone, add Fishroom
              to your Home Screen (Share → Add to Home Screen) and open it from
              there to enable reminders.
            </p>
          )}

          <div className="setting-row">
            <div>
              <div className="setting-title">Water-change reminders</div>
              <div className="setting-sub">
                Get notified when tanks are due or overdue.
              </div>
            </div>
            <button
              className={"switch" + (settings.enabled ? " on" : "")}
              role="switch"
              aria-checked={settings.enabled}
              onClick={toggle}
              disabled={!supported}
            >
              <span className="knob" />
            </button>
          </div>

          {perm === "denied" && (
            <p className="note warn">
              Notifications are blocked. Enable them for this app in your browser
              / iOS settings, then come back.
            </p>
          )}

          <div className="field" style={{ marginTop: 16 }}>
            <label>Daily summary time</label>
            <select
              value={settings.hour}
              onChange={(e) =>
                onChange({ ...settings, hour: Number(e.target.value) })
              }
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
            <div className="setting-sub" style={{ marginTop: 6 }}>
              Once a day at/after this time, you'll get a summary of what needs a
              water change.
            </div>
          </div>

          <button
            className="ghost-btn"
            disabled={perm !== "granted"}
            onClick={() =>
              showNotification(
                "🐟 Fishroom",
                "Reminders are working — you're all set.",
                "test"
              )
            }
          >
            Send a test notification
          </button>

          <p className="note">
            Reminders fire while Fishroom is open or alive in the background.
            Serverless apps can't wake themselves once fully closed, so keep it
            installed on your Home Screen and open it daily for the most reliable
            nudges. All your data stays on this device.
          </p>
        </div>
      </div>
    </>
  );
}

function fmtHour(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}
