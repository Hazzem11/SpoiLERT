import { useEffect, useMemo, useState } from "react";
import type { FormEvent, JSX } from "react";

import {
  DEFAULT_SETTINGS,
  getSettings,
  getWatchItems,
  setSettings,
  setWatchItems
} from "../shared/storage";
import type { Sensitivity, UserSettings, WatchItem } from "../shared/types";
import {
  findDuplicateTitle,
  normalizeAliases,
  removeWatchItem,
  upsertWatchItem
} from "../shared/watchlist";

type ItemType = "show" | "movie";

interface FormState {
  id?: string;
  title: string;
  type: ItemType;
  aliasesText: string;
}

const INITIAL_FORM: FormState = {
  title: "",
  type: "show",
  aliasesText: ""
};

export function App(): JSX.Element {
  const [settings, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [watchItems, setWatchItemsState] = useState<WatchItem[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState<string>("");
  const extensionVersion = useMemo(() => {
    if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
      return chrome.runtime.getManifest().version;
    }
    return "dev";
  }, []);

  useEffect(() => {
    void (async () => {
      const [loadedSettings, loadedItems] = await Promise.all([getSettings(), getWatchItems()]);
      setSettingsState(loadedSettings);
      setWatchItemsState(loadedItems);
    })();
  }, []);

  const isEditing = useMemo(() => Boolean(form.id), [form.id]);

  const onToggleEnabled = async (enabled: boolean): Promise<void> => {
    const next = { ...settings, enabled };
    setSettingsState(next);
    await setSettings(next);
  };

  const onSensitivityChange = async (sensitivity: Sensitivity): Promise<void> => {
    const next = { ...settings, sensitivity };
    setSettingsState(next);
    await setSettings(next);
  };

  const onToggleGuard = async (
    key:
      | "guardAiOverview"
      | "guardRiskyQueries"
      | "guardAutocomplete"
      | "strictCharacterSpoilerMode",
    value: boolean
  ): Promise<void> => {
    const next = { ...settings, [key]: value };
    setSettingsState(next);
    await setSettings(next);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");

    const title = form.title.trim();
    if (title.length === 0) {
      setError("Title is required.");
      return;
    }

    const duplicate = findDuplicateTitle(watchItems, title, form.id);
    if (duplicate) {
      setError("This title already exists in your watchlist.");
      return;
    }

    const aliases = normalizeAliases(form.aliasesText.split(","));
    const nextItems = upsertWatchItem(watchItems, {
      id: form.id,
      title,
      type: form.type,
      aliases
    });

    setWatchItemsState(nextItems);
    setForm(INITIAL_FORM);
    await setWatchItems(nextItems);
  };

  const onEdit = (item: WatchItem): void => {
    setError("");
    setForm({
      id: item.id,
      title: item.title,
      type: item.type,
      aliasesText: (item.aliases ?? []).join(", ")
    });
  };

  const onDelete = async (id: string): Promise<void> => {
    const nextItems = removeWatchItem(watchItems, id);
    setWatchItemsState(nextItems);
    if (form.id === id) {
      setForm(INITIAL_FORM);
    }
    await setWatchItems(nextItems);
  };

  return (
    <main className="popup">
      <header className="header">
        <img className="brand" src="/branding/popup-logo.png" alt="SpoilERT" />
        <label className="toggle" aria-label="Enable SpoilERT">
          <span className="toggle-label">{settings.enabled ? "Protection On" : "Protection Off"}</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => void onToggleEnabled(event.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true" />
        </label>
      </header>

      <section className="card">
        <div className="card-title-row">
          <h2>Protection</h2>
          <span className="chip">Google Search</span>
        </div>
        <label className="field">
          <span>Sensitivity</span>
          <select
            value={settings.sensitivity}
            onChange={(event) => void onSensitivityChange(event.target.value as Sensitivity)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="field field-toggle-row">
          <span>Guard AI Overview</span>
          <input
            type="checkbox"
            checked={settings.guardAiOverview}
            onChange={(event) => void onToggleGuard("guardAiOverview", event.target.checked)}
          />
        </label>
        <label className="field field-toggle-row">
          <span>Warn before risky search</span>
          <input
            type="checkbox"
            checked={settings.guardRiskyQueries}
            onChange={(event) => void onToggleGuard("guardRiskyQueries", event.target.checked)}
          />
        </label>
        <label className="field field-toggle-row">
          <span>Guard autocomplete spoilers</span>
          <input
            type="checkbox"
            checked={settings.guardAutocomplete}
            onChange={(event) => void onToggleGuard("guardAutocomplete", event.target.checked)}
          />
        </label>
        <label className="field field-toggle-row">
          <span>Strict character spoiler mode</span>
          <input
            type="checkbox"
            checked={settings.strictCharacterSpoilerMode}
            onChange={(event) =>
              void onToggleGuard("strictCharacterSpoilerMode", event.target.checked)
            }
          />
        </label>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2>Watchlist</h2>
          <span className="chip">{watchItems.length} tracked</span>
        </div>
        <form className="form" onSubmit={(event) => void onSubmit(event)}>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={form.title}
              placeholder="e.g. Attack on Titan"
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Type</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, type: event.target.value as ItemType }))
              }
            >
              <option value="show">Show</option>
              <option value="movie">Movie</option>
            </select>
          </label>
          <label className="field">
            <span>Aliases (comma separated)</span>
            <input
              type="text"
              value={form.aliasesText}
              placeholder="AOT, Shingeki no Kyojin"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, aliasesText: event.target.value }))
              }
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <button type="submit">{isEditing ? "Save Item" : "Add Item"}</button>
            {isEditing ? (
              <button type="button" onClick={() => setForm(INITIAL_FORM)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <ul className="list">
          {watchItems.length === 0 ? <li className="muted">No watchlist items yet.</li> : null}
          {watchItems.map((item) => (
            <li key={item.id} className="list-item">
              <div>
                <strong>{item.title}</strong>
                <p>
                  {item.type}
                  {(item.aliases ?? []).length > 0 ? ` - aliases: ${(item.aliases ?? []).join(", ")}` : ""}
                </p>
              </div>
              <div className="item-actions">
                <button type="button" onClick={() => onEdit(item)}>
                  Edit
                </button>
                <button type="button" onClick={() => void onDelete(item.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <footer className="popup-footer">Version v{extensionVersion}</footer>
    </main>
  );
}
