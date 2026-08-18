'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets', 'betterdungeon');
const APP_ROOT = path.resolve(__dirname, '..');
const localStorage = new Map();
const syncStorage = new Map();
const storageListeners = new Set();

global.window = global;
global.location = {
  href: 'https://play.aidungeon.com/adventure/test-adventure',
  pathname: '/adventure/test-adventure',
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
  runtime: { id: 'navigator-contract-test', lastError: null },
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
  const filename = path.join(ROOT, relativePath);
  vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
}

load('services/graphql-service.js');
load('services/adventure-read-service.js');
load('services/navigator/primer.js');
load('services/navigator/context.js');
load('services/navigator/tools.js');
load('services/navigator/session.js');

async function expectCode(promise, code) {
  await assert.rejects(promise, error => error?.code === code);
}

async function testInjectionOrder() {
  const source = fs.readFileSync(
    path.join(APP_ROOT, 'app', 'src', 'main', 'java', 'com', 'computerk', 'betterdungeon', 'InjectionEngine.kt'),
    'utf8'
  );
  const paths = [
    'services/apollo-cache-service.js',
    'services/adventure-read-service.js',
    'services/story-card-cache.js',
    'services/navigator/primer.js',
    'services/navigator/context.js',
    'services/navigator/tools.js',
    'services/navigator/session.js',
    'services/story-card-scanner.js',
    'features/navigator_feature.js',
  ];
  const offsets = paths.map(value => source.indexOf(`"${value}"`));
  assert.ok(offsets.every(value => value >= 0), 'every Phase 3 asset must be injected');
  assert.deepEqual(offsets, offsets.slice().sort((left, right) => left - right));
}

async function testGraphqlReaders() {
  const gql = window.BetterDungeonGQL;
  const seen = [];
  const signal = new AbortController().signal;
  gql.request = async (operation, variables, document, options) => {
    seen.push({ operation, variables, document, options });
    if (operation === 'GetBetterDungeonNavigatorContext') {
      return {
        data: {
          adventure: {
            id: 101,
            shortId: 'test-adventure',
            title: 'The Test Quest',
            actionCount: 12,
            editedAt: '2026-08-10T12:00:00.000Z',
            thirdPerson: true,
            memory: 'The hero carries a silver key.',
            authorsNote: 'Keep the pace tense.',
            instructions: 'Unused flat instructions',
            state: {
              instructions: { custom: ['Use vivid prose.', { text: 'Never speak for the player.' }] },
              storySummary: 'The hero reached the sealed gate.',
            },
          },
        },
      };
    }
    if (operation === 'GetBetterDungeonStoryCards') {
      return {
        data: {
          adventure: {
            id: 101,
            shortId: 'test-adventure',
            storyCardCount: 2,
            storyCards: [{ id: 'card-1', title: 'Silver Dragon', value: 'A patient guardian.' }],
          },
        },
      };
    }
    throw new Error(`Unexpected GraphQL operation: ${operation}`);
  };

  const adventure = await gql.getNavigatorAdventureContext('test-adventure', { signal });
  assert.equal(adventure.id, '101');
  assert.equal(adventure.instructions, 'Use vivid prose.\nNever speak for the player.');
  assert.equal(adventure.instructionsSource, 'state');
  assert.equal(adventure.storySummary, 'The hero reached the sealed gate.');

  const cards = await gql.getNavigatorStoryCards('test-adventure', { signal });
  assert.equal(cards.id, '101');
  assert.equal(cards.storyCardCount, 2);
  assert.equal(cards.cards[0].id, 'card-1');

  assert.equal(seen[0].operation, 'GetBetterDungeonNavigatorContext');
  assert.equal(seen[0].variables.shortId, 'test-adventure');
  assert.equal(seen[0].options.signal, signal);
  assert.equal(seen[1].operation, 'GetBetterDungeonStoryCards');
  assert.equal(seen[1].options.signal, signal);
  assert.match(window.BetterDungeonGQLService.QUERIES.navigatorAdventureContext, /state\s*\{/);

  gql.request = async () => ({
    data: {
      adventure: {
        id: '102',
        shortId: 'flat-fallback',
        instructions: { aiInstructions: 'Use the flat fallback.' },
        state: { storySummary: '' },
      },
    },
  });
  const fallback = await gql.getNavigatorAdventureContext('flat-fallback');
  assert.equal(fallback.instructions, 'Use the flat fallback.');
  assert.equal(fallback.instructionsSource, 'flat');
}

function createLiveWs() {
  return {
    getAdventureShortId: () => 'test-adventure',
    getAdventureId: () => '101',
    getLiveCount: () => 3,
    getActions: () => new Map([
      ['late', { id: '10', type: 'story', text: 'The silver dragon opened the gate.' }],
      ['early', { id: '2', type: 'do', text: 'The hero raised the silver key.' }],
      ['undone', { id: '3', type: 'say', text: 'This action was undone.', undoneAt: '2026-08-10' }],
    ]),
    getCards: () => new Map(),
  };
}

function adventureRecord() {
  return {
    id: '101',
    shortId: 'test-adventure',
    title: 'The Test Quest',
    actionCount: 2,
    editedAt: '2026-08-10T12:00:00.000Z',
    thirdPerson: false,
    memory: 'The hero carries a silver key.',
    authorsNote: 'Keep the pace tense.',
    instructions: 'Use vivid prose.',
    storySummary: 'The hero reached the sealed gate.',
  };
}

function cardRecords() {
  return [
    {
      id: 'card-1',
      type: 'character',
      title: 'Silver Dragon',
      description: 'A principal guardian.',
      keys: 'dragon, guardian',
      value: 'The Silver Dragon patiently guards the northern gate.',
      updatedAt: '2026-08-10T12:00:00.000Z',
    },
    {
      id: 'deleted-card',
      type: 'location',
      title: 'Deleted Tower',
      keys: 'tower',
      value: 'This must never enter the snapshot.',
      deletedAt: '2026-08-09T12:00:00.000Z',
    },
  ];
}

async function testContextAndFallback() {
  window.Ultrascripts = { ws: createLiveWs() };
  window.BetterDungeonApolloCache = {
    readAdventure: async () => ({
      available: false,
      data: null,
      error: { code: 'not_found', message: 'Apollo cache is cold' },
    }),
  };
  window.BetterDungeonGQL = {
    getNavigatorAdventureContext: async (_shortId, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      return adventureRecord();
    },
    getNavigatorStoryCards: async (_shortId, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      return { id: '101', shortId: 'test-adventure', storyCardCount: 2, cards: cardRecords() };
    },
  };

  const reader = new window.NavigatorContext('test-adventure');
  const snapshot = await reader.build({ signal: new AbortController().signal });
  assert.ok(snapshot.systemInstruction.length <= window.NavigatorContext.BUDGETS.systemInstruction);
  assert.equal(snapshot.partial, true);
  assert.equal(snapshot.index.source, 'graphql');
  assert.equal(snapshot.index.cards.length, 1, 'deleted cards must be filtered');
  assert.equal(snapshot.summary.actionsTotal, 2, 'authoritative action count must be preserved');
  assert.deepEqual(snapshot.index.actions.map(item => item.id), ['2', '10']);
  assert.deepEqual(snapshot.index.actions[0], { id: '2', type: 'do', text: 'The hero raised the silver key.' });
  assert.equal(snapshot.index.memories, null, 'Memory Bank stays unavailable when the fallback reader has no state memories');
  assert.ok(
    snapshot.systemInstruction.indexOf('The hero raised the silver key.') <
      snapshot.systemInstruction.indexOf('The silver dragon opened the gate.'),
    'recent actions must be ordered oldest to newest'
  );
  assert.doesNotMatch(snapshot.systemInstruction, /Deleted Tower/);

  const emptyMemoryAdventure = adventureRecord();
  emptyMemoryAdventure.state = {
    memories: [],
    lastSummarizedActionId: '',
    lastMemoryActionId: '',
  };
  window.BetterDungeonApolloCache.readAdventure = async () => ({
    available: true,
    data: {
      adventure: emptyMemoryAdventure,
      state: emptyMemoryAdventure.state,
      storyCards: [],
      actions: [],
    },
    error: null,
  });
  const emptyMemorySnapshot = await reader.build();
  assert.equal(emptyMemorySnapshot.segments.memoryBank.includedChars, 0);
  assert.match(emptyMemorySnapshot.systemInstruction, /lastSummarized=unknown, lastMemory=unknown/);

  window.storyCardCache = {
    getCardArray: () => [{ id: 'cached-card', type: 'location', title: 'Cached Harbor', keys: 'harbor', value: 'A foggy port.' }],
  };
  window.BetterDungeonApolloCache.readAdventure = async () => ({
    available: false,
    data: null,
    error: { code: 'not_found', message: 'Apollo cache is cold' },
  });
  window.BetterDungeonGQL.getNavigatorStoryCards = async () => {
    throw new Error('GraphQL unavailable');
  };
  const fallback = await reader.build();
  assert.equal(fallback.partial, true);
  assert.equal(fallback.index.source, 'cache');
  assert.equal(fallback.index.cards[0].id, 'cached-card');
  assert.match(fallback.warnings.join(' '), /GraphQL unavailable/i);

  const controller = new AbortController();
  controller.abort();
  await expectCode(reader.build({ signal: controller.signal }), 'aborted');
  return snapshot;
}

async function testReadTools(snapshot) {
  const longEntry = 'dragon lore '.repeat(700);
  const index = {
    ...snapshot.index,
    cards: [
      ...snapshot.index.cards,
      { id: 'long-card', type: 'lore', title: 'Dragon Archive', keys: 'dragon', value: longEntry },
    ],
  };
  const tools = new window.NavigatorTools('test-adventure');
  const definitions = tools.definitions();
  assert.deepEqual(definitions.map(item => item.name), [
    'get_story_card',
    'search_story_cards',
    'search_story_history',
    'get_story_actions',
    'search_memory_bank',
    'get_memory',
  ]);
  definitions[0].name = 'modified';
  assert.equal(tools.definitions()[0].name, 'get_story_card', 'definitions must be cloned');

  const search = await tools.execute('search_story_cards', { query: 'dragon', limit: 2 }, { index });
  assert.equal(search.ok, true);
  assert.equal(search.data.totalMatches, 2);
  assert.deepEqual(search.data.cards.map(card => card.id), ['card-1', 'long-card']);

  const card = await tools.execute('get_story_card', { id: 'long-card' }, { index });
  assert.equal(card.data.card.id, 'long-card');
  assert.equal(card.data.entryTruncated, true);
  assert.ok(card.data.card.value.length <= 6000);

  await expectCode(tools.execute('search_story_cards', { query: '', limit: 1 }, { index }), 'invalid_tool_args');
  await expectCode(tools.execute('missing_tool', {}, { index }), 'unknown_tool');
  const controller = new AbortController();
  controller.abort();
  await expectCode(tools.execute('get_story_card', { id: 'card-1' }, { index, signal: controller.signal }), 'aborted');
  return index;
}

function sessionSnapshot(index) {
  return {
    systemInstruction: `${window.NavigatorPrimer.TEXT}\n\n=== TEST SNAPSHOT ===`,
    capturedAtIso: '2026-08-10T12:00:00.000Z',
    partial: false,
    warnings: [],
    index,
    summary: { title: 'The Test Quest', cardsTotal: index.cards.length, actionsTotal: 2 },
  };
}

async function testSessionStreamingPersistenceAndAbort(index) {
  syncStorage.set('betterDungeon_navigator_read_only', true);
  syncStorage.set('betterDungeon_navigator_thinking_level', 'high');
  const snapshot = sessionSnapshot(index);
  let activeSnapshot = snapshot;
  const session = new window.NavigatorSession('test-adventure');
  session.contextReader = { build: async () => activeSnapshot };
  let executedSnapshot;
  const executeToolCalls = session.executeToolCalls.bind(session);
  session.executeToolCalls = async (...args) => {
    executedSnapshot = args[4];
    return executeToolCalls(...args);
  };
  await session.settingsReady;
  assert.deepEqual(session.getPermissionState(), { readOnly: true });
  assert.equal(session.thinkingLevel, 'high');
  assert.ok(session.getToolDefinitions().every(tool => !tool.name.startsWith('propose_')));
  assert.match(await session.buildSystemInstruction(new AbortController().signal), /READ-ONLY MODE/);

  let chatRound = 0;
  const receivedRequests = [];
  window.UltrascriptsAIExecutor = {
    refreshStatus: async options => {
      assert.equal(options.consumer, 'navigator');
      return { ready: true, config: { thinkingLevels: ['minimal', 'low'] } };
    },
    chat: async (request, options) => {
      receivedRequests.push(request);
      assert.equal(options.consumer, 'navigator');
      assert.equal(request.thinking.level, 'low');
      if (chatRound++ === 0) {
        options.onDelta({ text: 'Checking the current card.' });
        activeSnapshot = {
          ...snapshot,
          index: { ...snapshot.index, cards: [{ id: 'retargeted-card' }] },
        };
        await session.refreshContext();
        return {
          continuation: { id: 'continuation-1' },
          toolCalls: [{ id: 'call-1', name: 'get_story_card', arguments: { id: 'card-1' } }],
        };
      }
      assert.deepEqual(request.continuation, { id: 'continuation-1' });
      assert.equal(request.toolResults[0].result.ok, true);
      assert.equal(request.toolResults[0].result.data.card.id, 'card-1');
      options.onDelta({ text: ' The guardian is patient.' });
      return { toolCalls: [], meta: { provider: 'mock' } };
    },
  };

  await session.send('What guards the gate?');
  const assistant = session.getMessages().find(message => message.role === 'assistant');
  assert.equal(assistant.status, 'complete');
  assert.match(assistant.content, /guardian is patient/);
  assert.equal(assistant.meta.toolRounds, 1);
  assert.deepEqual(assistant.meta.readToolsCompleted, ['get_story_card']);
  assert.equal(chatRound, 2);
  const inspection = session.getLastRequestInspection();
  assert.equal(inspection.rounds.length, receivedRequests.length);
  inspection.rounds.forEach((round, index) => {
    const request = receivedRequests[index];
    assert.equal(round.systemInstruction, request.systemInstruction);
    assert.deepEqual(round.messages, request.messages);
    assert.deepEqual(round.tools, request.tools);
    assert.deepEqual(round.toolResults, request.toolResults);
    assert.equal(round.continuationPresent, Object.prototype.hasOwnProperty.call(request, 'continuation'));
    assert.deepEqual(round.budget, request.budget);
  });
  assert.deepEqual(executedSnapshot.index.cards.map(card => card.id), ['card-1', 'long-card']);
  const trimmedResults = session.trimToolResults([
    { id: 'a', name: 'get_story_card', result: { data: 'a'.repeat(500) } },
    { id: 'b', name: 'get_story_card', result: { data: 'b'.repeat(500) } },
  ], 300);
  assert.ok(trimmedResults.every(item => item.result?.error?.code === 'context_budget_omitted'));
  const exhausted = await session.executeToolCalls(
    [{ id: 'budget-call', name: 'get_story_card', arguments: { id: 'card-1' } }],
    new AbortController().signal,
    0,
    'budget-message',
    snapshot
  );
  assert.equal(exhausted.exhausted, true);
  assert.match(exhausted.note, /tool budget/);

  session.persist();
  const persisted = localStorage.get('betterDungeon_navigator_session_test-adventure');
  assert.equal(persisted.v, 1);
  assert.equal(persisted.messages.length, 2);

  chrome.storage.sync.set({ betterDungeon_navigator_read_only: false });
  assert.deepEqual(session.getPermissionState(), { readOnly: false });
  session.destroy();

  localStorage.set('betterDungeon_navigator_session_restore-test', {
    v: 1,
    messages: [{ id: 'streaming-message', role: 'assistant', status: 'streaming', content: 'Partial answer' }],
  });
  const restored = new window.NavigatorSession('restore-test');
  await restored.load();
  assert.equal(restored.getMessages()[0].status, 'aborted');
  assert.equal(restored.getMessages()[0].content, 'Partial answer');
  restored.destroy();

  const aborted = new window.NavigatorSession('abort-test');
  aborted.contextReader = { build: async () => snapshot };
  await aborted.settingsReady;
  window.UltrascriptsAIExecutor = {
    refreshStatus: async () => ({ ready: true }),
    chat: (_request, options) => new Promise((_resolve, reject) => {
      options.onDelta({ text: 'Partial stream' });
      options.signal.addEventListener('abort', () => reject({ code: 'aborted', message: 'Stopped.' }), { once: true });
    }),
  };

  const sending = aborted.send('Start a long answer.');
  for (let attempt = 0; attempt < 20 && !aborted.controller; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.ok(aborted.controller, 'the session should expose an active turn controller');
  aborted.abort();
  await sending;
  const abortedAssistant = aborted.getMessages().find(message => message.role === 'assistant');
  const abortedUser = aborted.getMessages().find(message => message.role === 'user');
  assert.equal(abortedAssistant.status, 'aborted');
  assert.equal(abortedAssistant.content, 'Partial stream');
  assert.notEqual(abortedAssistant.excluded, true);
  assert.notEqual(abortedUser.excluded, true);
  aborted.destroy();

  const prohibited = new window.NavigatorSession('prohibited-test');
  prohibited.contextReader = { build: async () => snapshot };
  await prohibited.settingsReady;
  window.UltrascriptsAIExecutor = {
    refreshStatus: async () => ({ ready: true }),
    chat: async () => {
      throw { code: 'prohibited_content', message: 'Blocked.' };
    },
  };
  await prohibited.send('A prohibited prompt.');
  const prohibitedUser = prohibited.getMessages().find(message => message.role === 'user');
  assert.equal(prohibitedUser.excluded, true);
  const failedInspection = prohibited.getLastRequestInspection();
  assert.equal(failedInspection.rounds.length, 1);
  assert.equal(failedInspection.error.code, 'prohibited_content');
  assert.equal(failedInspection.meta.toolRounds, 0);
  prohibited.persist();
  const failedPersisted = localStorage.get('betterDungeon_navigator_session_prohibited-test');
  assert.equal(failedPersisted.inspection, undefined);
  prohibited.destroy();
}

function testNavigatorToolGuidanceAndAllowances() {
  const session = {
    isMutationTool: window.NavigatorSession.prototype.isMutationTool,
    buildToolGuidance: window.NavigatorSession.prototype.buildToolGuidance,
    getTurnAllowances: window.NavigatorSession.prototype.getTurnAllowances,
  };
  const read = [{ name: 'get_story_card' }];
  const proposal = [{ name: 'propose_story_card_create' }];
  const readGuidance = session.buildToolGuidance.call(session, read);
  const proposalGuidance = session.buildToolGuidance.call(session, proposal);
  const droppedGuidance = session.buildToolGuidance.call(session, [], { dropped: true });
  assert.match(readGuidance, /Every available tool is read-only/);
  assert.match(`snapshot${readGuidance}`, /^snapshot\n=== NAVIGATOR READ TOOLS ===/);
  assert.doesNotMatch(readGuidance, /CHANGE PROPOSALS/);
  assert.match(proposalGuidance, /CHANGE PROPOSALS/);
  assert.doesNotMatch(proposalGuidance, /every available tool is read-only/);
  assert.match(proposalGuidance, /Never claim a proposal was applied/);
  assert.match(proposalGuidance, /Third Person/);
  assert.match(proposalGuidance, /Memory Bank/);
  assert.match(proposalGuidance, /stable (?:card|memory) IDs/);
  assert.match(proposalGuidance, /cannot create/);
  assert.match(droppedGuidance, /lookups.*not represented by the tools below/);
  assert.equal(session.getTurnAllowances.call({}, 40000, false).toolResultAllowance, 0);
  assert.ok(session.getTurnAllowances.call({}, 300000, true).historyAllowance > 16000);
  assert.ok(session.getTurnAllowances.call({}, 300000, true).toolResultAllowance > 16000);
}

function testToolDropUsesInstructionOnly() {
  const source = fs.readFileSync(path.join(ROOT, 'services/navigator/session.js'), 'utf8');
  const session = {
    isMutationTool: window.NavigatorSession.prototype.isMutationTool,
  };
  const guidance = window.NavigatorSession.prototype.buildToolGuidance.call(session, [], { dropped: true });
  assert.match(guidance, /lookups.*not represented by the tools below/);
  assert.doesNotMatch(source, /TOOL_DROP_NOTE/);
  assert.doesNotMatch(source, /context_budget_tools_dropped/);
}

async function testProposalResultFloor() {
  const proto = window.NavigatorSession.prototype;
  const owner = { proposals: [] };
  const runner = {
    tools: {
      execute: async () => ({ ok: true, data: 'read'.repeat(5000) }),
    },
    mutations: {
      createProposal: () => ({ id: 'proposal-1' }),
    },
    readOnly: false,
    isMutationTool: proto.isMutationTool,
    registerProposal: (_messageId, proposal) => owner.proposals.push(proposal),
    findMessage: () => owner,
    emit: () => {},
    schedulePersist: () => {},
  };
  const executed = await proto.executeToolCalls.call(runner, [
    { id: 'read-1', name: 'get_story_card', arguments: {} },
    { id: 'proposal-1', name: 'propose_story_card_create', arguments: {} },
  ], new AbortController().signal, 16000, 'message-1', {});
  assert.equal(executed.results.length, 2);
  assert.equal(executed.results[1].result.ok, true);
  assert.equal(executed.results[1].result.data.proposalId, 'proposal-1');
  assert.equal(owner.proposals.length, 1);
  assert.ok(executed.charsUsed > 0);
  const truncatedOwner = { proposals: [] };
  const truncated = await proto.executeToolCalls.call({
    ...runner,
    tools: { execute: async () => ({ ok: true, data: 'read' }) },
    registerProposal: (_messageId, proposal) => truncatedOwner.proposals.push(proposal),
  }, [
    { id: 'read-truncated', name: 'get_story_card', arguments: {} },
    { id: 'proposal-truncated', name: 'propose_story_card_create', arguments: {} },
  ], new AbortController().signal, 40000, 'message-1', {}, null, 1, { rejectMutations: true });
  assert.equal(truncated.results[0].result.ok, true);
  assert.equal(truncated.results[1].isError, true);
  assert.equal(truncated.results[1].result.error.code, 'output_truncated');
  assert.equal(truncatedOwner.proposals.length, 0);
  const exhaustedOwner = { proposals: [] };
  const exhausted = await proto.executeToolCalls.call({
    ...runner,
    registerProposal: (_messageId, proposal) => exhaustedOwner.proposals.push(proposal),
  }, [
    { id: 'proposal-2', name: 'propose_story_card_create', arguments: {} },
  ], new AbortController().signal, 0, 'message-1', {});
  assert.equal(exhausted.results.length, 0);
  assert.equal(exhaustedOwner.proposals.length, 0);
}


function testRequestInspectionRetentionAndContract() {
  const proto = window.NavigatorSession.prototype;
  const owner = { emit() {}, lastRequestInspection: null, getLastRequestInspection: window.NavigatorSession.prototype.getLastRequestInspection };
  proto.beginRequestInspection.call(owner);
  assert.equal(proto.getLastRequestInspection.call(owner).rounds.length, 0);
  for (let round = 0; round < 3; round += 1) {
    proto.retainInspectionRound.call(owner, {
      round, systemInstruction: 's'.repeat(1_500_000), messages: [], tools: [], toolResults: [],
      continuationPresent: round > 0, budget: {}, thinking: { level: 'low' }, projectedInputChars: 1_500_000,
    });
  }
  const inspection = proto.getLastRequestInspection.call(owner);
  assert.ok(JSON.stringify(inspection).length <= window.NavigatorSession.MAX_INSPECTION_CHARS);
  assert.equal(inspection.rounds[0].round, 0);
  assert.equal(inspection.rounds.at(-1).round, 2);
  assert.ok(inspection.rounds.some(round => round.omitted === true));
  const oversized = { emit() {}, lastRequestInspection: null, getLastRequestInspection: window.NavigatorSession.prototype.getLastRequestInspection };
  proto.beginRequestInspection.call(oversized);
  proto.retainInspectionRound.call(oversized, { round: 0, systemInstruction: 'x'.repeat(window.NavigatorSession.MAX_INSPECTION_CHARS + 1000), messages: [], tools: [], toolResults: [], continuationPresent: false, budget: {}, thinking: {}, projectedInputChars: window.NavigatorSession.MAX_INSPECTION_CHARS + 1000 });
  const oversizedInspection = proto.getLastRequestInspection.call(oversized);
  assert.ok(JSON.stringify(oversizedInspection).length <= window.NavigatorSession.MAX_INSPECTION_CHARS);
  assert.equal(oversizedInspection.rounds[0].truncated, true);
  assert.match(oversizedInspection.rounds[0].systemInstruction, /Inspection text truncated/);
  const source = require('node:fs').readFileSync(require('node:path').join(ROOT, 'services/navigator/session.js'), 'utf8');
  assert.match(source, /const requestPayload =/);
  assert.match(source, /chat\(requestPayload/);
  assert.match(source, /getLastRequestInspection/);
  assert.doesNotMatch(source, /persist\([^)]*lastRequestInspection/);
}

async function main() {
  await testInjectionOrder();
  await testGraphqlReaders();
  const snapshot = await testContextAndFallback();
  const index = await testReadTools(snapshot);
  await testSessionStreamingPersistenceAndAbort(index);
  testNavigatorToolGuidanceAndAllowances();
  testToolDropUsesInstructionOnly();
  await testProposalResultFloor();
  testRequestInspectionRetentionAndContract();
  console.log('Navigator Phase 3 contract tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
