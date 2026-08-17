'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app', 'src', 'main', 'assets', 'betterdungeon');
const syncStorage = new Map();
const localStorage = new Map();
const storageListeners = new Set();

global.window = global;
global.location = {
  href: 'https://play.aidungeon.com/adventure/test-adventure',
  pathname: '/adventure/test-adventure',
  origin: 'https://play.aidungeon.com',
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function storageArea(areaName, store) {
  return {
    get(keys, callback) {
      const requested = Array.isArray(keys) ? keys : [keys];
      const result = {};
      for (const key of requested) {
        if (typeof key === 'string' && store.has(key)) result[key] = clone(store.get(key));
      }
      callback(result);
    },
    set(items, callback) {
      const changes = {};
      for (const [key, value] of Object.entries(items || {})) {
        const oldValue = clone(store.get(key));
        store.set(key, clone(value));
        changes[key] = { oldValue, newValue: clone(value) };
      }
      for (const listener of storageListeners) listener(changes, areaName);
      callback?.();
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
      callback?.();
    },
  };
}

global.chrome = {
  runtime: { id: 'navigator-mutation-contract', lastError: null },
  storage: {
    local: storageArea('local', localStorage),
    sync: storageArea('sync', syncStorage),
    onChanged: {
      addListener(listener) { storageListeners.add(listener); },
      removeListener(listener) { storageListeners.delete(listener); },
    },
  },
};

function load(relativePath) {
  const filename = path.join(ASSETS, relativePath);
  vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
}

async function expectCode(promise, code) {
  await assert.rejects(promise, error => error?.code === code);
}

load('services/graphql-service.js');
load('services/navigator/mutations.js');

async function testGraphqlWriters() {
  const gql = window.BetterDungeonGQL;
  const calls = [];
  const signal = new AbortController().signal;
  gql.request = async (operation, variables, document, options) => {
    calls.push({ operation, variables, document, options });
    if (operation === 'UpdateAdventurePlot') {
      return { data: { updateAdventurePlot: { success: true, adventure: { id: '101' } } } };
    }
    if (operation === 'UpdateAdventureState') {
      return { data: { updateAdventureState: { success: true, adventure: { id: '101' } } } };
    }
    if (operation === 'UseAutoSaveStoryCard') {
      return { data: { updateStoryCard: { success: true, storyCard: { id: variables.input.id } } } };
    }
    if (operation === 'UseDeleteStoryCard') {
      return { data: { deleteStoryCard: { success: true, storyCard: { id: variables.input.id } } } };
    }
    throw new Error(`Unexpected operation ${operation}`);
  };

  await gql.updateNavigatorAdventurePlot(' test-adventure ', {
    memory: 7,
    authorsNote: null,
    thirdPerson: 1,
    ignored: 'not transported',
  }, { signal });
  await gql.updateNavigatorAdventureState('test-adventure', {
    instructions: { type: 'custom', custom: 'Use vivid prose.' },
  }, { signal });
  await gql.updateNavigatorStoryCard('test-adventure', {
    id: 501,
    type: 'character',
    title: 'Silver Dragon',
    description: 'Guardian',
    keys: 'dragon, guardian',
    value: 'Guards the northern gate.',
    useForCharacterCreation: true,
    updatedAt: 'must not be replayed',
  }, { signal });
  await gql.deleteNavigatorStoryCard('test-adventure', 501, { signal });

  assert.deepEqual(calls.map(call => call.operation), [
    'UpdateAdventurePlot',
    'UpdateAdventureState',
    'UseAutoSaveStoryCard',
    'UseDeleteStoryCard',
  ]);
  assert.deepEqual(calls[0].variables.input, {
    shortId: 'test-adventure', memory: '7', authorsNote: '', thirdPerson: false,
  });
  assert.deepEqual(calls[1].variables.input, {
    shortId: 'test-adventure',
    state: { instructions: { type: 'custom', custom: 'Use vivid prose.' } },
  });
  assert.deepEqual(calls[2].variables.input, {
    id: '501', shortId: 'test-adventure', contentType: 'adventure', type: 'character',
    title: 'Silver Dragon', description: 'Guardian', keys: 'dragon, guardian',
    value: 'Guards the northern gate.', useForCharacterCreation: true,
  });
  assert.deepEqual(calls[3].variables.input, {
    id: '501', shortId: 'test-adventure', contentType: 'adventure',
  });
  assert.ok(calls.every(call => call.options.signal === signal));
  assert.match(calls[0].document, /updateAdventurePlot/);
  assert.match(calls[1].document, /updateAdventureState/);
  assert.match(calls[2].document, /updateStoryCard/);
  assert.match(calls[3].document, /deleteStoryCard/);

  await assert.rejects(() => gql.updateNavigatorAdventurePlot('', { memory: 'x' }), /shortId/);
  await assert.rejects(() => gql.updateNavigatorAdventurePlot('test-adventure', { unsupported: 'x' }), /no supported changes/);
  await assert.rejects(() => gql.updateNavigatorAdventureState('test-adventure', {}), /non-empty/);
  await assert.rejects(() => gql.updateNavigatorStoryCard('test-adventure', { title: 'No ID' }), /stable card ID/);
  await assert.rejects(() => gql.deleteNavigatorStoryCard('test-adventure', ''), /card ID/);
}

function initialAdventure() {
  return {
    id: '101', shortId: 'test-adventure', title: 'The Test Quest', thirdPerson: false,
    memory: 'The hero carries a silver key.', authorsNote: 'Keep the pace tense.',
    instructions: 'Use vivid prose.', storySummary: 'The hero reached the sealed gate.',
  };
}

function initialCards() {
  return [{
    id: 'card-1', type: 'character', title: 'Silver Dragon', description: 'A guardian.',
    keys: 'dragon, guardian', value: 'The dragon guards the northern gate.',
    useForCharacterCreation: false, updatedAt: '2026-08-10T12:00:00.000Z', deletedAt: null,
  }];
}

function snapshot(live) {
  return {
    shortId: 'test-adventure', adventureId: '101', source: 'graphql',
    adventure: clone(live.adventure), cards: clone(live.cards),
  };
}

async function testAuthoritativeCardGate() {
  const live = { adventure: initialAdventure(), cards: initialCards(), adventureReads: 0, cardReads: 0 };
  installLiveGql(live, []);
  const mutations = new window.NavigatorMutations('test-adventure');
  const authoritative = {
    ...snapshot(live),
    source: 'apollo',
    authoritativeSource: true,
  };
  const proposal = await mutations.createProposal('propose_story_card_update', {
    id: 'card-1',
    changes: { title: 'Apollo Title' },
  }, { index: authoritative });
  assert.equal(proposal.changes[0].before, 'Silver Dragon');

  await expectCode(
    Promise.resolve().then(() => mutations.createProposal('propose_story_card_update', {
      id: 'card-1',
      changes: { title: 'Cache Title' },
    }, { index: { ...authoritative, source: 'cache', authoritativeSource: false } })),
    'unavailable'
  );
}

function installLiveGql(live, writes) {
  window.BetterDungeonGQL = {
    async getNavigatorAdventureContext() {
      live.adventureReads += 1;
      return clone(live.adventure);
    },
    async getNavigatorStoryCards() {
      live.cardReads += 1;
      return { id: '101', shortId: 'test-adventure', cards: clone(live.cards) };
    },
    async updateNavigatorAdventurePlot(shortId, changes) {
      writes.push({ kind: 'plot', shortId, changes: clone(changes) });
      Object.assign(live.adventure, changes);
    },
    async updateNavigatorAdventureState(shortId, state) {
      writes.push({ kind: 'state', shortId, state: clone(state) });
      if (Object.prototype.hasOwnProperty.call(state, 'instructions')) {
        live.adventure.instructions = state.instructions?.custom ?? '';
      }
      if (Object.prototype.hasOwnProperty.call(state, 'storySummary')) {
        live.adventure.storySummary = state.storySummary;
      }
    },
    async updateNavigatorStoryCard(shortId, card) {
      writes.push({ kind: 'card-upsert', shortId, card: clone(card) });
      const index = live.cards.findIndex(existing => String(existing.id) === String(card.id));
      if (index >= 0) live.cards[index] = clone(card);
      else live.cards.push(clone(card));
    },
    async deleteNavigatorStoryCard(shortId, id) {
      writes.push({ kind: 'card-delete', shortId, id: String(id) });
      live.cards = live.cards.filter(card => String(card.id) !== String(id));
    },
  };
}

async function testMutationSafetyBoundary() {
  let liveShortId = 'test-adventure';
  window.Ultrascripts = { ws: { getAdventureShortId: () => liveShortId } };
  syncStorage.set(window.NavigatorMutations.READ_ONLY_STORAGE_KEY, false);
  const live = { adventure: initialAdventure(), cards: initialCards(), adventureReads: 0, cardReads: 0 };
  const writes = [];
  installLiveGql(live, writes);
  const mutations = new window.NavigatorMutations('test-adventure');

  const names = mutations.definitions().map(definition => definition.name);
  assert.equal(names.length, 7);
  assert.ok(names.every(name => name.startsWith('propose_')));
  assert.ok(!names.some(name => /apply|update|delete_story_card$/.test(name.replace(/^propose_/, '')) && !name.startsWith('propose_')));

  const inert = await mutations.createProposal('propose_plot_component_change', {
    component: 'plot_essentials', content: 'The gate is open.', reason: 'Reflect the latest event.',
  }, { index: snapshot(live) });
  assert.equal(inert.status, 'pending');
  assert.equal(writes.length, 0, 'proposal creation must never write');
  await expectCode(mutations.apply(inert), 'invalid_proposal');
  assert.equal(writes.length, 0, 'a pending proposal must not be directly applicable');

  inert.status = 'applying';
  const plotResult = await mutations.apply(inert);
  assert.ok(plotResult.appliedAtIso);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    kind: 'plot', shortId: 'test-adventure', changes: { memory: 'The gate is open.' },
  });
  assert.equal(live.adventure.memory, 'The gate is open.');
  assert.equal(live.adventureReads, 2, 'a plot write must be surrounded by current-state and verification reads');

  const stateProposal = await mutations.createProposal('propose_plot_component_change', {
    component: 'ai_instructions', content: 'Never speak for the player.',
  }, { index: snapshot(live) });
  stateProposal.status = 'applying';
  await mutations.apply(stateProposal);
  assert.deepEqual(writes.at(-1).state.instructions, {
    type: 'custom', custom: 'Never speak for the player.',
  });

  const readOnlyProposal = await mutations.createProposal('propose_third_person_change', {
    enabled: true,
  }, { index: snapshot(live) });
  readOnlyProposal.status = 'applying';
  syncStorage.set(window.NavigatorMutations.READ_ONLY_STORAGE_KEY, true);
  const beforeReadOnly = writes.length;
  await expectCode(mutations.apply(readOnlyProposal), 'read_only');
  assert.equal(writes.length, beforeReadOnly);
  syncStorage.set(window.NavigatorMutations.READ_ONLY_STORAGE_KEY, false);

  const switchedProposal = await mutations.createProposal('propose_third_person_change', {
    enabled: true,
  }, { index: snapshot(live) });
  switchedProposal.status = 'applying';
  liveShortId = 'another-adventure';
  const beforeSwitch = writes.length;
  await expectCode(mutations.apply(switchedProposal), 'adventure_changed');
  assert.equal(writes.length, beforeSwitch);
  liveShortId = 'test-adventure';

  const conflictProposal = await mutations.createProposal('propose_plot_component_change', {
    component: 'plot_essentials', content: 'Navigator replacement.',
  }, { index: snapshot(live) });
  conflictProposal.status = 'applying';
  live.adventure.memory = 'External edit after proposal.';
  const beforeConflict = writes.length;
  await expectCode(mutations.apply(conflictProposal), 'conflict');
  assert.equal(writes.length, beforeConflict, 'conflicts must be detected before the write');

  const verifyProposal = await mutations.createProposal('propose_plot_component_change', {
    component: 'plot_essentials', content: 'Value that must be verified.',
  }, { index: snapshot(live) });
  verifyProposal.status = 'applying';
  const realPlotUpdate = window.BetterDungeonGQL.updateNavigatorAdventurePlot;
  window.BetterDungeonGQL.updateNavigatorAdventurePlot = async (shortId, changes) => {
    writes.push({ kind: 'plot-noop', shortId, changes: clone(changes) });
  };
  await expectCode(mutations.apply(verifyProposal), 'verification_failed');
  window.BetterDungeonGQL.updateNavigatorAdventurePlot = realPlotUpdate;

  const createProposal = await mutations.createProposal('propose_story_card_create', {
    type: 'location', title: 'Moon Harbor', triggers: 'harbor, moon',
    entry: 'A harbor lit by blue lanterns.', notes: 'A recurring location.',
  }, { index: snapshot(live) });
  assert.equal(writes.filter(write => write.kind === 'card-upsert').length, 0);
  createProposal.status = 'applying';
  const createResult = await mutations.apply(createProposal);
  assert.ok(createResult.cardId);
  assert.equal(live.cards.find(card => card.id === createResult.cardId).title, 'Moon Harbor');

  const updateProposal = await mutations.createProposal('propose_story_card_update', {
    id: createResult.cardId,
    changes: { entry: 'The blue lanterns guide lost ships.', notes: '' },
  }, { index: snapshot(live) });
  updateProposal.status = 'applying';
  await mutations.apply(updateProposal);
  assert.equal(live.cards.find(card => card.id === createResult.cardId).value, 'The blue lanterns guide lost ships.');

  const cardConflict = await mutations.createProposal('propose_story_card_update', {
    id: 'card-1', changes: { title: 'Navigator Name' },
  }, { index: snapshot(live) });
  cardConflict.status = 'applying';
  live.cards.find(card => card.id === 'card-1').title = 'External Name';
  const beforeCardConflict = writes.length;
  await expectCode(mutations.apply(cardConflict), 'conflict');
  assert.equal(writes.length, beforeCardConflict);

  const deleteProposal = await mutations.createProposal('propose_story_card_delete', {
    id: createResult.cardId, reason: 'Player requested removal.',
  }, { index: snapshot(live) });
  assert.equal(deleteProposal.irreversible, true);
  deleteProposal.status = 'applying';
  await mutations.apply(deleteProposal);
  assert.equal(live.cards.some(card => card.id === createResult.cardId), false);
  assert.ok(live.cardReads >= 7, 'card writes must use conflict/read-back reads');
}

async function testSessionApprovalFlow() {
  global.NavigatorContext = class {
    async build() {
      return {
        systemInstruction: 'test context', partial: false, warnings: [],
        index: testSessionApprovalFlow.index,
        summary: {},
      };
    }
  };
  global.NavigatorTools = class {
    definitions() { return [{ name: 'get_story_card', parameters: { type: 'object' } }]; }
    async execute() { return { ok: true }; }
  };
  load('services/navigator/session.js');

  const live = { adventure: initialAdventure(), cards: initialCards(), adventureReads: 0, cardReads: 0 };
  const writes = [];
  installLiveGql(live, writes);
  testSessionApprovalFlow.index = snapshot(live);
  syncStorage.set(window.NavigatorMutations.READ_ONLY_STORAGE_KEY, false);
  const session = new window.NavigatorSession('test-adventure');
  await session.settingsReady;
  session.contextSnapshot = { index: testSessionApprovalFlow.index };

  const message = session.addMessage({ role: 'assistant', content: 'Preparing a change.', proposals: [] });
  const executed = await session.executeToolCalls([{
    id: 'call-1', name: 'propose_third_person_change', arguments: { enabled: true },
  }], new AbortController().signal, 16000, message.id);
  assert.equal(executed.results[0].result.data.status, 'pending_approval');
  assert.equal(writes.length, 0, 'a model tool call must only register a proposal');
  const proposal = message.proposals[0];
  assert.equal(proposal.status, 'pending');

  const firstApply = session.applyProposal(message.id, proposal.id);
  const duplicateApply = await session.applyProposal(message.id, proposal.id);
  assert.equal(duplicateApply, false, 'a queued proposal cannot be applied twice');
  assert.equal(await firstApply, true);
  assert.equal(proposal.status, 'applied');
  assert.equal(writes.filter(write => write.kind === 'plot').length, 1);

  session.contextSnapshot.index = snapshot(live);
  const rejectMessage = session.addMessage({ role: 'assistant', content: 'Preparing another change.', proposals: [] });
  await session.executeToolCalls([{
    id: 'call-2', name: 'propose_plot_component_change',
    arguments: { component: 'authors_note', content: 'Rejected content.' },
  }], new AbortController().signal, 16000, rejectMessage.id);
  const rejected = rejectMessage.proposals[0];
  const beforeReject = writes.length;
  assert.equal(session.rejectProposal(rejectMessage.id, rejected.id), true);
  assert.equal(await session.applyProposal(rejectMessage.id, rejected.id), false);
  assert.equal(rejected.status, 'rejected');
  assert.equal(writes.length, beforeReject, 'rejection must be final');

  session.setReadOnlyMode(true);
  assert.deepEqual(session.getToolDefinitions().map(tool => tool.name), ['get_story_card']);
  session.setReadOnlyMode(false);
  assert.ok(session.getToolDefinitions().some(tool => tool.name === 'propose_story_card_delete'));
  assert.ok(!session.getToolDefinitions().some(tool => tool.name.startsWith('apply_')));
  session.destroy();
}

function testStaticIntegration() {
  const injection = fs.readFileSync(path.join(
    ROOT, 'app', 'src', 'main', 'java', 'com', 'computerk', 'betterdungeon', 'InjectionEngine.kt'
  ), 'utf8');
  const ordered = [
    'services/navigator/context.js',
    'services/navigator/tools.js',
    'services/navigator/mutations.js',
    'services/navigator/session.js',
  ].map(asset => injection.indexOf(`"${asset}"`));
  assert.ok(ordered.every(offset => offset >= 0));
  assert.deepEqual(ordered, ordered.slice().sort((a, b) => a - b));

  const feature = fs.readFileSync(path.join(ASSETS, 'features', 'navigator_feature.js'), 'utf8');
  assert.match(feature, /applyProposal\(messageId, proposal\.id\)/);
  assert.match(feature, /rejectProposal\(messageId, proposal\.id\)/);
  assert.match(feature, /Deletion is permanent\. Navigator cannot undo this action\./);
}

async function main() {
  testStaticIntegration();
  await testGraphqlWriters();
  await testAuthoritativeCardGate();
  await testMutationSafetyBoundary();
  await testSessionApprovalFlow();
  console.log('Navigator Phase 5 mutation contract tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
