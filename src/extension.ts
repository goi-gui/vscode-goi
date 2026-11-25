import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
	State,
	TransportKind,
} from 'vscode-languageclient/node';

const INSTALL_COMMAND = 'go install github.com/goi-gui/goi/cmd/goipls@latest';

let client: LanguageClient | undefined;
let output: vscode.LogOutputChannel;
let trace: vscode.LogOutputChannel;
let starting: Promise<boolean> | undefined;

/**
 * Starts `goipls` for the open `.goi` files. The server is a Go binary rather
 * than a bundled module, so the extension looks it up on PATH and says how to
 * install it instead of failing silently.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
	output = vscode.window.createOutputChannel('Goi Language Server', { log: true });
	trace = vscode.window.createOutputChannel('Goi Language Server Trace', { log: true });
	context.subscriptions.push(output, trace);

	context.subscriptions.push(
		vscode.commands.registerCommand('goi.restartLanguageServer', async () => {
			if (await restart()) {
				void vscode.window.showInformationMessage('Goi language server restarted.');
			}
		}),
		vscode.commands.registerCommand('goi.showLanguageServerOutput', () => output.show(true)),
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('goi.languageServer')) {
				void restart();
			}
		}),
	);

	context.subscriptions.push({ dispose: () => void stop() });
	await start();
}

export async function deactivate(): Promise<void> {
	await stop();
}

async function start(): Promise<boolean> {
	if (starting) {
		return starting;
	}
	starting = startClient().finally(() => {
		starting = undefined;
	});
	return starting;
}

async function startClient(): Promise<boolean> {
	const config = vscode.workspace.getConfiguration('goi');
	const command = config.get<string>('languageServer.path', 'goipls');
	const args = config.get<string[]>('languageServer.args', []);
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	const executable = resolveExecutable(command, folder);
	if (!executable) {
		output.warn(`goipls not found: ${command}`);
		await offerInstallation(command);
		return false;
	}

	const serverOptions: ServerOptions = {
		command: executable,
		args,
		transport: TransportKind.stdio,
		options: {
			cwd: folder,
			env: { ...process.env },
		},
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'goi' }],
		outputChannel: output,
		traceOutputChannel: trace,
		synchronize: {
			// Imported fragments that are not open in an editor still change on
			// disk; the notification lets the server refresh the diagnostics of
			// the file that imports them.
			fileEvents: vscode.workspace.createFileSystemWatcher('**/*.goi'),
		},
	};

	const running = new LanguageClient('goi', 'Goi Language Server', serverOptions, clientOptions);
	running.onDidChangeState((event) => {
		if (event.newState === State.Running) {
			output.info(`goipls running (${executable})`);
		} else if (event.newState === State.Stopped) {
			output.info('goipls stopped');
		}
	});

	try {
		await running.start();
		client = running;
		return true;
	} catch (error) {
		output.error(`could not start goipls: ${String(error)}`);
		await running.stop().catch(() => undefined);
		await offerInstallation(command);
		return false;
	}
}

async function restart(): Promise<boolean> {
	await stop();
	return start();
}

async function stop(): Promise<void> {
	const running = client;
	client = undefined;
	if (running) {
		await running.stop().catch(() => undefined);
	}
}

/**
 * Resolves the configured command the way a shell would: an explicit path is
 * used as is, a bare name is searched on PATH (with PATHEXT on Windows).
 */
function resolveExecutable(raw: string, folder: string | undefined): string | undefined {
	let command = raw;
	if (!command) {
		return undefined;
	}
	if (command === '~' || command.startsWith('~/') || command.startsWith('~\\')) {
		command = path.join(os.homedir(), command.slice(1));
	}
	if (command.includes('/') || command.includes('\\')) {
		const resolved = path.isAbsolute(command) ? command : path.resolve(folder ?? '.', command);
		return fs.existsSync(resolved) ? resolved : undefined;
	}
	const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
	const extensions = process.platform === 'win32'
		? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
		: [''];
	for (const dir of dirs) {
		const base = path.join(dir, command);
		if (isFile(base)) {
			return base;
		}
		for (const extension of extensions) {
			const candidate = base + extension;
			if (isFile(candidate)) {
				return candidate;
			}
		}
	}
	return undefined;
}

function isFile(candidate: string): boolean {
	try {
		return fs.statSync(candidate).isFile();
	} catch {
		return false;
	}
}

async function offerInstallation(command: string): Promise<void> {
	const choice = await vscode.window.showErrorMessage(
		`The Goi language server (${command}) was not found. Install it with \`${INSTALL_COMMAND}\` or set \`goi.languageServer.path\`.`,
		'Install goipls',
		'Open Settings',
		'Show Output',
	);
	if (choice === 'Install goipls') {
		const terminal = vscode.window.createTerminal('goipls');
		terminal.show(true);
		terminal.sendText(INSTALL_COMMAND);
	} else if (choice === 'Open Settings') {
		void vscode.commands.executeCommand('workbench.action.openSettings', 'goi.languageServer.path');
	} else if (choice === 'Show Output') {
		output.show(true);
	}
}
