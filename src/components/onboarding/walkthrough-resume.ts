/* ── Walkthrough resume key (survives restart) ───────────────────────────── */

const WALKTHROUGH_RESUME_KEY = (userId: number | string) =>
  `crm:walkthrough-resume:${userId}`;

export function hasWalkthroughResumePending(userId: number | string): boolean {
  try {
    return localStorage.getItem(WALKTHROUGH_RESUME_KEY(userId)) === "true";
  } catch {
    return false;
  }
}

export function clearWalkthroughResume(userId: number | string) {
  try {
    localStorage.removeItem(WALKTHROUGH_RESUME_KEY(userId));
  } catch {
    // ignore
  }
}

export function setWalkthroughResume(userId: number | string) {
  try {
    localStorage.setItem(WALKTHROUGH_RESUME_KEY(userId), "true");
  } catch {
    // ignore
  }
}
