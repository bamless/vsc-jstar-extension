import * as path from 'path';
import { spawnSync } from 'child_process'
import { workspace, ExtensionContext, window, ConfigurationChangeEvent } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// Check if J* is available on the sysyem
	let conf = workspace.getConfiguration("jstar")
	checkJstar(conf.get("jstarExecutable"));

	let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'jstar' }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	client = new LanguageClient(
		'jstarLanguageServer',
		'J* Language Server',
		serverOptions,
		clientOptions
	);

	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

workspace.onDidChangeConfiguration((e) => {
	if (e.affectsConfiguration("jstar")) {
		let conf = workspace.getConfiguration("jstar");
		checkJstar(conf.get("jstarExecutable"));
	}
})

function checkJstar(jstarExecutable: string) {
	let result = spawnSync(jstarExecutable, ["-v"]);
	if (result.status != 0) {
		window.showErrorMessage("Cannot find J* on the system, be sure jstar is in your PATH or " +
		                        "change the 'jstarExecutabe' option in the settings");
	}
}
