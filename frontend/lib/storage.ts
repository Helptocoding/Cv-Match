const KEY = "cv-matcher-provider-config";

export function saveLocalConfig(value: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(KEY, value);
}

export function loadLocalConfig() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(KEY);
}

export function clearLocalConfig() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(KEY);
}
