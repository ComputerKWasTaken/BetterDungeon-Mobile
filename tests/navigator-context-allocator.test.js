'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets', 'betterdungeon');
global.window = global;
global.location = { href: 'https://play.aidungeon.com/adventure/allocator', pathname: '/adventure/allocator' };
function load(file) {
  const filename = path.join(ROOT, file);
  vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
}
load('services/navigator/primer.js');
load('services/navigator/context.js');

const actions = Array.from({ length: 20 }, (_, index) => ({
  id: String(index + 1), type: 'do', text: `Action ${index + 1}: ${'story '.repeat(20)}`,
}));
const current = {
  id: 'allocator', shortId: 'allocator', title: 'Allocator Quest', actionCount: 20,
  instructions: 'Rule one. Rule two.\n\nRule three continues with a long paragraph.',
  memory: 'Persistent fact '.repeat(120), authorsNote: 'Scene note '.repeat(60),
  storySummary: 'Summary sentence. '.repeat(180),
  state: {
    memories: Array.from({ length: 15 }, (_, index) => ({
      __typename: 'Memory',
      actionIds: ['1', '2'],
      text: `Memory ${index + 1}: ${'detail '.repeat(18)}`,
    })),
    lastSummarizedActionId: '8', lastMemoryActionId: '9',
  },
};
window.Ultrascripts = { ws: { getAdventureShortId: () => 'allocator', getAdventureId: () => 'allocator' } };
window.BetterDungeonAdventureRead = {
  readAdventure: async () => ({
    identity: current, plot: current, state: current.state, actions,
    storyCards: Array.from({ length: 12 }, (_, index) => ({ id: `card-${index}`, type: 'lore', title: `Card ${index}` })),
    provenance: { plot: { instructions: 'apollo' }, actions: { source: 'apollo' }, storyCards: { source: 'apollo' } },
    coverage: { actions: { authoritativeTotal: 20, available: 20 }, storyCards: { authoritativeTotal: 12 } },
    historyIncomplete: false, sourceDegraded: false, degradations: [],
  }),
};

(async () => {
  const small = await new window.NavigatorContext('allocator').build({ maxChars: 20000 });
  assert.ok(small.systemInstruction.length <= 20000);
  assert.match(small.systemInstruction, /MEMORY BANK/);
  assert.match(small.systemInstruction, /returned \d+ of 15 entries/);
  assert.match(small.systemInstruction, /Memory 1:/);
  assert.doesNotMatch(small.systemInstruction, /__typename|actionIds/);
  assert.match(small.systemInstruction, /Action 20/);
  assert.equal(small.partial, true);
  assert.equal(small.segments.recentActions.floorIncluded, 10);
  assert.ok(small.segments.recentActions.coverage);
  assert.ok(small.segments.storyCardDirectory.coverage);
  assert.equal(small.segments.allocation.shrinkOrder[0], 'memory');
  assert.equal(small.segments.allocation.reasons[small.segments.allocation.shrinkOrder[0]], 'total budget');
  if (small.segments.memoryBank.truncated) {
    assert.equal(
      small.segments.memoryBank.truncatedReason,
      small.segments.allocation.reasons.memory
    );
    assert.match(
      small.systemInstruction,
      new RegExp(`Memory Bank:.*${small.segments.memoryBank.truncatedReason}`)
    );
  }
  const generous = await new window.NavigatorContext('allocator').build({ maxChars: 100000 });
  assert.ok(generous.systemInstruction.length <= 100000);
  assert.match(generous.systemInstruction, /Rule one\. Rule two\.\n\nRule three/);
  assert.equal(generous.segments.plotComponents.fields.instructions.truncated, false);
  assert.equal(generous.segments.memoryBank.truncated, false);
  assert.ok(generous.segments.total.sourceChars >= generous.segments.total.includedChars, `${generous.segments.total.sourceChars} < ${generous.segments.total.includedChars}`);
  assert.equal(generous.systemInstruction.endsWith('=== END CURRENT ADVENTURE SNAPSHOT ==='), true);
  const boundary = await new window.NavigatorContext('allocator').build({ maxChars: 22000 });
  assert.ok(boundary.systemInstruction.length <= 22000);
  assert.equal(boundary.systemInstruction.endsWith('=== END CURRENT ADVENTURE SNAPSHOT ==='), true);
  assert.notEqual(boundary.segments.plotComponents.fields.storySummary.boundary, 'hard');
  assert.ok(boundary.segments.plotComponents.fields.storySummary.maxChars > 160);
  for (const budget of [10000, 12000, 16000, 20000, 30000]) {
    const bounded = await new window.NavigatorContext('allocator').build({ maxChars: budget });
    assert.ok(bounded.systemInstruction.length <= budget);
    assert.equal(bounded.systemInstruction.endsWith('=== END CURRENT ADVENTURE SNAPSHOT ==='), true);
  }
  const floor = await new window.NavigatorContext('allocator').build({ maxChars: 9000 });
  assert.ok(floor.systemInstruction.length <= 9000);
  assert.equal(floor.systemInstruction.endsWith('=== END CURRENT ADVENTURE SNAPSHOT ==='), true);
  assert.match(floor.systemInstruction, /SNAPSHOT DEGRADED:/);
  assert.match(floor.systemInstruction, /IDENTITY\nTitle: Allocator Quest/);
  assert.match(floor.systemInstruction, /RECENT STORY ACTIONS/);
  assert.ok(floor.segments.recentActions.floorIncluded > 0);
  current.actionCount = 292;
  current.instructions = 'Instruction '.repeat(300);
  current.memory = 'Fact '.repeat(300);
  current.authorsNote = 'Note '.repeat(200);
  current.storySummary = 'Summary '.repeat(500);
  current.state.instructions = current.instructions;
  current.state.storySummary = current.storySummary;
  current.state.memories = Array.from({ length: 48 }, (_, index) => ({
    text: `Memory ${index + 1}: ${'detail '.repeat(600)}`,
  }));
  for (let index = actions.length; index < 292; index += 1) {
    actions.push({
      id: String(index + 1),
      type: 'do',
      text: `Action ${index + 1}: ${'story '.repeat(30)}`,
    });
  }
  const large = await new window.NavigatorContext('allocator').build({ maxChars: 554119 });
  assert.ok(large.systemInstruction.length <= 554119);
  assert.equal(large.segments.memoryBank.included, 48);
  assert.ok(large.segments.recentActions.included > 31);
  assert.equal(large.segments.recentActions.coverage.included, large.segments.recentActions.included);
  assert.equal(large.segments.total.includedChars, large.systemInstruction.length);
  const sectionBound = await new window.NavigatorContext('allocator').build({ maxChars: 200000 });
  assert.equal(sectionBound.segments.memoryBank.truncatedReason, 'section ceiling');
  assert.match(sectionBound.systemInstruction, /Memory Bank:.*reduced for section ceiling/);
  assert.ok(sectionBound.segments.total.includedChars < 200000);
  current.state.memories = undefined;
  const unavailable = await new window.NavigatorContext('allocator').build({ maxChars: 20000 });
  assert.match(unavailable.systemInstruction, /MEMORY BANK\n\(Memory Bank is unavailable/i);
  console.log('Mobile Navigator context allocator contract tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
