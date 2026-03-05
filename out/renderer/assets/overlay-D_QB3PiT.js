import { r as reactExports, M as MotionConfigContext, j as jsxRuntimeExports, i as isHTMLElement, u as useConstant, P as PresenceContext, a as usePresence, b as useIsomorphicLayoutEffect, L as LayoutGroupContext, m as motion, e, c as e$1, d as clientExports } from "./proxy-C_MfoVi8.js";
function setRef(ref, value) {
  if (typeof ref === "function") {
    return ref(value);
  } else if (ref !== null && ref !== void 0) {
    ref.current = value;
  }
}
function composeRefs(...refs) {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup === "function") {
        hasCleanup = true;
      }
      return cleanup;
    });
    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup === "function") {
            cleanup();
          } else {
            setRef(refs[i], null);
          }
        }
      };
    }
  };
}
function useComposedRefs(...refs) {
  return reactExports.useCallback(composeRefs(...refs), refs);
}
class PopChildMeasure extends reactExports.Component {
  getSnapshotBeforeUpdate(prevProps) {
    const element = this.props.childRef.current;
    if (element && prevProps.isPresent && !this.props.isPresent && this.props.pop !== false) {
      const parent = element.offsetParent;
      const parentWidth = isHTMLElement(parent) ? parent.offsetWidth || 0 : 0;
      const parentHeight = isHTMLElement(parent) ? parent.offsetHeight || 0 : 0;
      const size = this.props.sizeRef.current;
      size.height = element.offsetHeight || 0;
      size.width = element.offsetWidth || 0;
      size.top = element.offsetTop;
      size.left = element.offsetLeft;
      size.right = parentWidth - size.width - size.left;
      size.bottom = parentHeight - size.height - size.top;
    }
    return null;
  }
  /**
   * Required with getSnapshotBeforeUpdate to stop React complaining.
   */
  componentDidUpdate() {
  }
  render() {
    return this.props.children;
  }
}
function PopChild({ children, isPresent, anchorX, anchorY, root: root2, pop }) {
  const id = reactExports.useId();
  const ref = reactExports.useRef(null);
  const size = reactExports.useRef({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  });
  const { nonce } = reactExports.useContext(MotionConfigContext);
  const childRef = children.props?.ref ?? children?.ref;
  const composedRef = useComposedRefs(ref, childRef);
  reactExports.useInsertionEffect(() => {
    const { width, height, top, left, right, bottom } = size.current;
    if (isPresent || pop === false || !ref.current || !width || !height)
      return;
    const x = anchorX === "left" ? `left: ${left}` : `right: ${right}`;
    const y = anchorY === "bottom" ? `bottom: ${bottom}` : `top: ${top}`;
    ref.current.dataset.motionPopId = id;
    const style = document.createElement("style");
    if (nonce)
      style.nonce = nonce;
    const parent = root2 ?? document.head;
    parent.appendChild(style);
    if (style.sheet) {
      style.sheet.insertRule(`
          [data-motion-pop-id="${id}"] {
            position: absolute !important;
            width: ${width}px !important;
            height: ${height}px !important;
            ${x}px !important;
            ${y}px !important;
          }
        `);
    }
    return () => {
      if (parent.contains(style)) {
        parent.removeChild(style);
      }
    };
  }, [isPresent]);
  return jsxRuntimeExports.jsx(PopChildMeasure, { isPresent, childRef: ref, sizeRef: size, pop, children: pop === false ? children : reactExports.cloneElement(children, { ref: composedRef }) });
}
const PresenceChild = ({ children, initial, isPresent, onExitComplete, custom, presenceAffectsLayout, mode, anchorX, anchorY, root: root2 }) => {
  const presenceChildren = useConstant(newChildrenMap);
  const id = reactExports.useId();
  let isReusedContext = true;
  let context = reactExports.useMemo(() => {
    isReusedContext = false;
    return {
      id,
      initial,
      isPresent,
      custom,
      onExitComplete: (childId) => {
        presenceChildren.set(childId, true);
        for (const isComplete of presenceChildren.values()) {
          if (!isComplete)
            return;
        }
        onExitComplete && onExitComplete();
      },
      register: (childId) => {
        presenceChildren.set(childId, false);
        return () => presenceChildren.delete(childId);
      }
    };
  }, [isPresent, presenceChildren, onExitComplete]);
  if (presenceAffectsLayout && isReusedContext) {
    context = { ...context };
  }
  reactExports.useMemo(() => {
    presenceChildren.forEach((_, key) => presenceChildren.set(key, false));
  }, [isPresent]);
  reactExports.useEffect(() => {
    !isPresent && !presenceChildren.size && onExitComplete && onExitComplete();
  }, [isPresent]);
  children = jsxRuntimeExports.jsx(PopChild, { pop: mode === "popLayout", isPresent, anchorX, anchorY, root: root2, children });
  return jsxRuntimeExports.jsx(PresenceContext.Provider, { value: context, children });
};
function newChildrenMap() {
  return /* @__PURE__ */ new Map();
}
const getChildKey = (child) => child.key || "";
function onlyElements(children) {
  const filtered = [];
  reactExports.Children.forEach(children, (child) => {
    if (reactExports.isValidElement(child))
      filtered.push(child);
  });
  return filtered;
}
const AnimatePresence = ({ children, custom, initial = true, onExitComplete, presenceAffectsLayout = true, mode = "sync", propagate = false, anchorX = "left", anchorY = "top", root: root2 }) => {
  const [isParentPresent, safeToRemove] = usePresence(propagate);
  const presentChildren = reactExports.useMemo(() => onlyElements(children), [children]);
  const presentKeys = propagate && !isParentPresent ? [] : presentChildren.map(getChildKey);
  const isInitialRender = reactExports.useRef(true);
  const pendingPresentChildren = reactExports.useRef(presentChildren);
  const exitComplete = useConstant(() => /* @__PURE__ */ new Map());
  const exitingComponents = reactExports.useRef(/* @__PURE__ */ new Set());
  const [diffedChildren, setDiffedChildren] = reactExports.useState(presentChildren);
  const [renderedChildren, setRenderedChildren] = reactExports.useState(presentChildren);
  useIsomorphicLayoutEffect(() => {
    isInitialRender.current = false;
    pendingPresentChildren.current = presentChildren;
    for (let i = 0; i < renderedChildren.length; i++) {
      const key = getChildKey(renderedChildren[i]);
      if (!presentKeys.includes(key)) {
        if (exitComplete.get(key) !== true) {
          exitComplete.set(key, false);
        }
      } else {
        exitComplete.delete(key);
        exitingComponents.current.delete(key);
      }
    }
  }, [renderedChildren, presentKeys.length, presentKeys.join("-")]);
  const exitingChildren = [];
  if (presentChildren !== diffedChildren) {
    let nextChildren = [...presentChildren];
    for (let i = 0; i < renderedChildren.length; i++) {
      const child = renderedChildren[i];
      const key = getChildKey(child);
      if (!presentKeys.includes(key)) {
        nextChildren.splice(i, 0, child);
        exitingChildren.push(child);
      }
    }
    if (mode === "wait" && exitingChildren.length) {
      nextChildren = exitingChildren;
    }
    setRenderedChildren(onlyElements(nextChildren));
    setDiffedChildren(presentChildren);
    return null;
  }
  const { forceRender } = reactExports.useContext(LayoutGroupContext);
  return jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: renderedChildren.map((child) => {
    const key = getChildKey(child);
    const isPresent = propagate && !isParentPresent ? false : presentChildren === renderedChildren || presentKeys.includes(key);
    const onExit = () => {
      if (exitingComponents.current.has(key)) {
        return;
      }
      exitingComponents.current.add(key);
      if (exitComplete.has(key)) {
        exitComplete.set(key, true);
      } else {
        return;
      }
      let isEveryExitComplete = true;
      exitComplete.forEach((isExitComplete) => {
        if (!isExitComplete)
          isEveryExitComplete = false;
      });
      if (isEveryExitComplete) {
        forceRender?.();
        setRenderedChildren(pendingPresentChildren.current);
        propagate && safeToRemove?.();
        onExitComplete && onExitComplete();
      }
    };
    return jsxRuntimeExports.jsx(PresenceChild, { isPresent, initial: !isInitialRender.current || initial ? void 0 : false, custom, presenceAffectsLayout, mode, root: root2, onExitComplete: isPresent ? void 0 : onExit, anchorX, anchorY, children: child }, key);
  }) });
};
const MIN_TRANSCRIPTION_BLOB_SIZE = 1e3;
const FLASH_SHORT_MS = 800;
const FLASH_MEDIUM_MS = 2e3;
const FLASH_LONG_MS = 3e3;
const API_STREAM_TIMEOUT_MS = 3e4;
const setIgnoreMouse = (ignore) => {
  window.electronAPI?.setIgnoreMouse(ignore);
};
const DEFAULT_TIMEOUT_MS = 3e4;
class VoiceApiError extends Error {
  status;
  code;
  constructor(message, status, code) {
    super(message);
    this.name = "VoiceApiError";
    this.status = status;
    this.code = code;
  }
}
const readErrorEnvelope = (res) => {
  let fallback = `Request failed (${res.status})`;
  let code;
  try {
    const contentType = res.headers["content-type"] ?? "";
    if (contentType.includes("application/json")) {
      const json = JSON.parse(res.body);
      if (typeof json.error === "string") {
        fallback = json.error;
      } else if (json.error?.message) {
        fallback = json.error.message;
        code = json.error.code;
      }
    } else {
      const text = res.body;
      if (text.trim()) fallback = text.trim().slice(0, 300);
    }
  } catch {
  }
  return new VoiceApiError(fallback, res.status, code);
};
const fetchWithSession = async (path, init, options) => {
  const proxyRequest = window.electronAPI?.proxyOverlayRequest;
  if (!proxyRequest)
    throw new VoiceApiError(
      "Overlay bridge unavailable",
      500,
      "bridge_unavailable"
    );
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options?.retries ?? 0;
  let attempt = 0;
  let lastError = null;
  while (attempt <= retries) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(
            new VoiceApiError("Voice request timed out", 504, "timeout")
          ),
          timeoutMs
        );
      });
      const res = await Promise.race([
        proxyRequest({
          path,
          method: init.method,
          headers: init.headers,
          body: init.body
        }),
        timeoutPromise
      ]);
      if (!res.ok) {
        throw readErrorEnvelope(res);
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      attempt += 1;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new VoiceApiError("Voice request failed", 500);
};
const synthesizeSpeech = async (text) => {
  try {
    const res = await fetchWithSession(
      "/v1/audio/speech",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      },
      { retries: 1 }
    );
    if (res.encoding !== "base64") {
      return new TextEncoder().encode(res.body).buffer;
    }
    const bytes = Uint8Array.from(atob(res.body), (char) => char.charCodeAt(0));
    return bytes.buffer;
  } catch {
    return null;
  }
};
const transcribeAudioBlob = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );
  try {
    const res = await fetchWithSession(
      "/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          audio: base64,
          mime_type: blob.type || "audio/webm"
        })
      },
      { retries: 1 }
    );
    const json = JSON.parse(res.body);
    return json.transcript ?? null;
  } catch {
    return null;
  }
};
async function* streamAssistant(message, history, options) {
  const res = await fetchWithSession(
    "/stream/assistant",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message, history })
    },
    { timeoutMs: options?.timeoutMs }
  );
  if (!res.body) throw new VoiceApiError("Empty stream response", 502);
  const lines = res.body.split("\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") return;
    try {
      const parsed = JSON.parse(data);
      if (parsed.token) yield parsed.token;
    } catch {
    }
  }
}
let currentAudio = null;
const playAudioBuffer = (buffer) => new Promise((resolve) => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const blob = new Blob([buffer], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  audio.onended = () => {
    URL.revokeObjectURL(url);
    currentAudio = null;
    resolve();
  };
  audio.onerror = () => {
    URL.revokeObjectURL(url);
    currentAudio = null;
    resolve();
  };
  void audio.play();
});
const speakWebSpeech = (text, opts) => {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts?.rate ?? 1.05;
    utterance.pitch = opts?.pitch ?? 1;
    utterance.volume = opts?.volume ?? 0.8;
    window.speechSynthesis.speak(utterance);
  } catch {
  }
};
const speak = async (text, opts) => {
  try {
    const buffer = await synthesizeSpeech(text);
    if (buffer) {
      await playAudioBuffer(buffer);
      return;
    }
  } catch {
  }
  speakWebSpeech(text, opts);
};
const cancel = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
  }
};
const createOverlayLogger = (tag) => {
  const prefix = `[${tag}]`;
  return {
    debug: (...args) => console.log(prefix, ...args),
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args)
  };
};
const log$1 = createOverlayLogger("whisper");
let audioCtx = null;
const playChime = (frequency, duration) => {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = frequency;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      1e-3,
      audioCtx.currentTime + duration
    );
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch {
  }
};
const playStartChime = () => playChime(880, 0.15);
const playStopChime = () => playChime(440, 0.2);
const VAD_POLL_MS = 60;
const VAD_CALIBRATION_MS = 350;
const VAD_MIN_SPEECH_MS = 180;
const VAD_NOISE_MARGIN = 4e-3;
const VAD_MIN_THRESHOLD = 6e-3;
const VAD_MAX_THRESHOLD = 0.04;
const VAD_INITIAL_NO_SPEECH_GRACE_MS = 2500;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const runVoiceActivityDetection = (stream, silenceTimeoutMs, onSilence) => {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  source.connect(analyser);
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.6;
  const data = new Uint8Array(analyser.fftSize);
  const startedAt = Date.now();
  const calibrationSamples = [];
  const noSpeechGraceMs = Math.max(
    silenceTimeoutMs,
    VAD_INITIAL_NO_SPEECH_GRACE_MS
  );
  let threshold = VAD_MIN_THRESHOLD;
  let smoothedRms = 0;
  let speechCandidateAt = null;
  let lastConfirmedSpeechAt = null;
  let ended = false;
  let cancelled = false;
  const getRms = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  };
  const finalizeCalibration = () => {
    if (calibrationSamples.length === 0) return;
    const avgNoise = calibrationSamples.reduce((acc, v) => acc + v, 0) / calibrationSamples.length;
    threshold = clamp(
      avgNoise * 2.1 + VAD_NOISE_MARGIN,
      VAD_MIN_THRESHOLD,
      VAD_MAX_THRESHOLD
    );
  };
  const triggerSilence = () => {
    if (ended || cancelled) return;
    ended = true;
    onSilence();
  };
  const poll = () => {
    if (cancelled || ended) return;
    const now = Date.now();
    const rms = getRms();
    smoothedRms = smoothedRms > 0 ? smoothedRms * 0.7 + rms * 0.3 : rms;
    if (now - startedAt <= VAD_CALIBRATION_MS) {
      calibrationSamples.push(smoothedRms);
    } else if (calibrationSamples.length > 0) {
      finalizeCalibration();
      calibrationSamples.length = 0;
    }
    const isVoice = smoothedRms >= threshold;
    if (isVoice) {
      if (speechCandidateAt === null) {
        speechCandidateAt = now;
      } else if (now - speechCandidateAt >= VAD_MIN_SPEECH_MS) {
        lastConfirmedSpeechAt = now;
      }
    } else {
      speechCandidateAt = null;
    }
    if (lastConfirmedSpeechAt !== null) {
      if (now - lastConfirmedSpeechAt >= silenceTimeoutMs) {
        triggerSilence();
        return;
      }
    } else if (now - startedAt >= noSpeechGraceMs) {
      triggerSilence();
      return;
    }
    setTimeout(poll, VAD_POLL_MS);
  };
  poll();
  return () => {
    cancelled = true;
    void ctx.close();
  };
};
const useSpeechRecognition = (options) => {
  const { onSilence, silenceTimeoutMs = 2e3 } = options ?? {};
  const [isListening, setIsListening] = reactExports.useState(false);
  const [transcript, setTranscript] = reactExports.useState("");
  const [interimText, setInterimText] = reactExports.useState("");
  const mediaRecorderRef = reactExports.useRef(null);
  const chunksRef = reactExports.useRef([]);
  const streamRef = reactExports.useRef(null);
  const vadCleanupRef = reactExports.useRef(null);
  const stopPromiseRef = reactExports.useRef(null);
  const listenSessionRef = reactExports.useRef(0);
  reactExports.useEffect(() => {
    return () => {
      vadCleanupRef.current?.();
      vadCleanupRef.current = null;
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
    };
  }, []);
  const startListening = reactExports.useCallback(() => {
    const sessionId = Date.now();
    listenSessionRef.current = sessionId;
    const existingRecorder = mediaRecorderRef.current;
    if (existingRecorder && (existingRecorder.state === "recording" || existingRecorder.state === "paused")) {
      return;
    }
    playStartChime();
    setIsListening(true);
    setTranscript("");
    setInterimText("");
    chunksRef.current = [];
    vadCleanupRef.current?.();
    vadCleanupRef.current = null;
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true
      }
    }).then((stream) => {
      if (listenSessionRef.current !== sessionId) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e2) => {
        if (e2.data.size > 0) chunksRef.current.push(e2.data);
      };
      recorder.onerror = () => {
        setIsListening(false);
        vadCleanupRef.current?.();
        vadCleanupRef.current = null;
        mediaRecorderRef.current = null;
        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) track.stop();
          streamRef.current = null;
        }
      };
      recorder.start();
      setInterimText("Recording...");
      if (onSilence && silenceTimeoutMs > 0) {
        vadCleanupRef.current = runVoiceActivityDetection(
          stream,
          silenceTimeoutMs,
          onSilence
        );
      }
    }).catch((err) => {
      if (listenSessionRef.current !== sessionId) return;
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      log$1.error("getUserMedia failed:", msg);
      setIsListening(false);
      setInterimText(msg);
    });
  }, [onSilence, silenceTimeoutMs]);
  const stopMediaTracks = reactExports.useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);
  const stopListening = reactExports.useCallback(async () => {
    if (stopPromiseRef.current) {
      return stopPromiseRef.current;
    }
    listenSessionRef.current = 0;
    const stopPromise = (async () => {
      vadCleanupRef.current?.();
      vadCleanupRef.current = null;
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        mediaRecorderRef.current = null;
        setIsListening(false);
        playStopChime();
        stopMediaTracks();
        return "";
      }
      const blob = await new Promise((resolve) => {
        recorder.onstop = () => {
          const mimeType = recorder.mimeType || "audio/webm";
          resolve(new Blob(chunksRef.current, { type: mimeType }));
        };
        recorder.stop();
      });
      mediaRecorderRef.current = null;
      playStopChime();
      setIsListening(false);
      stopMediaTracks();
      setInterimText("Transcribing...");
      if (blob.size < MIN_TRANSCRIPTION_BLOB_SIZE) {
        setTranscript("");
        setInterimText("");
        return "";
      }
      let text = "";
      try {
        const result = await transcribeAudioBlob(blob);
        text = result ?? "";
      } catch (err) {
        log$1.error("Transcription error:", err);
      }
      setTranscript(text);
      setInterimText("");
      return text;
    })();
    stopPromiseRef.current = stopPromise;
    return stopPromise.finally(() => {
      stopPromiseRef.current = null;
    });
  }, [stopMediaTracks]);
  return { isListening, transcript, interimText, startListening, stopListening };
};
const initialPillContext = {
  state: "idle",
  interactionMode: "assistant",
  transcript: "",
  responseTitle: "",
  responseLines: [],
  streamingText: "",
  meetingActive: false,
  meetingId: null,
  meetingStartedAt: null
};
const pillReducer = (ctx, action) => {
  switch (action.type) {
    case "ACTIVATE":
      if (ctx.state !== "idle")
        return {
          ...ctx,
          ...initialPillContext,
          meetingActive: ctx.meetingActive,
          meetingId: ctx.meetingId,
          meetingStartedAt: ctx.meetingStartedAt
        };
      return {
        ...ctx,
        state: "listening",
        interactionMode: action.mode,
        transcript: "",
        responseTitle: "",
        responseLines: [],
        streamingText: ""
      };
    case "DEACTIVATE":
    case "DISMISS":
      return {
        ...ctx,
        state: "idle",
        transcript: "",
        responseTitle: "",
        responseLines: [],
        streamingText: ""
      };
    case "LISTENING_COMPLETE":
      if (ctx.interactionMode === "dictation" || ctx.interactionMode === "transcribe") {
        return { ...ctx, state: "idle", transcript: action.transcript };
      }
      return { ...ctx, state: "thinking", transcript: action.transcript };
    case "COMMAND_RESULT":
      return {
        ...ctx,
        state: "response",
        responseTitle: action.title,
        responseLines: action.lines,
        streamingText: ""
      };
    case "AI_STREAMING":
      return {
        ...ctx,
        state: "thinking",
        streamingText: ctx.streamingText + action.text
      };
    case "AI_COMPLETE":
      return {
        ...ctx,
        state: "response",
        responseTitle: action.title,
        responseLines: action.lines,
        streamingText: ""
      };
    case "AI_ERROR":
      return {
        ...ctx,
        state: "response",
        responseTitle: "Error",
        responseLines: [action.message],
        streamingText: ""
      };
    case "MEETING_UPDATE":
      return {
        ...ctx,
        meetingActive: action.active,
        meetingId: action.meetingId,
        meetingStartedAt: action.startedAt
      };
    case "TRANSCRIBING_START":
      return { ...ctx, state: "transcribing" };
    case "TRANSCRIBING_COMPLETE":
      return { ...ctx, state: "idle", transcript: action.transcript };
    case "TRANSCRIBING_ERROR":
      return {
        ...ctx,
        state: "response",
        responseTitle: "Error",
        responseLines: [action.message],
        streamingText: ""
      };
    default:
      return ctx;
  }
};
const useMeetingRecorder = (_chunkIntervalMs, onError) => {
  const meetingIdRef = reactExports.useRef(null);
  const startRecording = reactExports.useCallback(
    async (mid) => {
      meetingIdRef.current = mid;
      onError?.("Meeting recording requires backend support — stubbed");
      return { micOnly: true };
    },
    [onError]
  );
  const stopRecording = reactExports.useCallback(async () => {
    const mid = meetingIdRef.current;
    meetingIdRef.current = null;
    return { meetingId: mid, transcript: "" };
  }, []);
  return { startRecording, stopRecording };
};
const useFlashMessage = () => {
  const [message, setMessage] = reactExports.useState(null);
  const timerRef = reactExports.useRef(null);
  const clear = reactExports.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);
  const show = reactExports.useCallback((msg, durationMs) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setMessage(null);
    }, durationMs);
  }, []);
  return { message, show, clear };
};
const MODULE_ROUTES = {
  tasks: "/tasks",
  task: "/tasks",
  crm: "/crm",
  contacts: "/contacts",
  deals: "/deals",
  companies: "/companies",
  hub: "/",
  assistant: "/chat",
  ai: "/chat",
  chat: "/chat",
  settings: "/settings"
};
const detectCommand = (text) => {
  const lower = text.trim().toLowerCase();
  const taskMatch = lower.match(/^(?:create|add|new) (?:a )?task[: ]+(.*)/i) ?? lower.match(/^(?:remind me to|todo)[: ]+(.*)/i);
  if (taskMatch?.[1]) return { type: "create_task", title: taskMatch[1].trim() };
  const searchMatch = lower.match(
    /^(?:search|find|look up|look for)[: ]+(.*)/i
  );
  if (searchMatch?.[1])
    return { type: "search", query: searchMatch[1].trim() };
  const openMatch = lower.match(/^(?:open|go to|show)[: ]+(\w+)/i);
  if (openMatch?.[1]) {
    const mod = openMatch[1].toLowerCase();
    const url = MODULE_ROUTES[mod];
    if (url) return { type: "navigate", module: mod, url };
  }
  return null;
};
const streamAssistantAPI = async (message, onToken, onComplete) => {
  let fullText = "";
  for await (const token of streamAssistant(message, [], {
    timeoutMs: API_STREAM_TIMEOUT_MS
  })) {
    fullText += token;
    onToken(token);
  }
  onComplete("Assistant", fullText.split("\n").filter(Boolean));
};
const useAIResponse = (pillState, transcript, dispatch, streamAbortRef) => {
  reactExports.useEffect(() => {
    if (pillState !== "thinking" || !transcript) return;
    const cmd = detectCommand(transcript);
    if (cmd) {
      switch (cmd.type) {
        case "navigate":
          dispatch({
            type: "COMMAND_RESULT",
            title: `Opening ${cmd.module}`,
            lines: ["Navigating..."]
          });
          window.electronAPI?.navigateMain?.(cmd.url);
          return;
        case "search":
          dispatch({
            type: "COMMAND_RESULT",
            title: "Searching",
            lines: [`"${cmd.query}"`, "Opening results..."]
          });
          window.electronAPI?.navigateMain?.(
            `/chat?q=${encodeURIComponent(cmd.query)}`
          );
          return;
      }
    }
    streamAbortRef.current = false;
    void streamAssistantAPI(
      transcript,
      (token) => {
        if (!streamAbortRef.current)
          dispatch({ type: "AI_STREAMING", text: token });
      },
      (title, lines) => {
        if (!streamAbortRef.current)
          dispatch({ type: "AI_COMPLETE", title, lines });
      }
    ).catch((err) => {
      if (streamAbortRef.current) return;
      dispatch({
        type: "AI_ERROR",
        message: "Assistant is unavailable. Check API/backend auth."
      });
    });
  }, [pillState, transcript, dispatch, streamAbortRef]);
};
const useActivationHandler = (deps) => {
  const { dispatch, pillRef, speechRef, dismissRef, showFlash } = deps;
  const handleActivate = reactExports.useCallback(
    (mode) => {
      const s = speechRef.current;
      if (!s) return;
      const cur = pillRef.current;
      if (cur.state !== "idle") {
        if (cur.interactionMode === "dictation" && mode === "dictation") {
          dispatch({ type: "TRANSCRIBING_START" });
          s.stopListening().then((transcript) => {
            if (transcript) {
              void window.electronAPI?.injectText?.(transcript).then(() => {
                dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
                showFlash("Copied! ⌘V to paste", FLASH_SHORT_MS);
                setTimeout(() => dismissRef.current(), FLASH_SHORT_MS);
              });
            } else {
              dismissRef.current();
            }
          });
          return;
        }
        if (cur.interactionMode === "transcribe" && mode === "transcribe") {
          dispatch({ type: "TRANSCRIBING_START" });
          s.stopListening().then((transcript) => {
            if (transcript) {
              void navigator.clipboard.writeText(transcript);
              dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
              showFlash("Copied!", FLASH_SHORT_MS);
            } else {
              dismissRef.current();
            }
          });
          return;
        }
        if (cur.interactionMode === "continuous" && mode === "continuous") {
          void s.stopListening().then((transcript) => {
            if (transcript) dispatch({ type: "LISTENING_COMPLETE", transcript });
            else dismissRef.current();
          });
          return;
        }
        if (cur.interactionMode === "assistant" && mode === "assistant" && cur.state === "listening") {
          void s.stopListening().then((transcript) => {
            if (transcript)
              dispatch({ type: "LISTENING_COMPLETE", transcript });
            else dismissRef.current();
          });
          return;
        }
        dismissRef.current();
        return;
      }
      dispatch({ type: "ACTIVATE", mode });
      s.startListening();
    },
    [dispatch, pillRef, speechRef, dismissRef, showFlash]
  );
  const handleDeactivate = reactExports.useCallback(() => {
    const s = speechRef.current;
    if (s?.isListening) {
      void s.stopListening();
    }
    dispatch({ type: "DEACTIVATE" });
  }, [dispatch, speechRef]);
  const handleHoldStart = reactExports.useCallback(() => {
    if (pillRef.current.state !== "idle") return;
    const s = speechRef.current;
    if (!s) return;
    dispatch({ type: "ACTIVATE", mode: "dictation" });
    s.startListening();
  }, [dispatch, pillRef, speechRef]);
  const handleHoldEnd = reactExports.useCallback(() => {
    const cur = pillRef.current;
    const s = speechRef.current;
    if (cur.state !== "listening" || cur.interactionMode !== "dictation" || !s)
      return;
    dispatch({ type: "TRANSCRIBING_START" });
    s.stopListening().then((transcript) => {
      if (transcript) {
        dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
        window.electronAPI?.injectText?.(transcript).then(() => showFlash("Copied! ⌘V to paste", FLASH_SHORT_MS)).catch(() => dismissRef.current());
      } else {
        dismissRef.current();
      }
    });
  }, [dispatch, pillRef, speechRef, dismissRef, showFlash]);
  return {
    handleActivate,
    handleDeactivate,
    handleHoldStart,
    handleHoldEnd
  };
};
const log = createOverlayLogger("meeting-controls");
const useMeetingControls = (deps) => {
  const { dispatch, pillRef, meetingRecorderRef, showFlash } = deps;
  const handleMeetingToggle = reactExports.useCallback(() => {
    const cur = pillRef.current;
    const api = window.electronAPI;
    if (!api) return;
    if (cur.meetingActive) {
      api.stopMeeting?.().catch((err) => log.error("stopMeeting failed:", err));
    } else {
      void (async () => {
        try {
          await api.startMeeting?.();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          showFlash("Meeting failed: " + msg, FLASH_LONG_MS);
        }
      })();
    }
  }, [pillRef, showFlash]);
  const handleMeetingStarted = reactExports.useCallback(
    (meetingId) => {
      log.info("meeting-started:", meetingId);
      dispatch({
        type: "MEETING_UPDATE",
        active: true,
        meetingId,
        startedAt: Date.now()
      });
      void (async () => {
        try {
          await meetingRecorderRef.current.startRecording(meetingId);
          showFlash("Recording (stub — no backend)", FLASH_LONG_MS);
        } catch (err) {
          log.error("Failed to start meeting recording:", err);
          showFlash("Recording failed", FLASH_LONG_MS);
          window.electronAPI?.stopMeeting?.().catch(() => void 0);
        }
      })();
    },
    [dispatch, meetingRecorderRef, showFlash]
  );
  const handleMeetingStopped = reactExports.useCallback(
    (_meetingId) => {
      log.info("meeting-stopped");
      showFlash("Saving meeting...", 5e3);
      void (async () => {
        const result = await meetingRecorderRef.current.stopRecording();
        dispatch({
          type: "MEETING_UPDATE",
          active: false,
          meetingId: null,
          startedAt: null
        });
        if (result.meetingId && result.transcript) {
          showFlash("Meeting saved", FLASH_MEDIUM_MS);
        } else {
          showFlash("Meeting ended (stub — no transcript)", FLASH_MEDIUM_MS);
        }
      })();
    },
    [dispatch, meetingRecorderRef, showFlash]
  );
  const handleSystemAudioTranscript = reactExports.useCallback(
    (speaker, text) => {
      log.debug(speaker !== void 0 ? `Speaker ${speaker}` : "System", text);
    },
    []
  );
  const restoreMeetingState = reactExports.useCallback(() => {
    window.electronAPI?.getMeetingState?.().then((state) => {
      if (state?.active && state.meetingId) {
        dispatch({
          type: "MEETING_UPDATE",
          active: true,
          meetingId: state.meetingId,
          startedAt: state.startedAt ?? null
        });
        void meetingRecorderRef.current.startRecording(state.meetingId).catch(() => void 0);
      }
    });
  }, [dispatch, meetingRecorderRef]);
  const restorePersistedMeeting = reactExports.useCallback(() => {
    window.electronAPI?.getPersistedMeeting?.().then((persisted) => {
      if (persisted) {
        dispatch({
          type: "MEETING_UPDATE",
          active: true,
          meetingId: persisted.meetingId,
          startedAt: persisted.startedAt
        });
        showFlash("Meeting resumed", FLASH_MEDIUM_MS);
      }
    });
  }, [dispatch, showFlash]);
  return {
    handleMeetingToggle,
    handleMeetingStarted,
    handleMeetingStopped,
    handleSystemAudioTranscript,
    restoreMeetingState,
    restorePersistedMeeting
  };
};
const SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 35,
  mass: 0.8
};
const CONTENT_ENTER = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1]
};
const CONTENT_EXIT = { duration: 0.12 };
const STAGGER_MS = 80;
const ACTIVE_HEIGHT = 48;
const Sparkle = ({ active }) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  motion.div,
  {
    animate: active ? { scale: [1, 1.2, 1], rotate: [0, 15, 0] } : { scale: [1, 1.06, 1], opacity: [0.4, 0.7, 0.4] },
    transition: {
      duration: active ? 0.5 : 2.8,
      repeat: active ? 0 : Infinity,
      ease: "easeInOut"
    },
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      width: 14,
      height: 14
    },
    children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      "path",
      {
        d: "M8 0C8.3 4.5 11.5 7.7 16 8C11.5 8.3 8.3 11.5 8 16C7.7 11.5 4.5 8.3 0 8C4.5 7.7 7.7 4.5 8 0Z",
        fill: "var(--overlay-text-primary)",
        fillOpacity: active ? 1 : 0.55
      }
    ) })
  }
);
const PencilIcon = () => /* @__PURE__ */ jsxRuntimeExports.jsxs(
  "svg",
  {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--overlay-text-primary)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { flexShrink: 0 },
    children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "m15 5 4 4" })
    ]
  }
);
const MicIcon = () => /* @__PURE__ */ jsxRuntimeExports.jsxs(
  "svg",
  {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--overlay-text-primary)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { flexShrink: 0 },
    children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "12", x2: "12", y1: "19", y2: "22" })
    ]
  }
);
const CompanyLogo = () => {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    motion.div,
    {
      animate: { opacity: [0.45, 0.75, 0.45] },
      transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 15,
        height: 15
      },
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(e, { size: 13, weight: "fill", color: "var(--overlay-text-secondary)" })
    }
  );
};
const Waveform = () => {
  const [heights, setHeights] = reactExports.useState([4, 8, 6, 10, 5]);
  reactExports.useEffect(() => {
    const iv = setInterval(
      () => setHeights(Array.from({ length: 5 }, () => 3 + Math.random() * 13)),
      100
    );
    return () => clearInterval(iv);
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", alignItems: "center", gap: 2, height: 16 }, children: heights.map((h, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
    motion.div,
    {
      animate: { height: h },
      transition: {
        type: "spring",
        stiffness: 600,
        damping: 20,
        mass: 0.3
      },
      style: {
        width: 2,
        borderRadius: 1,
        background: "var(--overlay-text-secondary)"
      }
    },
    i
  )) });
};
const ThinkingDots = () => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: 4, alignItems: "center" }, children: [0, 1, 2].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  motion.div,
  {
    animate: { opacity: [0.2, 1, 0.2] },
    transition: {
      duration: 1.2,
      repeat: Infinity,
      delay: i * 0.2,
      ease: "easeInOut"
    },
    style: {
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: "var(--overlay-text-primary)"
    }
  },
  i
)) });
const ResponseBody = ({
  response
}) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
  /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      style: {
        color: "var(--overlay-text-primary)",
        fontSize: "var(--overlay-font-lg)",
        lineHeight: 1.5,
        fontWeight: 400
      },
      children: response.lines[0]
    }
  ),
  response.lines.slice(1).map((line, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      style: {
        color: "var(--overlay-text-secondary)",
        fontSize: "var(--overlay-font-md)",
        lineHeight: 1.5,
        marginTop: 2
      },
      children: line
    },
    `${response.title}-${i}`
  ))
] });
const MeetingTimer = ({
  startedAt
}) => {
  const [elapsed, setElapsed] = reactExports.useState(0);
  reactExports.useEffect(() => {
    if (!startedAt) return;
    const iv = setInterval(() => setElapsed(Date.now() - startedAt), 1e3);
    return () => clearInterval(iv);
  }, [startedAt]);
  if (!startedAt) return null;
  const totalSec = Math.floor(elapsed / 1e3);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "span",
    {
      style: {
        color: "var(--overlay-text-muted)",
        fontSize: "var(--overlay-font-sm)",
        fontVariantNumeric: "tabular-nums"
      },
      children: [
        min,
        ":",
        sec.toString().padStart(2, "0")
      ]
    }
  );
};
const DEFAULT_SETTINGS = {
  shortcuts: {
    assistantToggle: "CommandOrControl+Space",
    dictationToggle: "CommandOrControl+Shift+Space",
    dictationHoldKey: "CommandOrControl+Shift+Space",
    meetingToggle: "CommandOrControl+Alt+Space"
  },
  voice: {
    language: "en-US",
    silenceTimeoutMs: 2e3,
    ttsEnabled: true,
    ttsRate: 1.05
  },
  behavior: {
    doubleTapWindowMs: 400,
    autoDismissMs: 5e3,
    showDictationPreview: true,
    holdThresholdMs: 150
  },
  meeting: { autoDetect: false, chunkIntervalMs: 5e3 }
};
const OverlayApp = () => {
  const [config, setConfig] = reactExports.useState(null);
  const [pill, dispatch] = reactExports.useReducer(pillReducer, initialPillContext);
  const [settings, setSettings] = reactExports.useState(DEFAULT_SETTINGS);
  const [measuredHeight, setMeasuredHeight] = reactExports.useState(0);
  const measureRef = reactExports.useRef(null);
  const dismissTimerRef = reactExports.useRef(null);
  const streamAbortRef = reactExports.useRef(false);
  const flash = useFlashMessage();
  const handleRecorderError = reactExports.useCallback(
    (msg) => flash.show(msg, 3e3),
    [flash]
  );
  const meetingRecorder = useMeetingRecorder(
    settings.meeting?.chunkIntervalMs ?? 5e3,
    handleRecorderError
  );
  const meetingRecorderRef = reactExports.useRef(meetingRecorder);
  meetingRecorderRef.current = meetingRecorder;
  const pillRef = reactExports.useRef(pill);
  pillRef.current = pill;
  const speechRef = reactExports.useRef(null);
  const settingsRef = reactExports.useRef(settings);
  settingsRef.current = settings;
  const clearDismissTimer = reactExports.useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);
  const dismissRef = reactExports.useRef(() => {
  });
  dismissRef.current = () => {
    cancel();
    clearDismissTimer();
    streamAbortRef.current = true;
    const s = speechRef.current;
    if (s?.isListening) {
      void s.stopListening();
    }
    dispatch({ type: "DISMISS" });
    window.electronAPI?.notifyDismissed?.();
  };
  const dismiss = reactExports.useCallback(() => dismissRef.current(), []);
  const activation = useActivationHandler({
    dispatch,
    pillRef,
    speechRef,
    dismissRef,
    showFlash: flash.show
  });
  const meeting = useMeetingControls({
    dispatch,
    pillRef,
    meetingRecorderRef,
    showFlash: flash.show
  });
  useAIResponse(pill.state, pill.transcript, dispatch, streamAbortRef);
  const handleSilence = reactExports.useCallback(() => {
    const p = pillRef.current;
    const s = speechRef.current;
    if (p.interactionMode !== "assistant" || p.state !== "listening" || !s)
      return;
    void s.stopListening().then((transcript) => {
      if (transcript) {
        dispatch({ type: "LISTENING_COMPLETE", transcript });
      } else {
        dismissRef.current();
      }
    });
  }, []);
  const speech = useSpeechRecognition({
    onSilence: handleSilence,
    silenceTimeoutMs: settings.voice.silenceTimeoutMs
  });
  speechRef.current = speech;
  reactExports.useEffect(() => {
    clearDismissTimer();
    if (pill.state === "response") {
      dismissTimerRef.current = setTimeout(
        dismiss,
        settings.behavior.autoDismissMs
      );
    }
    return clearDismissTimer;
  }, [pill.state, settings.behavior.autoDismissMs, dismiss, clearDismissTimer]);
  reactExports.useEffect(() => {
    const mode = pill.interactionMode;
    if (pill.state === "response" && settingsRef.current.voice.ttsEnabled && (mode === "assistant" || mode === "continuous")) {
      const text = pill.responseLines.join(". ");
      if (text) void speak(text, { rate: settingsRef.current.voice.ttsRate });
    }
  }, [pill.state, pill.responseLines, pill.interactionMode]);
  reactExports.useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.removeAllListeners?.();
    api.getOverlaySettings?.().then((s) => setSettings(s)).catch(() => {
    });
    api.onNotchInfo?.((info) => setConfig(info));
    api.onSettingsChanged?.((s) => setSettings(s));
    api.onActivate?.(activation.handleActivate);
    api.onDeactivate?.(activation.handleDeactivate);
    api.onHoldStart?.(activation.handleHoldStart);
    api.onHoldEnd?.(activation.handleHoldEnd);
    api.onMeetingToggle?.(meeting.handleMeetingToggle);
    api.onMeetingStarted?.(meeting.handleMeetingStarted);
    api.onMeetingStopped?.(meeting.handleMeetingStopped);
    api.onSystemAudioTranscript?.(meeting.handleSystemAudioTranscript);
    meeting.restoreMeetingState();
    meeting.restorePersistedMeeting();
    return () => {
      api.removeAllListeners?.();
    };
  }, []);
  reactExports.useEffect(() => {
    if (pill.state === "idle") {
      cancel();
      window.electronAPI?.notifyDismissed?.();
    }
  }, [pill.state]);
  reactExports.useEffect(() => {
    const onKey = (e2) => {
      if (e2.key === "Escape" && pillRef.current.state !== "idle") {
        e2.preventDefault();
        dismissRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  reactExports.useEffect(() => {
    if (pill.state === "response" && measureRef.current) {
      const h = measureRef.current.offsetHeight;
      if (h > 0) setMeasuredHeight(h);
    }
  }, [pill.state, pill.responseTitle]);
  const hasNotch = config?.hasNotch ?? false;
  const notchHeight = config?.notchHeight ?? 0;
  const menuBarHeight = config?.menuBarHeight ?? 25;
  const windowWidth = config?.windowWidth ?? 400;
  const topPad = hasNotch ? notchHeight + 2 : 3;
  let pillHeight;
  if (pill.state === "idle") {
    pillHeight = menuBarHeight;
  } else if (pill.state === "response") {
    pillHeight = topPad + 24 + 12 + measuredHeight + 12;
  } else {
    pillHeight = topPad + ACTIVE_HEIGHT;
  }
  const currentResponse = {
    title: pill.responseTitle,
    lines: pill.responseLines
  };
  const modeIcon = () => {
    switch (pill.interactionMode) {
      case "dictation":
        return /* @__PURE__ */ jsxRuntimeExports.jsx(PencilIcon, {});
      case "transcribe":
        return /* @__PURE__ */ jsxRuntimeExports.jsx(MicIcon, {});
      default:
        return /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkle, { active: true });
    }
  };
  const modeLabel = () => {
    switch (pill.interactionMode) {
      case "assistant":
        return "Listening...";
      case "continuous":
        return "Listening (continuous)...";
      case "dictation":
        return "Dictating...";
      case "transcribe":
        return "Transcribing...";
    }
  };
  const modeDetail = () => {
    if (pill.interactionMode === "continuous" && speech.transcript) {
      const words = speech.transcript.split(/\s+/).length;
      return `${words} word${words === 1 ? "" : "s"}`;
    }
    if ((pill.interactionMode === "dictation" || pill.interactionMode === "transcribe") && speech.interimText) {
      return speech.interimText;
    }
    return null;
  };
  const handleMouseEnter = reactExports.useCallback(() => setIgnoreMouse(false), []);
  const handleMouseLeave = reactExports.useCallback(() => setIgnoreMouse(true), []);
  const handlePillClick = reactExports.useCallback(() => {
    const cur = pillRef.current;
    const s = speechRef.current;
    if (cur.state === "idle") {
      if (!s) return;
      dispatch({ type: "ACTIVATE", mode: "dictation" });
      s.startListening();
    } else if (cur.state === "listening" && cur.interactionMode === "dictation") {
      if (!s) return;
      dispatch({ type: "TRANSCRIBING_START" });
      s.stopListening().then((transcript) => {
        if (transcript) {
          window.electronAPI?.injectText?.(transcript).then(() => {
            dispatch({ type: "TRANSCRIBING_COMPLETE", transcript });
            flash.show("Copied! ⌘V to paste", FLASH_SHORT_MS);
            setTimeout(() => dismissRef.current(), FLASH_SHORT_MS);
          }).catch(() => dismissRef.current());
        } else {
          dismissRef.current();
        }
      });
    } else {
      dismissRef.current();
    }
  }, [flash]);
  const handleCloseOverlay = reactExports.useCallback((e2) => {
    e2.stopPropagation();
    window.electronAPI?.hideOverlay?.();
    dismissRef.current();
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { width: "100%", display: "flex", justifyContent: "center" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        ref: measureRef,
        "aria-hidden": "true",
        style: {
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          width: windowWidth - 32,
          paddingLeft: 22
        },
        children: pill.state === "response" && /* @__PURE__ */ jsxRuntimeExports.jsx(ResponseBody, { response: currentResponse })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      motion.div,
      {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onClick: handlePillClick,
        animate: { height: pillHeight },
        transition: SPRING,
        style: {
          width: "100%",
          background: "var(--overlay-pill-bg)",
          borderRadius: pill.state === "idle" ? `0 0 var(--overlay-radius-idle) var(--overlay-radius-idle)` : `0 0 var(--overlay-radius-active) var(--overlay-radius-active)`,
          overflow: "hidden",
          position: "relative",
          cursor: pill.state === "idle" ? "pointer" : "default"
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              "aria-label": "Close overlay",
              onClick: handleCloseOverlay,
              style: {
                position: "absolute",
                top: pill.state === "idle" ? 3 : topPad + 3,
                right: 8,
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "none",
                background: "var(--overlay-close-bg)",
                color: "var(--overlay-text-primary)",
                fontSize: 12,
                lineHeight: "18px",
                cursor: "pointer",
                zIndex: 2
              },
              onMouseEnter: (e2) => {
                e2.currentTarget.style.background = "var(--overlay-close-bg-hover)";
              },
              onMouseLeave: (e2) => {
                e2.currentTarget.style.background = "var(--overlay-close-bg)";
              },
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(e$1, { size: 10, weight: "bold", "aria-hidden": "true" })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              style: {
                paddingTop: pill.state === "idle" ? 0 : topPad,
                paddingLeft: 16,
                paddingRight: 30,
                paddingBottom: pill.state === "idle" ? 0 : 12
              },
              children: [
                pill.state === "idle" && !flash.message && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      height: menuBarHeight,
                      gap: 6
                    },
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(CompanyLogo, {}),
                      pill.meetingActive && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          motion.div,
                          {
                            animate: { opacity: [1, 0.3, 1] },
                            transition: {
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "easeInOut"
                            },
                            style: {
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "var(--overlay-accent-danger)",
                              flexShrink: 0
                            }
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(MeetingTimer, { startedAt: pill.meetingStartedAt })
                      ] })
                    ]
                  }
                ),
                pill.state === "idle" && flash.message && /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      height: menuBarHeight
                    },
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      motion.span,
                      {
                        initial: { opacity: 0, y: 4 },
                        animate: { opacity: 1, y: 0 },
                        style: {
                          color: "var(--overlay-accent-success)",
                          fontSize: "var(--overlay-font-md)",
                          fontWeight: 600
                        },
                        children: flash.message
                      }
                    )
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(AnimatePresence, { mode: "wait", children: [
                  pill.state === "listening" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    motion.div,
                    {
                      initial: { opacity: 0, y: 6 },
                      animate: { opacity: 1, y: 0 },
                      exit: { opacity: 0 },
                      transition: CONTENT_ENTER,
                      style: {
                        display: "flex",
                        alignItems: "center",
                        height: 24,
                        gap: 8
                      },
                      children: [
                        modeIcon(),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          "div",
                          {
                            style: {
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              minWidth: 0
                            },
                            children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx(
                                "span",
                                {
                                  style: {
                                    color: "var(--overlay-text-primary)",
                                    fontSize: "var(--overlay-font-lg)",
                                    fontWeight: 500,
                                    letterSpacing: "-0.01em"
                                  },
                                  children: modeLabel()
                                }
                              ),
                              modeDetail() && /* @__PURE__ */ jsxRuntimeExports.jsx(
                                "span",
                                {
                                  style: {
                                    color: "var(--overlay-text-muted)",
                                    fontSize: "var(--overlay-font-sm)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                  },
                                  children: modeDetail()
                                }
                              )
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Waveform, {})
                      ]
                    },
                    "listening"
                  ),
                  pill.state === "thinking" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    motion.div,
                    {
                      initial: { opacity: 0, y: 6 },
                      animate: { opacity: 1, y: 0 },
                      exit: { opacity: 0 },
                      transition: CONTENT_ENTER,
                      style: {
                        display: "flex",
                        alignItems: "center",
                        height: 24,
                        gap: 8
                      },
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkle, { active: true }),
                        pill.streamingText ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "span",
                          {
                            style: {
                              color: "var(--overlay-text-secondary)",
                              fontSize: "var(--overlay-font-md)",
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            },
                            children: pill.streamingText.slice(-80)
                          }
                        ) : /* @__PURE__ */ jsxRuntimeExports.jsx(ThinkingDots, {})
                      ]
                    },
                    "thinking"
                  ),
                  pill.state === "transcribing" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    motion.div,
                    {
                      initial: { opacity: 0, y: 6 },
                      animate: { opacity: 1, y: 0 },
                      exit: { opacity: 0 },
                      transition: CONTENT_ENTER,
                      style: {
                        display: "flex",
                        alignItems: "center",
                        height: 24,
                        gap: 8
                      },
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(ThinkingDots, {}),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "span",
                          {
                            style: {
                              color: "var(--overlay-text-secondary)",
                              fontSize: "var(--overlay-font-lg)",
                              fontWeight: 500
                            },
                            children: "Transcribing..."
                          }
                        )
                      ]
                    },
                    "transcribing"
                  ),
                  pill.state === "response" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    motion.div,
                    {
                      initial: { opacity: 0 },
                      animate: { opacity: 1 },
                      exit: { opacity: 0 },
                      transition: CONTENT_EXIT,
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          motion.div,
                          {
                            initial: { opacity: 0, y: 6 },
                            animate: { opacity: 1, y: 0 },
                            transition: { ...CONTENT_ENTER, delay: 0 },
                            style: {
                              display: "flex",
                              alignItems: "center",
                              height: 24,
                              gap: 8
                            },
                            children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkle, { active: true }),
                              /* @__PURE__ */ jsxRuntimeExports.jsx(
                                "span",
                                {
                                  style: {
                                    color: "var(--overlay-text-primary)",
                                    fontSize: "var(--overlay-font-lg)",
                                    fontWeight: 600,
                                    letterSpacing: "-0.01em"
                                  },
                                  children: currentResponse.title
                                }
                              )
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          motion.div,
                          {
                            initial: { opacity: 0, y: 6 },
                            animate: { opacity: 1, y: 0 },
                            transition: {
                              ...CONTENT_ENTER,
                              delay: STAGGER_MS / 1e3
                            },
                            style: { marginTop: 8, paddingLeft: 22 },
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx(ResponseBody, { response: currentResponse })
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          motion.div,
                          {
                            initial: { opacity: 0 },
                            animate: { opacity: 0.35 },
                            transition: {
                              ...CONTENT_ENTER,
                              delay: STAGGER_MS * 2 / 1e3
                            },
                            style: {
                              textAlign: "right",
                              marginTop: 6,
                              fontSize: "var(--overlay-font-sm)",
                              color: "var(--overlay-text-done)"
                            },
                            children: "Done"
                          }
                        )
                      ]
                    },
                    `response-${pill.responseTitle}`
                  )
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: {
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "50%",
                height: 1,
                background: "linear-gradient(90deg, transparent, var(--overlay-line-soft), transparent)"
              }
            }
          )
        ]
      }
    )
  ] });
};
const root = document.getElementById("root");
if (root) {
  clientExports.createRoot(root).render(
    /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(OverlayApp, {}) })
  );
}
