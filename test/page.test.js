import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { TABS } from '../src/state.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('index.html');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const meta = (attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];

test('index.html has the required head', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta charset="utf-8">/i);
  assert.equal(meta('name', 'viewport'), 'width=device-width, initial-scale=1');
  assert.match(html, /<title>Regex Tester<\/title>/);
  assert.ok(meta('name', 'description')?.length > 50);
  assert.equal(meta('property', 'og:title'), 'Regex Tester');
  assert.ok(meta('property', 'og:description')?.length > 30);
  assert.equal(meta('property', 'og:url'), 'https://celaldrg.github.io/regex-tester/');
  assert.equal(meta('property', 'og:image'), 'https://celaldrg.github.io/regex-tester/docs/screenshot.png');
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.match(html, /<script type="module" src="src\/main\.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="style\.css">/);
});

test('ids are unique and every element main.js looks up exists', () => {
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(all.length, ids.size, 'duplicate id in index.html');
  const wanted = [...read('src/main.js').matchAll(/byId\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(wanted.length > 30);
  for (const id of wanted) assert.ok(ids.has(id), `#${id} missing`);
  for (const tab of TABS) {
    assert.ok(ids.has(`tab-${tab}`), `#tab-${tab} missing`);
    assert.ok(ids.has(`panel-${tab}`), `#panel-${tab} missing`);
  }
});

test('the page loads nothing from other hosts', () => {
  const external = [...html.matchAll(/\s(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(external, ['https://github.com/celaldrg/regex-tester'], 'only the source link may leave the page');
  assert.doesNotMatch(read('style.css'), /@import|url\(\s*['"]?https?:/);
  for (const name of readdirSync(new URL('src/', root))) {
    const code = read(`src/${name}`);
    assert.doesNotMatch(code, /import\(\s*['"]https?:|from\s+['"]https?:|\bfetch\(|XMLHttpRequest/, `${name} must not load anything remote`);
    assert.doesNotMatch(code, /\beval\(|new Function\(|innerHTML|console\.log/, `${name} uses a banned API`);
  }
});

test('every local file the page and the worker need exists', () => {
  for (const path of ['style.css', 'src/main.js', 'src/worker.js', 'docs/screenshot.png', 'LICENSE', '.nojekyll']) {
    assert.ok(existsSync(new URL(path, root)), `${path} missing`);
  }
  for (const name of readdirSync(new URL('src/', root))) {
    for (const [, path] of read(`src/${name}`).matchAll(/from '\.\/([^']+)'/g)) {
      assert.ok(existsSync(new URL(`src/${path}`, root)), `${name} imports missing ${path}`);
    }
  }
});
