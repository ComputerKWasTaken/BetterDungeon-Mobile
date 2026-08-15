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
    memories: Array.from({ length: 15 }, (_, index) => `Memory ${index + 1}: ${'detail '.repeat(18)}`),
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
  assert.match(small.systemInstruction, /Action 20/);
  assert.equal(small.partial, true);
  const generous = await new window.NavigatorContext('allocator').build({ maxChars: 100000 });
  assert.ok(generous.systemInstruction.length <= 100000);
  assert.match(generous.systemInstruction, /Rule one\. Rule two\.\n\nRule three/);
  assert.equal(generous.segments.plotComponents.fields.instructions.truncated, false);
  assert.equal(generous.segments.memoryBank.truncated, false);
  console.log('Mobile Navigator context allocator contract tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
