const DEVICE = "1t.device.v1";

/** 这个浏览器的随机编号（只用来数免费轮数，不和任何人连起来）。 */
export function deviceId(): string {
  try {
    const have = localStorage.getItem(DEVICE);
    if (have && /^[A-Za-z0-9_-]{8,64}$/.test(have)) return have;
    const id = `d${crypto.randomUUID().replace(/-/g, "")}`;
    localStorage.setItem(DEVICE, id);
    return id;
  } catch { return `d${crypto.randomUUID().replace(/-/g, "")}`; }
}

