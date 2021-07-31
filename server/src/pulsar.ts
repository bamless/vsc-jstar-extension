import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { spawnSync } from 'child_process'
import * as path from 'path'
import { JStarSettings } from './settings';

import slash = require('slash')

const pulsarScript = slash(path.normalize(path.join(__dirname, '..', 'res', 'run_pulsar.jsr')));
const pulsarModule = slash(path.normalize(path.join(__dirname, '..', 'extern', 'pulsar')));

export class Pulsar {
	public analyze(sourceFile: TextDocument, settings: JStarSettings): Diagnostic[] {
		let proc = spawnSync(settings.jstarExecutable, [
			'-E',
			'-e', `importPaths.insert(0, "${pulsarModule}")`,
			pulsarScript, sourceFile.uri, sourceFile.getText()
		].concat(this.buildOptionList(settings)));

		if (proc.status != 0) {
			throw new Error(
				"Error executing pulsar:\n" +
				(proc.error ? proc.error?.name + " " + proc.error?.message + "\n" : "") +
				(proc.stderr ? proc.stderr.toString() : "")
			)
		}

		const diagnostics: Diagnostic[] = [];
		let outputString = proc.stdout.toString().trim();
		let outputLines = outputString ? outputString.split("\n") : [];

		for (const { index, element: line } of enumerate(outputLines)) {
			if (index == settings.maxNumberOfProblems - 1) break;

			let jsonDiagnostic = JSON.parse(line)

			const diagnostic: Diagnostic = {
				severity: jsonDiagnostic.severity == 'error' ?
					DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
				range: {
					start: sourceFile.positionAt(jsonDiagnostic.start),
					end: sourceFile.positionAt(jsonDiagnostic.end)
				},
				message: jsonDiagnostic.message,
				source: 'pulsar'
			};

			diagnostics.push(diagnostic);
		}

		return diagnostics;
	}

	private buildOptionList(settings: JStarSettings): Array<string> {
		let optionList: Array<string> = [];
		if (settings.disableVarResolve)
			optionList.push('-v');
		if (settings.noRedefinedGlobals)
			optionList.push('-g');
		if (settings.disableUnreachPass)
			optionList.push('-U');
		if (settings.noUnusedArgs)
			optionList.push('-a');
		if (settings.disableUnusedPass)
			optionList.push('-u');
		if (settings.disableReturnPass)
			optionList.push('-r');
		if (settings.disableAccessPass)
			optionList.push('-A');
		return optionList;
	}
}

// An element of an Iterable along with its index
interface EnumPair<T> {
	index: number;
	element: T;
}

// Util function that returns the elements of an iterable along with their index.
// The function is a generator in order to compute the result lazily.
function* enumerate<T>(iterable: Iterable<T>, start: number = 0): Generator<EnumPair<T>> {
	for (let element of iterable) {
		yield { index: start++, element: element };
	}
}
