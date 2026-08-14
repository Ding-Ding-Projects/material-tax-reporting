"use client";

/**
 * Read-aloud, over the browser's own speech synthesis.
 *
 * The kernel owns the queue and the strict English-then-Cantonese ordering.
 * This module implements `NarrationHost` on top of `window.speechSynthesis`,
 * adds no dependency, and enumerates only the voices the browser actually
 * reports.
 *
 * Narration starts only from an explicit control. Nothing is spoken on load,
 * and the kernel's exclusion list is honoured for field kinds that should never
 * be read within earshot of somebody else.
 */

import {
  type LanguageMode,
  type NarrationHost,
  type NarrationPreferences,
  type VoiceDescriptor,
  NarrationQueue,
  bilingualSegments,
  mayNarrate,
} from "@material-tax-reporting/surface-kernel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Used when no real voice is reported for a language. */
const LANGUAGE_ONLY_PREFIX = "language:";

export const ENGLISH_FALLBACK_VOICE = `${LANGUAGE_ONLY_PREFIX}en-CA`;
export const CANTONESE_FALLBACK_VOICE = `${LANGUAGE_ONLY_PREFIX}zh-HK`;

function speechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return "speechSynthesis" in window ? window.speechSynthesis : null;
}

function describeVoice(voice: SpeechSynthesisVoice): VoiceDescriptor {
  return { id: voice.voiceURI, label: `${voice.name} (${voice.lang})`, lang: voice.lang };
}

class SpeechSynthesisNarrationHost implements NarrationHost {
  readonly #synthesis: SpeechSynthesis;

  constructor(synthesis: SpeechSynthesis) {
    this.#synthesis = synthesis;
  }

  listVoices(): VoiceDescriptor[] {
    return this.#synthesis.getVoices().map(describeVoice);
  }

  speak(text: string, voiceId: string | null, rate: number, pitch: number, onEnd: () => void): void {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    if (voiceId !== null && voiceId.startsWith(LANGUAGE_ONLY_PREFIX)) {
      utterance.lang = voiceId.slice(LANGUAGE_ONLY_PREFIX.length);
    } else if (voiceId !== null) {
      const match = this.#synthesis.getVoices().find((voice) => voice.voiceURI === voiceId);
      if (match) {
        utterance.voice = match;
        utterance.lang = match.lang;
      }
    }
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
    this.#synthesis.speak(utterance);
  }

  cancel(): void {
    this.#synthesis.cancel();
  }
}

export type NarrationApi = {
  /** True only when speech synthesis exists and reported at least one voice. */
  available: boolean;
  /** Exactly what the browser reported, for the disabled state. */
  statusMessage: string;
  voices: VoiceDescriptor[];
  englishVoices: VoiceDescriptor[];
  cantoneseVoices: VoiceDescriptor[];
  speaking: boolean;
  read: (en: string, zh: string, fieldKind?: string) => void;
  cancel: () => void;
};

function isEnglish(voice: VoiceDescriptor): boolean {
  return voice.lang.toLowerCase().startsWith("en");
}

function isCantonese(voice: VoiceDescriptor): boolean {
  const lang = voice.lang.toLowerCase();
  return lang.startsWith("yue") || lang.startsWith("zh");
}

export function useNarration(
  preferences: NarrationPreferences,
  language: LanguageMode,
): NarrationApi {
  const [voices, setVoices] = useState<VoiceDescriptor[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Read-aloud has not been checked in this browser yet.",
  );
  const queueRef = useRef<NarrationQueue | null>(null);
  const hostRef = useRef<SpeechSynthesisNarrationHost | null>(null);

  useEffect(() => {
    const synthesis = speechSynthesis();
    if (!synthesis) {
      setStatusMessage("This browser did not expose speech synthesis, so read-aloud is unavailable.");
      setVoices([]);
      return;
    }
    const host = new SpeechSynthesisNarrationHost(synthesis);
    hostRef.current = host;
    queueRef.current = new NarrationQueue(host);

    const refresh = () => {
      const reported = host.listVoices();
      setVoices(reported);
      setStatusMessage(
        reported.length === 0
          ? "This browser reported no installed voices, so read-aloud is unavailable."
          : `This browser reported ${reported.length} voice${reported.length === 1 ? "" : "s"}.`,
      );
    };
    refresh();
    synthesis.addEventListener("voiceschanged", refresh);
    return () => {
      synthesis.removeEventListener("voiceschanged", refresh);
      queueRef.current?.cancel();
      queueRef.current = null;
      hostRef.current = null;
    };
  }, []);

  const englishVoices = useMemo(() => voices.filter(isEnglish), [voices]);
  const cantoneseVoices = useMemo(() => voices.filter(isCantonese), [voices]);

  const resolved = useMemo<NarrationPreferences>(() => {
    const english =
      preferences.englishVoiceId && voices.some((voice) => voice.id === preferences.englishVoiceId)
        ? preferences.englishVoiceId
        : (englishVoices[0]?.id ?? ENGLISH_FALLBACK_VOICE);
    const cantonese =
      preferences.cantoneseVoiceId &&
      voices.some((voice) => voice.id === preferences.cantoneseVoiceId)
        ? preferences.cantoneseVoiceId
        : (cantoneseVoices[0]?.id ?? CANTONESE_FALLBACK_VOICE);
    return { ...preferences, englishVoiceId: english, cantoneseVoiceId: cantonese };
  }, [cantoneseVoices, englishVoices, preferences, voices]);

  const cancel = useCallback(() => {
    queueRef.current?.cancel();
    setSpeaking(false);
  }, []);

  const read = useCallback(
    (en: string, zh: string, fieldKind = "documentation") => {
      const queue = queueRef.current;
      if (!queue || !mayNarrate(fieldKind)) return;
      const segments = bilingualSegments(
        language === "zh" ? "" : en,
        language === "en" ? "" : zh,
        resolved,
      );
      if (segments.length === 0) return;
      setSpeaking(true);
      queue.enqueue(segments);
      // The queue reports completion through the host callback; polling the
      // synthesis object is the only way a browser exposes "finished".
      const synthesis = speechSynthesis();
      if (!synthesis) return;
      const poll = window.setInterval(() => {
        if (!synthesis.speaking && !synthesis.pending) {
          window.clearInterval(poll);
          setSpeaking(false);
        }
      }, 400);
    },
    [language, resolved],
  );

  return {
    available: voices.length > 0,
    statusMessage,
    voices,
    englishVoices,
    cantoneseVoices,
    speaking,
    read,
    cancel,
  };
}
