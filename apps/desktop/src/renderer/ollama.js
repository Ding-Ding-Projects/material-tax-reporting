'use strict';

/**
 * The local model destination.
 *
 * The shared package holds the suite state and performs the privileged work in
 * the main process. This module only draws the state it receives, using the
 * application's own chrome, so no controls are duplicated.
 *
 * Every honest unavailable state the contract names is rendered: an unreachable
 * runtime, an empty catalogue cache, a stale or incomplete refresh, an unknown
 * hardware verdict, an empty installed list, undetected executables, and
 * blockers on the cart and on a harness pre-flight.
 */

import { el, confirmDialog, formatBytes } from './dom.js';
import { createSearchField } from './regex-builder.js';

const SCOPE_LABELS = {
  catalog: 'Search the official catalogue',
  installed: 'Search installed models',
  queue: 'Search the download queue',
  'chat-history': 'Search this conversation',
  'harness-profiles': 'Search harness profiles',
  'harness-snapshots': 'Search recorded snapshots',
};

export function createOllamaView({ api, container, notify }) {
  let state = null;
  let descriptors = { tabs: [], cartDisclosure: '', deletionGate: { confirmationKeys: 2, requiresCompletionSlider: true }, boundary: '' };
  const fields = new Map();

  const body = el('div', { class: 'ollama-body' });
  const tabStrip = el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Local model sections' });
  const boundaryNote = el('p', { class: 'supporting' });

  function fieldFor(scope) {
    if (!fields.has(scope)) {
      fields.set(scope, createSearchField({
        id: `ollama-${scope}`,
        label: SCOPE_LABELS[scope] || scope,
        placeholder: 'Type part of a name',
        onChange: (next) => api.ollama.action({ name: 'set-search', scope, patch: next }).then(apply),
      }));
    }
    return fields.get(scope);
  }

  function apply(result) {
    if (result?.ok) {
      state = result.data.state;
      descriptors = result.data.descriptors || descriptors;
      render();
    } else if (result?.error) {
      notify(result.error.code || 'Local model action failed', `${result.error.message}${result.error.recovery ? ` ${result.error.recovery}` : ''}`, 'error');
    }
    return result;
  }

  function receiveState(next) {
    state = next;
    render();
  }

  function searchStatusBlock(scope, status) {
    if (!status) return null;
    return el('div', { class: 'search-status' }, [
      el('p', { class: 'supporting', text: status.description }),
      status.error ? el('p', { class: 'error-text', text: status.error }) : null,
      el('p', { class: 'supporting', text: `${status.visibleCount} of ${status.totalCount} shown. ${status.sampleFeedback}` }),
    ]);
  }

  function runtimeBlock() {
    const runtime = state.runtime;
    const branch = state.troubleshooter.branches.find((entry) => entry.active);
    return el('section', { class: 'card', id: 'ollama-runtime', 'data-appearance-id': 'ollama-runtime' }, [
      el('h2', { text: 'Local runtime' }),
      el('p', { text: runtime.message }),
      el('p', { class: 'supporting', text: `Health: ${runtime.health}. ${runtime.version ? `Version ${runtime.version}.` : 'No version reported.'} ${runtime.checkedAt ? `Checked at ${runtime.checkedAt}.` : 'Not checked yet.'}` }),
      runtime.health === 'missing-or-stopped'
        ? el('p', { class: 'supporting', text: 'The local interface alone cannot tell an absent installation apart from a stopped service, so neither is claimed.' })
        : null,
      runtime.failingChecks.length > 0
        ? el('ul', { class: 'match-list' }, runtime.failingChecks.map((check) => el('li', { text: check })))
        : null,
      branch
        ? el('div', { class: 'troubleshooter' }, [
          el('h3', { text: branch.title }),
          el('p', { text: branch.summary }),
          el('p', { class: 'supporting', text: branch.offlineNextStep }),
          el('button', { type: 'button', class: 'tonal', onClick: () => api.ollama.runtimeStatus().then(apply) }, branch.recheckLabel),
        ])
        : null,
      runtime.health !== 'healthy'
        ? el('p', { class: 'supporting', text: 'While the runtime is unreachable the installed and running lists are empty by design, not because nothing is installed.' })
        : null,
    ]);
  }

  function recoveryBlock(recovery) {
    if (!recovery) return null;
    return el('div', { class: 'recovery' }, [
      el('p', { text: recovery.message }),
      el('button', { type: 'button', class: 'tonal', onClick: () => api.ollama.action({ name: 'apply-recovery', recovery }).then(apply) }, recovery.actionLabel),
    ]);
  }

  function storeTab() {
    const catalog = state.catalog;
    const field = fieldFor('catalog');
    const rows = catalog.visibleVariants.map((variant) => {
      const fit = state.fitByReference[variant.reference];
      return el('article', { class: 'model-row', 'data-appearance-id': 'model-row' }, [
        el('div', {}, [
          el('strong', { text: variant.displayLabel }),
          el('p', { class: 'supporting', text: `${variant.reference} · ${formatBytes(variant.sizeBytes ?? Number.NaN)} · ${variant.parameterSize ?? 'parameter size unavailable'} · ${variant.quantization ?? 'quantization unavailable'}` }),
          el('p', { class: 'supporting', text: fit ? `Fit: ${fit.verdict}. ${fit.reasons?.join(' ') ?? ''}` : 'Unknown: hardware or model evidence has not been collected.' }),
        ]),
        el('div', { class: 'history-actions' }, [
          el('button', { type: 'button', class: 'tonal', onClick: () => api.ollama.cartAdd(variant.reference).then(apply) }, 'Add to the reviewed batch'),
          el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.action({ name: 'enqueue-pull', reference: variant.reference }).then(apply) }, 'Queue a download'),
        ]),
      ]);
    });
    return el('div', {}, [
      el('div', { class: 'card' }, [
        field.element,
        searchStatusBlock('catalog', catalog.searchStatus),
        el('p', { class: 'supporting', text: `Catalogue state: ${catalog.refreshState}.${catalog.refreshMessage ? ` ${catalog.refreshMessage}` : ''}` }),
        catalog.snapshot === null ? el('p', { text: 'No verified official catalog is cached yet.' }) : null,
        catalog.snapshot?.stale ? el('p', { class: 'supporting', text: 'The variants shown are the last verified cache.' }) : null,
        catalog.refreshState === 'incomplete' ? el('p', { class: 'supporting', text: 'The last refresh was incomplete, so the older complete cache is still shown.' }) : null,
        el('button', { type: 'button', class: 'tonal', onClick: () => api.ollama.catalogRefresh().then(apply) }, 'Refresh the official catalogue'),
      ]),
      cartBlock(),
      ...(rows.length > 0 ? rows : [el('div', { class: 'empty card', text: catalog.variants.length > 0 ? 'No catalogue entry matches the current search and facets.' : 'No catalogue entry is available to show.' })]),
      installedBlock(),
    ]);
  }

  function cartBlock() {
    const cart = state.cart;
    return el('section', { class: 'card', id: 'ollama-cart', 'data-appearance-id': 'ollama-cart' }, [
      el('h2', { text: 'Reviewed batch' }),
      el('p', { class: 'supporting', text: descriptors.cartDisclosure || cart.disclosure }),
      cart.references.length === 0
        ? el('p', { text: 'The batch is empty.' })
        : el('ul', { class: 'match-list' }, cart.references.map((reference) => el('li', {}, [
          el('code', { text: reference }),
          el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.action({ name: 'remove-from-cart', reference }).then(apply) }, 'Remove'),
        ]))),
      el('p', { class: 'supporting', text: cart.totalBytes === null
        ? (cart.references.length === 0 ? 'No size is calculated for an empty batch.' : 'At least one entry reports no size, so the storage answer is unknown and this batch cannot be committed.')
        : `Total ${formatBytes(cart.totalBytes)}; ${formatBytes(cart.requiredFreeBytes)} of free space required; ${cart.freeBytes === null ? 'free space could not be measured' : `${formatBytes(cart.freeBytes)} measured free`}.` }),
      cart.blockers.length > 0 ? el('ul', { class: 'match-list' }, cart.blockers.map((blocker) => el('li', { class: 'error-text', text: blocker }))) : null,
      el('button', {
        type: 'button',
        class: 'filled',
        disabled: cart.blockers.length > 0 || cart.references.length === 0,
        onClick: () => api.ollama.cartCommit().then(apply),
      }, 'Commit the reviewed batch'),
    ]);
  }

  function installedBlock() {
    const field = fieldFor('installed');
    return el('section', { class: 'card', id: 'ollama-installed', 'data-appearance-id': 'ollama-installed' }, [
      el('h2', { text: 'Installed models' }),
      field.element,
      searchStatusBlock('installed', state.installedSearchStatus),
      state.installed.length === 0
        ? (recoveryBlock(state.chat.modelRecovery) || el('p', { text: 'No installed model is reported.' }))
        : el('ul', { class: 'match-list' }, state.visibleInstalled.map((model) => el('li', {}, [
          el('code', { text: model.reference }),
          el('span', { class: 'supporting', text: ` ${formatBytes(model.sizeBytes ?? Number.NaN)} · ${model.capabilities.join(', ') || 'no capabilities reported'}` }),
          el('button', { type: 'button', class: 'text-button', onClick: () => confirmDeletion(model.reference) }, 'Delete'),
        ]))),
    ]);
  }

  async function confirmDeletion(reference) {
    const warning = await api.ollama.action({ name: 'deletion-warning', reference });
    const text = warning?.ok ? warning.data.result : `Deleting ${reference} cannot be undone.`;
    const first = await confirmDialog({ title: 'Delete this model?', body: text, confirmLabel: 'Continue', destructive: true });
    if (!first) return;
    const second = await confirmDialog({
      title: 'Confirm again',
      body: `Type the model reference to confirm that ${reference} should be deleted from this computer.`,
      confirmLabel: 'Delete',
      destructive: true,
      requireTyped: reference,
    });
    if (!second) return;
    apply(await api.ollama.action({ name: 'delete-model', reference, confirmationOne: true, confirmationTwo: true, completion: 1 }));
  }

  function queueTab() {
    const field = fieldFor('queue');
    return el('section', { class: 'card', id: 'ollama-queue', 'data-appearance-id': 'ollama-queue' }, [
      el('h2', { text: 'Download queue' }),
      field.element,
      searchStatusBlock('queue', state.queueSearchStatus),
      el('div', { class: 'button-row' }, [
        el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.action({ name: 'pause-queue' }).then(apply) }, 'Pause'),
        el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.action({ name: 'resume-queue' }).then(apply) }, 'Resume'),
      ]),
      state.visibleQueue.length === 0
        ? el('p', { text: 'Nothing is queued.' })
        : el('ul', { class: 'match-list' }, state.visibleQueue.map((item) => el('li', {}, [
          el('code', { text: item.reference }),
          el('span', { class: 'supporting', text: ` ${item.state} · ${item.status}` }),
          el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.queueCancel(item.id).then(apply) }, 'Cancel'),
          el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.action({ name: 'retry-pull', id: item.id }).then(apply) }, 'Retry'),
        ]))),
    ]);
  }

  function chatTab() {
    const chat = state.chat;
    const field = fieldFor('chat-history');
    const input = el('textarea', { id: 'ollama-chat-input', rows: '4', maxlength: '8000' });
    return el('section', { class: 'card', id: 'ollama-chat', 'data-appearance-id': 'ollama-chat' }, [
      el('h2', { text: 'Local chat' }),
      el('p', { class: 'supporting', text: descriptors.boundary }),
      chat.selectableModels.length === 0
        ? (recoveryBlock(chat.modelRecovery) || el('p', { text: 'No installed model is available to chat with.' }))
        : el('label', { for: 'ollama-chat-model' }, ['Model', el('select', {
          id: 'ollama-chat-model',
          onChange: (event) => api.ollama.action({ name: 'select-chat-model', reference: event.target.value }).then(apply),
        }, chat.selectableModels.map((model) => el('option', { value: model.reference, selected: model.reference === chat.model, text: model.reference })))]),
      field.element,
      searchStatusBlock('chat-history', chat.historySearchStatus),
      el('div', { class: 'chat-transcript', role: 'log' }, chat.visibleTranscript.map((entry) => el('article', { class: `chat-entry ${entry.role}` }, [
        el('strong', { text: entry.role }),
        el('p', { text: entry.content }),
        entry.attachmentNames.length > 0 ? el('p', { class: 'supporting', text: `Attached: ${entry.attachmentNames.join(', ')}` }) : null,
      ]))),
      chat.sending ? el('p', { class: 'chat-streaming', 'aria-live': 'polite', text: chat.streamingText || 'Waiting for the first chunk.' }) : null,
      chat.error ? el('p', { class: 'error-text', text: chat.error }) : null,
      el('label', { for: 'ollama-chat-input' }, ['Message', input]),
      el('label', { class: 'inline-check', for: 'ollama-chat-attachments' }, [
        el('input', { id: 'ollama-chat-attachments', type: 'file', disabled: !chat.attachmentsSupported, 'aria-describedby': 'ollama-chat-attachment-reason' }),
        el('span', { text: 'Attach an image' }),
      ]),
      el('p', { id: 'ollama-chat-attachment-reason', class: 'supporting', text: chat.attachmentSupportReason }),
      chat.attachmentError ? el('p', { class: 'error-text', text: chat.attachmentError }) : null,
      el('div', { class: 'button-row' }, [
        el('button', {
          type: 'button',
          class: 'filled',
          disabled: chat.selectableModels.length === 0 || chat.sending,
          onClick: () => api.ollama.chatSend({ model: chat.model, systemPrompt: chat.systemPrompt, content: input.value, attachments: [], containsTaxData: false, reviewedTaxData: false }).then(apply),
        }, 'Send'),
        chat.sending ? el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.action({ name: 'stop-chat' }).then(apply) }, 'Stop') : null,
      ]),
    ]);
  }

  function harnessTab() {
    const harness = state.harness;
    const profileField = fieldFor('harness-profiles');
    const snapshotField = fieldFor('harness-snapshots');
    return el('section', { class: 'card', id: 'ollama-harness', 'data-appearance-id': 'ollama-harness' }, [
      el('h2', { text: 'Allowlisted harnesses' }),
      profileField.element,
      searchStatusBlock('harness-profiles', harness.profileSearchStatus),
      el('div', { role: 'group', 'aria-label': 'Harness profiles' }, harness.visibleProfiles.map((profile) => el('button', {
        type: 'button',
        class: profile.id === harness.selectedProfileId ? 'filled' : 'tonal',
        onClick: () => api.ollama.action({ name: 'select-profile', profileId: profile.id }).then(apply),
      }, profile.name))),
      el('p', { class: 'supporting', text: `Executable detection: ${harness.executablesState}.` }),
      harness.executableRecovery
        ? recoveryBlock(harness.executableRecovery)
        : el('label', { for: 'ollama-harness-executable' }, ['Detected executable', el('select', {
          id: 'ollama-harness-executable',
          onChange: (event) => api.ollama.action({ name: 'select-executable', executableId: event.target.value }).then(apply),
        }, harness.executables.map((executable) => el('option', { value: executable.id, selected: executable.id === harness.selectedExecutableId, text: `${executable.displayName} (${executable.absolutePath})` })))]),
      el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.action({ name: 'refresh-executables' }).then(apply) }, 'Look for allowlisted executables again'),
      el('p', { class: 'supporting', text: harness.workingDirectory ? `Working directory: ${harness.workingDirectory}` : 'No working directory has been chosen.' }),
      el('button', { type: 'button', class: 'tonal', onClick: () => api.ollama.action({ name: 'choose-working-directory' }).then(apply) }, 'Choose a working directory'),
      harness.preview
        ? el('div', { class: 'harness-preview' }, [
          el('h3', { text: 'Launch pre-flight' }),
          el('p', { class: 'supporting', text: `Arguments: ${harness.preview.arguments.join(' ')}` }),
          el('p', { class: 'supporting', text: `Environment key names only: ${harness.preview.environmentKeys.join(', ') || 'none'}` }),
          harness.preview.blockers.length > 0
            ? el('ul', { class: 'match-list' }, harness.preview.blockers.map((blocker) => el('li', { class: 'error-text', text: blocker })))
            : el('p', { class: 'supporting', text: 'No blocker was reported for this pre-flight.' }),
        ])
        : el('p', { class: 'supporting', text: 'Run a pre-flight before a launch is offered.' }),
      el('div', { class: 'button-row' }, [
        el('button', {
          type: 'button',
          class: 'tonal',
          onClick: () => api.ollama.harnessPreflight({
            profileId: harness.selectedProfileId,
            executableId: harness.selectedExecutableId,
            workingDirectory: harness.workingDirectory,
            model: harness.selectedModel,
          }).then(apply),
        }, 'Run pre-flight'),
        el('button', {
          type: 'button',
          class: 'filled',
          disabled: !harness.preview || harness.preview.blockers.length > 0,
          onClick: () => api.ollama.harnessLaunch().then(apply),
        }, 'Launch'),
        el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.harnessRollback().then(apply) }, 'Refresh recorded snapshots'),
      ]),
      harness.status ? el('p', { class: 'supporting', text: harness.status }) : null,
      snapshotField.element,
      searchStatusBlock('harness-snapshots', harness.snapshotSearchStatus),
      harness.snapshots.length === 0
        ? el('p', { text: 'No harness snapshot has been recorded yet.' })
        : el('ul', { class: 'match-list' }, harness.visibleSnapshots.map((snapshot) => el('li', {}, [
          el('code', { text: snapshot.id }),
          el('span', { class: 'supporting', text: ` ${snapshot.profileId} · ${snapshot.createdAt}` }),
          el('button', { type: 'button', class: 'text-button', onClick: () => api.ollama.harnessRestore(snapshot.id).then(apply) }, 'Restore'),
        ]))),
      harness.restoreStatus ? el('p', { class: 'supporting', text: harness.restoreStatus }) : null,
    ]);
  }

  function troubleshooterTab() {
    return el('section', { class: 'card', id: 'ollama-troubleshooter', 'data-appearance-id': 'ollama-troubleshooter' }, [
      el('h2', { text: 'Troubleshooter' }),
      ...state.troubleshooter.branches.map((branch) => el('article', { class: `troubleshooter-branch${branch.active ? ' active' : ''}` }, [
        el('h3', { text: branch.title }),
        el('p', { text: branch.summary }),
        branch.failingChecks.length > 0 ? el('ul', { class: 'match-list' }, branch.failingChecks.map((check) => el('li', { text: check }))) : null,
        el('p', { class: 'supporting', text: branch.offlineNextStep }),
        branch.active ? el('button', { type: 'button', class: 'tonal', onClick: () => api.ollama.runtimeStatus().then(apply) }, branch.recheckLabel) : null,
      ])),
    ]);
  }

  function render() {
    if (!state) {
      body.replaceChildren(el('p', { class: 'supporting', text: 'The local model suite has not reported a state yet.' }));
      return;
    }
    boundaryNote.textContent = descriptors.boundary;
    tabStrip.replaceChildren(...descriptors.tabs.map((tab) => el('button', {
      type: 'button',
      role: 'tab',
      'aria-selected': String(tab.id === state.activeTab),
      class: tab.id === state.activeTab ? 'filled' : 'tonal',
      title: tab.description,
      onClick: () => api.ollama.action({ name: 'select-tab', tab: tab.id }).then(apply),
    }, tab.label)));
    const panel = state.activeTab === 'queue' ? queueTab()
      : state.activeTab === 'chat' ? chatTab()
        : state.activeTab === 'harness' ? harnessTab()
          : state.activeTab === 'troubleshooter' ? troubleshooterTab()
            : storeTab();
    body.replaceChildren(runtimeBlock(), panel);
  }

  container.replaceChildren(
    el('div', { class: 'page-heading' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Local only' }), el('h1', { id: 'models-heading', text: 'Local models' })]),
    ]),
    el('div', { class: 'card' }, [tabStrip, boundaryNote]),
    body,
  );

  return {
    refresh: async () => { apply(await api.ollama.runtimeStatus()); },
    receiveState,
  };
}
