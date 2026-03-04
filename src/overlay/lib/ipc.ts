export const setIgnoreMouse = (ignore: boolean): void => {
  window.electronAPI?.setIgnoreMouse(ignore);
};

export const navigateMain = (path: string): void => {
  window.electronAPI?.navigateMain(path);
};
