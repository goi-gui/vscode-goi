# Goi for VS Code

Syntax highlighting, bracket matching, indentation, an element outline and the
[`goipls`](https://github.com/goi-gui/goi/tree/master/cmd/goipls) language server
for `.goi` design files.

Every feature of the [Zed extension](https://github.com/goi-gui/zed-goi) is
here:

| Feature | Source |
|---|---|
| Highlighting, strings, colours, gradients | `syntaxes/goi.tmLanguage.json` |
| Bracket matching and auto-closing | `language-configuration.json` |
| Indent after `{` | `language-configuration.json` |
| Outline (Window › Column › Card › …) | `goipls` document symbols |
| `.goi` language, `//` and `/* */` comments | `language-configuration.json` |
| Diagnostics, completion, hover, go-to-definition | `goipls` |
| Formatting, also on save | `goipls` |
| Icon-name completion (Material Symbols) | `goipls` |
| `app.` / `window.` / `bridge.` / `props.` completion | `goipls` |
| Fragment auto-import | `goipls` completion and quick fix |
| Wrap the component at the caret in a new one | `goipls` code action |
| Window chrome docs (`disableResize`, `fullscreen`, limits) | `goipls` hover |
| Folding and selection ranges | `goipls` |

The language server is the same parser and schema the runtime uses, so a design
that draws also type-checks. Diagnostics land on the property they blame, even
when it lives in an imported fragment. Completion knows the element you are
inside, the values a property accepts, the colour roles and the `id`s the file
declares; an unknown element offers the sibling fragments as an auto-import.
Hover explains declarations, window properties and fragments, and `F12` jumps
to an import or an id. The outline follows the element tree.

See the [Zed extension README](https://github.com/goi-gui/zed-goi#readme) for
the full description of what `goipls` answers.

## Install

From a VSIX (this checkout):

```sh
npm install
npm run package
code --install-extension goi-0.1.0.vsix
```

Or install the extension from the marketplace once it is published, then
install the language server once and keep it on `PATH`:

```sh
go install github.com/goi-gui/goi/cmd/goipls@latest
```

`goi setup` installs `goipls`, `goifmt` and the `goi` CLI together, which is
the same binary set the rest of the toolchain uses.

Open a `.goi` file: the status bar reads **Goi**, highlighting appears, and the
language server starts when a `goipls` binary is found. If it is not found, the
extension offers to install it and to open the setting that points at it.

## Settings

| Setting | Default | Does |
| --- | --- | --- |
| `goi.languageServer.path` | `goipls` | The server binary; a bare name is looked up on `PATH`, a path is used as is |
| `goi.languageServer.args` | `[]` | Extra arguments passed to the server |
| `goi.trace.server` | `off` | Trace the messages between VS Code and `goipls` |

Enable format on save:

```json
"[goi]": {
    "editor.formatOnSave": true
}
```

The Goi commands in the palette are **Goi: Restart Language Server** and
**Goi: Show Language Server Output**.

## Develop

```sh
npm install
npm run watch        # rebuild dist/extension.js on change
```

Press `F5` in VS Code to start an Extension Development Host; open a `.goi`
file from this repository or any goi project. `npm run typecheck` checks the
TypeScript and the grammar test tokenizes a design with the same
`vscode-textmate` engine the editor uses:

```sh
npm test
```

`npm run package` builds the bundle and writes `goi-<version>.vsix`; the VSIX
contains the compiled extension, the grammar, the language configuration and
the icon, and no `node_modules`.

## Layout

```text
├── package.json                  # manifest: language, grammar, settings, commands
├── src/extension.ts              # starts goipls and restarts it on settings changes
├── syntaxes/goi.tmLanguage.json  # TextMate grammar for source.goi
├── language-configuration.json   # comments, brackets, indentation
├── icons/                        # language icon (svg) and extension icon (png)
└── test/grammar.test.mjs         # tokenizes a design and checks the scopes
```

The parser, schema and language server live in
[goi-gui/goi](https://github.com/goi-gui/goi); this repository is only the
editor integration.
