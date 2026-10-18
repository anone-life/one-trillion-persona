// 自建角色的照片（第 23 步）：用户自己上传一张，当聊天页的背景、桌宠的照片立牌。不动（没有立绘动画）。
// 照片只存在这台设备的浏览器里，不发给任何服务器（包括 anone.life）。缩到长边 900、JPEG，约 100KB。
const key = (id: string) => `1t.photo.${id}`;
const MAX = 900;

export function loadPhoto(id: string): string | null {
  try { return localStorage.getItem(key(id)); } catch { return null; }
}
export function removePhoto(id: string): void {
  try { localStorage.removeItem(key(id)); } catch { /* 无害 */ }
}
/** 存得下就 true；浏览器存储满了 false。 */
export function savePhoto(id: string, dataUrl: string): boolean {
  try { localStorage.setItem(key(id), dataUrl); return true; } catch { return false; }
}

/** 读一张用户选的图，缩到长边 900，转成 JPEG data URL。不是图片就抛。 */
export async function shrinkPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * s);
    canvas.height = Math.round(img.naturalHeight * s);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
