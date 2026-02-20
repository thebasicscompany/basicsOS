/** Navigate the main window to a URL path. */
export const navigateMain = (path: string): void => {
  window.electronAPI?.navigateMain(path);
};

/** Toggle mouse ignore for click-through. */
export const setIgnoreMouse = (ignore: boolean): void => {
  window.electronAPI?.setIgnoreMouse(ignore);
};
