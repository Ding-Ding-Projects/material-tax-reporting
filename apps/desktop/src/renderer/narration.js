'use strict';

/**
 * Read-aloud narration.
 *
 * The browser engine already provides speech synthesis, so the only privileged
 * dependency is persisting the choice. Narration is off by default, voices are
 * enumerated from what is actually installed, and when no voice exists for a
 * language the surface says so instead of silently speaking in another one.
 *
 * Identifiers, mailing addresses, unlock answers and attachment display names
 * are never read aloud. That exclusion is stated in the setting's own
 * supporting text and enforced by the shared kernel rule.
 */

import { NARRATION_EXCLUSIONS, NarrationQueue, bilingualSegments, mayNarrate } from '@material-tax-reporting/surface-kernel';
import { el } from './dom.js';

const SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

function voiceList() {
  if (!SUPPORTED) return [];
  return window.speechSynthesis.getVoices().map((voice) => ({ id: voice.voiceURI, label: voice.name, lang: voice.lang }));
}

function isEnglish(voice) {
  return /^en\b/i.test(voice.lang);
}

function isCantonese(voice) {
  return /^(yue|zh-hk|zh-yue)/i.test(voice.lang);
}

export function createNarrator({ getPreferences, updatePreference }) {
  const host = {
    listVoices: voiceList,
    speak(text, voiceId, rate, pitch, onEnd) {
      if (!SUPPORTED) { onEnd(); return; }
      const utterance = new SpeechSynthesisUtterance(text);
      const match = window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === voiceId);
      if (match) utterance.voice = match;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.addEventListener('end', onEnd);
      utterance.addEventListener('error', onEnd);
      window.speechSynthesis.speak(utterance);
    },
    cancel() { if (SUPPORTED) window.speechSynthesis.cancel(); },
  };
  const queue = new NarrationQueue(host);

  /**
   * Speaks one announcement. `fieldKind` names what the text belongs to, so an
   * excluded kind is refused before anything is queued.
   */
  function speak({ en, zh, fieldKind = 'announcement' }) {
    const preferences = getPreferences();
    if (!preferences.narration.enabled || !SUPPORTED) return { spoken: false, reason: SUPPORTED ? 'Read aloud is off.' : 'This build has no speech engine available.' };
    if (!mayNarrate(fieldKind)) return { spoken: false, reason: `Content of the kind "${fieldKind}" is never read aloud.` };
    const mode = preferences.language;
    const segments = bilingualSegments(mode === 'zh' ? '' : en, mode === 'en' ? '' : zh, preferences.narration);
    if (segments.length === 0) return { spoken: false, reason: 'There was nothing to read.' };
    queue.enqueue(segments);
    return { spoken: true, reason: null };
  }

  function stop() { queue.cancel(); }

  /** The settings controls for narration, including honest voice reporting. */
  function renderControls() {
    const preferences = getPreferences();
    const voices = voiceList();
    const english = voices.filter(isEnglish);
    const cantonese = voices.filter(isCantonese);
    const container = el('div', { class: 'narration-controls', id: 'setting-narration', 'data-appearance-id': 'setting-narration' });
    container.append(
      el('label', { class: 'inline-check', for: 'setting-narration-input' }, [
        el('input', {
          id: 'setting-narration-input',
          type: 'checkbox',
          checked: preferences.narration.enabled,
          onChange: (event) => updatePreference({ narration: { ...preferences.narration, enabled: event.target.checked } }),
        }),
        el('span', { text: 'Read questions, validation messages and notices aloud' }),
      ]),
      el('p', { class: 'supporting', text: SUPPORTED ? 'Read aloud is off until you turn it on.' : 'This build reports no speech engine, so read aloud cannot start.' }),
      el('p', { class: 'supporting', text: `These are never read aloud: ${NARRATION_EXCLUSIONS.join(', ')}. That covers the Social Insurance Number field, any mailing address, an unlock answer and an attachment display name.` }),
    );
    for (const [language, list, key] of [['English', english, 'englishVoiceId'], ['Cantonese', cantonese, 'cantoneseVoiceId']]) {
      const id = `setting-narration-${key}`;
      if (list.length === 0) {
        container.append(el('p', { class: 'supporting', text: `No ${language} voice is installed on this computer, so ${language} is not read aloud. Nothing is spoken in another language instead.` }));
        continue;
      }
      container.append(el('label', { for: id }, [`${language} voice`, el('select', {
        id,
        onChange: (event) => updatePreference({ narration: { ...getPreferences().narration, [key]: event.target.value || null } }),
      }, [el('option', { value: '', text: 'No voice' }), ...list.map((voice) => el('option', { value: voice.id, selected: voice.id === preferences.narration[key], text: `${voice.label} (${voice.lang})` }))])]));
    }
    for (const [label, key, min, max] of [['Speaking rate', 'rate', 0.5, 2], ['Pitch', 'pitch', 0.5, 2]]) {
      const id = `setting-narration-${key}`;
      container.append(el('label', { for: id }, [label, el('input', {
        id,
        type: 'range',
        min: String(min),
        max: String(max),
        step: '0.1',
        value: String(preferences.narration[key]),
        onChange: (event) => updatePreference({ narration: { ...getPreferences().narration, [key]: Number(event.target.value) } }),
      })]));
    }
    container.append(el('button', { type: 'button', class: 'text-button', onClick: stop }, 'Stop reading'));
    return container;
  }

  if (SUPPORTED) window.speechSynthesis.addEventListener?.('voiceschanged', () => {});

  return { speak, stop, renderControls, supported: SUPPORTED };
}
