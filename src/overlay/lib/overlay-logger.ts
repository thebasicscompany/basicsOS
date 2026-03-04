// Browser-safe logger for overlay renderer

export const createOverlayLogger = (tag: string) => {
  const prefix = `[${tag}]`;
  return {
    debug: (...args: unknown[]) => console.log(prefix, ...args),
    info: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
};
