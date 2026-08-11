'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function testAndroidMetadata() {
  const gradle = read('app/build.gradle.kts');
  assert.match(gradle, /versionCode\s*=\s*4\b/);
  assert.match(gradle, /versionName\s*=\s*"2\.1\.0"/);

  const manifest = read('app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:name="android\.permission\.INTERNET"/);
}

function testPopupReleaseHistory() {
  const html = read('app/src/main/assets/betterdungeon/popup.html');
  assert.match(html, /id="app-version">v2\.1\.0</);
  assert.equal((html.match(/data-whats-new-version="2\.1\.0"/g) || []).length, 1);
  assert.equal((html.match(/data-whats-new-panel="2\.1\.0"/g) || []).length, 1);

  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicateIds, [], `duplicate popup IDs: ${duplicateIds.join(', ')}`);
  assert.deepEqual(
    Array.from(html.matchAll(/data-whats-new-version="([^"]+)"/g), match => match[1]),
    ['2.1.0', '2.0.2', '2.0.0']
  );
  assert.deepEqual(
    Array.from(html.matchAll(/data-whats-new-panel="([^"]+)"/g), match => match[1]),
    ['2.1.0', '2.0.2', '2.0.0']
  );

  const currentTab = html.match(/<button class="whats-new-version-tab active"[^>]+data-whats-new-version="2\.1\.0"[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(currentTab, '2.1.0 must be the active release tab');
  assert.match(currentTab, /Current/);

  const archived202 = html.match(/<section class="whats-new-release whats-new-release-archive"[^>]+data-whats-new-panel="2\.0\.2"[^>]*>/)?.[0];
  assert.ok(archived202, '2.0.2 must remain in release history');
  assert.match(archived202, /\bhidden\b/);
  assert.match(html, /Experimental Caret Fix/);
  assert.match(html, /Mobile Login/);

  const release210Start = html.indexOf('data-whats-new-panel="2.1.0"');
  const release202Start = html.indexOf('data-whats-new-panel="2.0.2"');
  const release210 = html.slice(release210Start, release202Start);
  assert.ok(release210Start >= 0 && release202Start > release210Start);
  assert.match(release210, /Navigator/);
  assert.match(release210, /nothing is written without your direct approval/);
  assert.match(release210, /Native Streaming/);
  assert.match(release210, /OpenAI-compatible endpoint/);
  assert.match(release210, /Ultrascripts V2\.1/);

  const css = read('app/src/main/assets/betterdungeon/popup.css');
  for (const selector of [
    '.whats-new-version-tabs', '.whats-new-version-tab.active', '.whats-new-release-panels',
    '.whats-new-sublist', '.whats-new-archive-item',
  ]) {
    assert.ok(css.includes(selector), `missing release-history selector ${selector}`);
  }
}

function testReleaseDocumentation() {
  const readme = read('README.md');
  assert.match(readme, /version-2\.1\.0/);
  assert.match(readme, /current release is \*\*BetterDungeon Mobile v2\.1\.0\*\*/);
  assert.match(readme, /Confirmed modifications/);
  assert.match(readme, /Native streaming transport/);
  assert.match(readme, /explicitly selected provider/);
  assert.match(readme, /\| `audio` \|/);

  const releaseChecklist = read('docs/V2.1_STAGE6_RELEASE_CHECKLIST.md');
  assert.match(releaseChecklist, /production keystore/);
  assert.match(releaseChecklist, /Do not substitute the Android debug\s+certificate/);
  assert.match(releaseChecklist, /BetterDungeon-Mobile-v2\.1\.0\.apk/);
  assert.match(releaseChecklist, /apksigner verify/);
}

function testRuntimeClosure() {
  const injection = read('app/src/main/java/com/computerk/betterdungeon/InjectionEngine.kt');
  const navigatorAssets = [
    'services/navigator/primer.js',
    'services/navigator/context.js',
    'services/navigator/tools.js',
    'services/navigator/mutations.js',
    'services/navigator/session.js',
  ];
  const offsets = navigatorAssets.map(asset => injection.indexOf(`"${asset}"`));
  assert.ok(offsets.every(offset => offset >= 0));
  assert.deepEqual(offsets, offsets.slice().sort((left, right) => left - right));

  const matrix = read('docs/V2.1_PORT_MATRIX.md');
  assert.doesNotMatch(matrix, /\|\s*(?:Partial|Pending|Release)\s*\|/);
  assert.match(matrix, /versionCode 4 \/ versionName 2\.1\.0/);
  assert.match(matrix, /v2\.1-release-contract\.test\.js/);
}

function main() {
  testAndroidMetadata();
  testPopupReleaseHistory();
  testReleaseDocumentation();
  testRuntimeClosure();
  console.log('BetterDungeon Mobile V2.1 release contract tests passed');
}

main();
