// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { expect, it } from 'vitest';
const traverse = traverseModule.default || traverseModule;
const root = new URL('../src/', import.meta.url);
const hindi = JSON.parse(readFileSync(new URL('lib/hi.json', root), 'utf8'));
it('has Hindi translations for every literal translation key and screen summary', () => {
  const files = ['App.jsx', ...['pages','components','context','lib'].flatMap((folder) => readdirSync(new URL(`${folder}/`, root)).filter((file) => /\.(jsx|js)$/.test(file) && !file.includes('.test.')).map((file) => `${folder}/${file}`))];
  const missing = [];
  for (const file of files) {
    const ast = parse(readFileSync(new URL(file, root), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    traverse(ast, { CallExpression(path) {
      if (!['t','useScreenSpeech','speak'].includes(path.node.callee.name)) return;
      const args = path.node.callee.name === 'useScreenSpeech' ? path.node.arguments : path.node.arguments.slice(0, 1);
      for (const arg of args) if (arg.type === 'StringLiteral' && arg.value.trim() && !Object.hasOwn(hindi, arg.value.trim())) missing.push(`${file}: ${arg.value}`);
    } });
  }
  expect(missing).toEqual([]);
});
