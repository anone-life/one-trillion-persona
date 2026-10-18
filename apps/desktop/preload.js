// The only things the page can ask the shell for. The page (apps/web/src/pet.ts) reads this as window.onetPet.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("onetPet", {
  /** true = the window takes the mouse; false = clicks fall through to the desktop (mousemove still arrives). */
  setInteractive: (on) => ipcRenderer.send("pet:set-interactive", !!on),
  /** ✥ pressed: the window follows the cursor until endDrag. */
  startDrag: () => ipcRenderer.send("pet:drag-start"),
  endDrag: () => ipcRenderer.send("pet:drag-end"),
  /** Window things for the page's ⋯ menu: "onTop" (toggle) | "reset" | "hide" | "quit" | "state". Resolves with { onTop }. */
  app: (cmd) => ipcRenderer.invoke("pet:app", cmd),
});
