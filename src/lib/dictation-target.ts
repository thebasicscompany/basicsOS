import type { Editor } from "@tiptap/react";

type DictationInsertHandler = {
  insertText: (text: string) => boolean;
};

type NativeEditable = HTMLInputElement | HTMLTextAreaElement;

type TrackedTarget =
  | {
      kind: "native";
      element: NativeEditable;
      selectionStart: number | null;
      selectionEnd: number | null;
    }
  | {
      kind: "custom";
      element: HTMLElement;
      handler: DictationInsertHandler;
    };

const CUSTOM_TARGET_ATTR = "data-dictation-target-id";
const customTargets = new Map<string, DictationInsertHandler>();

let activeTarget: TrackedTarget | null = null;
let isBridgeInstalled = false;

const isTextLikeInput = (element: HTMLInputElement): boolean => {
  const type = (element.type || "text").toLowerCase();
  return [
    "text",
    "search",
    "url",
    "tel",
    "password",
    "email",
    "number",
  ].includes(type);
};

const isNativeEditable = (value: EventTarget | null): value is NativeEditable => {
  if (value instanceof HTMLTextAreaElement) {
    return !value.readOnly && !value.disabled;
  }

  if (value instanceof HTMLInputElement) {
    return isTextLikeInput(value) && !value.readOnly && !value.disabled;
  }

  return false;
};

const setNativeValue = (element: NativeEditable, value: string): void => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
};

const tryGetSelection = (
  element: NativeEditable,
): { start: number; end: number } => {
  const fallback = element.value.length;
  const start =
    typeof element.selectionStart === "number" ? element.selectionStart : fallback;
  const end =
    typeof element.selectionEnd === "number" ? element.selectionEnd : start;
  return { start, end };
};

const trackNativeTarget = (element: NativeEditable): void => {
  const { start, end } = tryGetSelection(element);
  activeTarget = {
    kind: "native",
    element,
    selectionStart: start,
    selectionEnd: end,
  };
};

const clearIfDetached = (): void => {
  if (!activeTarget) return;
  if (!activeTarget.element.isConnected) {
    activeTarget = null;
  }
};

const resolveCustomTarget = (node: Element | null): TrackedTarget | null => {
  if (!(node instanceof HTMLElement)) return null;
  const targetRoot = node.closest<HTMLElement>(`[${CUSTOM_TARGET_ATTR}]`);
  if (!targetRoot) return null;

  const targetId = targetRoot.getAttribute(CUSTOM_TARGET_ATTR);
  if (!targetId) return null;

  const handler = customTargets.get(targetId);
  if (!handler) return null;

  return {
    kind: "custom",
    element: targetRoot,
    handler,
  };
};

const updateTrackedTarget = (candidate: EventTarget | null): void => {
  clearIfDetached();

  if (isNativeEditable(candidate)) {
    trackNativeTarget(candidate);
    return;
  }

  if (candidate instanceof Element) {
    const customTarget = resolveCustomTarget(candidate);
    if (customTarget) {
      activeTarget = customTarget;
    }
  }
};

const handleSelectionChange = (): void => {
  const activeElement = document.activeElement;
  if (isNativeEditable(activeElement)) {
    trackNativeTarget(activeElement);
    return;
  }

  updateTrackedTarget(activeElement);
};

const insertIntoNativeTarget = (
  target: Extract<TrackedTarget, { kind: "native" }>,
  text: string,
): boolean => {
  const { element } = target;
  if (!element.isConnected || !document.contains(element)) return false;

  const selection =
    document.activeElement === element
      ? tryGetSelection(element)
      : {
          start: target.selectionStart ?? element.value.length,
          end: target.selectionEnd ?? target.selectionStart ?? element.value.length,
        };

  const nextValue =
    element.value.slice(0, selection.start) +
    text +
    element.value.slice(selection.end);
  const nextCaret = selection.start + text.length;

  setNativeValue(element, nextValue);
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: "insertText",
    }),
  );

  element.focus({ preventScroll: true });
  if (typeof element.setSelectionRange === "function") {
    element.setSelectionRange(nextCaret, nextCaret);
  }

  activeTarget = {
    kind: "native",
    element,
    selectionStart: nextCaret,
    selectionEnd: nextCaret,
  };

  return true;
};

const insertIntoTrackedTarget = async (text: string): Promise<boolean> => {
  clearIfDetached();
  if (!document.hasFocus() || !activeTarget) return false;

  if (activeTarget.kind === "native") {
    return insertIntoNativeTarget(activeTarget, text);
  }

  if (!activeTarget.element.isConnected) return false;
  return activeTarget.handler.insertText(text);
};

export const installDictationTargetBridge = (): void => {
  if (typeof window === "undefined" || isBridgeInstalled) return;
  isBridgeInstalled = true;

  document.addEventListener("focusin", (event) => {
    updateTrackedTarget(event.target);
  });

  document.addEventListener("selectionchange", handleSelectionChange);
  document.addEventListener("keyup", handleSelectionChange, true);
  document.addEventListener("mouseup", handleSelectionChange, true);

  window.electronAPI?.onDictationInsertRequest?.(
    async ({ requestId, text }: { requestId: string; text: string }) => {
      const handled = await insertIntoTrackedTarget(text);
      window.electronAPI?.sendDictationInsertResult?.({
        requestId,
        handled,
      });
    },
  );
};

export const registerRichTextDictationTarget = (
  element: HTMLElement,
  editor: Editor,
): (() => void) => {
  const targetId = `dictation-${crypto.randomUUID()}`;
  element.setAttribute(CUSTOM_TARGET_ATTR, targetId);
  customTargets.set(targetId, {
    insertText: (text: string) => editor.chain().focus().insertContent(text).run(),
  });

  return () => {
    if (activeTarget?.kind === "custom" && activeTarget.element === element) {
      activeTarget = null;
    }
    customTargets.delete(targetId);
    element.removeAttribute(CUSTOM_TARGET_ATTR);
  };
};
