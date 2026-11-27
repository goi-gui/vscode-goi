// Tokenizes a design and checks the scopes the TextMate grammar assigns. The
// test runs the same vscode-textmate engine VS Code uses, so a broken regex or
// a missing rule fails here instead of in the editor.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import oniguruma from 'vscode-oniguruma';
import textmate from 'vscode-textmate';

const { loadWASM, OnigScanner, OnigString } = oniguruma;
const { parseRawGrammar, Registry } = textmate;

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

const grammar = parseRawGrammar(
	readFileSync(join(root, '..', 'syntaxes', 'goi.tmLanguage.json'), 'utf8'),
	'goi.tmLanguage.json',
);
const registry = new Registry({
	onigLib: Promise.resolve({
		createOnigScanner: (patterns) => new OnigScanner(patterns),
		createOnigString: (value) => new OnigString(value),
	}),
	loadGrammar: async () => grammar,
});
const loaded = await registry.loadGrammar('source.goi');
assert.ok(loaded, 'source.goi did not load');

const lines = [
	'import Sidebar "goi://ui/Sidebar.goi"',
	'',
	'Window {',
	'    id: main',
	'    title: "Counter"',
	'    width: 460',
	'    color: theme.primary',
	'    onClick: bridge.OnOpen(row.ID)',
	'    shadow: 2 2 5 #000000 inset',
	'    if app.dark {',
	'        for i, row := range bridge.rows {',
	'            Text { text: $children }',
	'        }',
	'    }',
	'}',
	'',
	'props {',
	'    Title string',
	'    Rows []ticket',
	'}',
	'',
	'type ticket {',
	'    Title string',
	'}',
	'',
	'bridge {',
	'    OnOpen func(id string)',
	'}',
	'',
	'Text {',
	'    text: !"line one',
	'line two"!',
	'    gradient: linear-gradient(90deg, #fff, #000)',
	'    background: app.dark ? #111111 : #eeeeee',
	'    transition: width 500ms ease-out',
	'}',
];

let stack = null;
const tokenized = lines.map((line) => {
	const result = loaded.tokenizeLine(line, stack);
	stack = result.ruleStack;
	return result.tokens;
});

/** scopeAt finds the token covering text on a 1-based line. */
function scopeAt(line, text) {
	const index = line - 1;
	const column = lines[index].indexOf(text);
	assert.notEqual(column, -1, `line ${line} does not contain ${JSON.stringify(text)}`);
	const token = tokenized[index].find((t) => t.startIndex <= column && column < t.endIndex);
	assert.ok(token, `no token at ${line}:${column} for ${JSON.stringify(text)}`);
	return token.scopes;
}

function expectScope(line, text, scope) {
	const scopes = scopeAt(line, text);
	assert.ok(
		scopes.includes(scope),
		`${JSON.stringify(text)} at line ${line} has scopes ${scopes.join(' ')}, want ${scope}`,
	);
}

test('imports', () => {
	expectScope(1, 'import', 'keyword.control.import.goi');
	expectScope(1, 'Sidebar', 'entity.name.type.goi');
	expectScope(1, '"goi://ui/Sidebar.goi"', 'string.quoted.double.goi');
});

test('elements and properties', () => {
	expectScope(3, 'Window', 'entity.name.type.goi');
	expectScope(4, 'id', 'entity.other.attribute-name.goi');
	expectScope(4, ':', 'punctuation.separator.key-value.goi');
	expectScope(5, '"Counter"', 'string.quoted.double.goi');
	expectScope(6, '460', 'constant.numeric.goi');
	expectScope(12, 'Text', 'entity.name.type.goi');
	expectScope(12, 'text', 'entity.other.attribute-name.goi');
});

test('namespace references', () => {
	expectScope(7, 'theme', 'support.type.namespace.goi');
	expectScope(7, 'primary', 'constant.other.goi');
	expectScope(8, 'bridge', 'support.type.namespace.goi');
	expectScope(8, 'OnOpen', 'entity.name.function.goi');
	expectScope(10, 'app', 'support.type.namespace.goi');
	expectScope(10, 'dark', 'variable.other.property.goi');
});

test('events and shadows', () => {
	expectScope(8, 'onClick', 'entity.name.function.goi');
	expectScope(9, '#000000', 'constant.other.color.goi');
	expectScope(9, 'inset', 'keyword.other.goi');
});

test('blocks and loops', () => {
	expectScope(10, 'if', 'keyword.other.goi');
	expectScope(11, 'for', 'keyword.control.goi');
	expectScope(11, 'i', 'variable.other.goi');
	expectScope(11, 'row', 'variable.other.goi');
	expectScope(11, ':=', 'keyword.operator.assignment.goi');
	expectScope(11, 'range', 'keyword.other.goi');
});

test('slots', () => {
	expectScope(12, '$', 'punctuation.special.goi');
	expectScope(12, 'children', 'variable.other.slot.goi');
});

test('declaration blocks', () => {
	expectScope(17, 'props', 'keyword.other.goi');
	expectScope(18, 'Title', 'variable.other.property.goi');
	expectScope(18, 'string', 'support.type.goi');
	expectScope(19, 'Rows', 'variable.other.property.goi');
	expectScope(22, 'type', 'keyword.other.goi');
	expectScope(22, 'ticket', 'entity.name.type.goi');
	expectScope(26, 'bridge', 'keyword.other.goi');
	expectScope(27, 'OnOpen', 'variable.other.property.goi');
	expectScope(27, 'func', 'keyword.other.goi');
});

test('strings and gradients', () => {
	expectScope(32, 'line two"!', 'string.quoted.block.goi');
	expectScope(32, '"!', 'punctuation.definition.string.end.goi');
	expectScope(33, 'linear-gradient', 'support.function.gradient.goi');
	expectScope(35, 'ease-out', 'keyword.other.goi');
	expectScope(34, '#111111', 'constant.other.color.goi');
});

test('comments', () => {
	const extra = loaded.tokenizeLine('// a note', null).tokens;
	assert.ok(extra.every((t) => t.scopes.includes('comment.line.double-slash.goi')));
	const block = loaded.tokenizeLine('/* a note */', null).tokens;
	assert.ok(block.every((t) => t.scopes.includes('comment.block.goi')));
});

test('setup body reads as Go', () => {
	const source = [
		'setup {',
		'    var name = "Kaan"',
		'    func greet(n string) string {',
		'        return "Hi, " + n',
		'    }',
		'}',
		'',
		'Text { text: greet(name) }',
	];
	let stack = null;
	const tokenized = source.map((line) => {
		const result = loaded.tokenizeLine(line, stack);
		stack = result.ruleStack;
		return result.tokens;
	});
	const scopeOf = (line, text) => {
		const index = line - 1;
		const column = source[index].indexOf(text);
		assert.notEqual(column, -1);
		const token = tokenized[index].find((t) => t.startIndex <= column && column < t.endIndex);
		assert.ok(token, `no token for ${JSON.stringify(text)}`);
		return token.scopes;
	};
	for (const [line, word] of [[2, 'var'], [3, 'func'], [4, 'return']]) {
		assert.ok(scopeOf(line, word).includes('keyword.control.go'), `${word} is not a Go keyword`);
	}
	assert.ok(scopeOf(3, 'string').includes('support.type.go'));
	assert.ok(scopeOf(8, 'greet').includes('entity.name.function.goi'));
});
