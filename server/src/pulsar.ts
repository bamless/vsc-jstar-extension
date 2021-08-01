import { Diagnostic, DiagnosticSeverity, integer } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { spawn } from 'child_process'
import * as path from 'path'
import { JStarSettings } from './settings';

import slash = require('slash')

const pulsarScript = slash(path.normalize(path.join(__dirname, '..', 'res', 'run_pulsar.jsr')));
const pulsarModule = slash(path.normalize(path.join(__dirname, '..', 'extern', 'pulsar')));

export class Pulsar {
    private constructor() {}
    
    public static analyze(sourceFile: TextDocument, settings: JStarSettings): Promise<Diagnostic[]> {
        return new Promise<Diagnostic[]>((resolve, reject) => {
            let pulsarProc = spawn(settings.jstarExecutable, [
                '-E', '-e', `importPaths.insert(0, "${pulsarModule}")`,
                pulsarScript, sourceFile.uri, sourceFile.getText()
            ].concat(Pulsar.buildOptionList(settings)));

            let stdoutBuf: string[] = [];
            let stderrBuf: string[] = [];

            pulsarProc.stdout.on('data', (data: string) => {
                stdoutBuf.push(data);
            })

            pulsarProc.stderr.on('data', (data: string) => {
                stderrBuf.push(data);
            })

            pulsarProc.on('error', (err: Error) => {
                reject(new PulsarExecutionError(`Cannot find J* executable: ${err.message}`));
            })

            pulsarProc.on('close', (code: integer) => {
                if (code != 0) {
                    reject(new PulsarExecutionError(`Error executing pulsar: ${stderrBuf.join().trim()}`));
                    return;
                }

                const diagnostics: Diagnostic[] = [];
                let outputString = stdoutBuf.join().trim();
                let outputLines = outputString ? outputString.split("\n") : [];

                for (const { index, element: line } of enumerate(outputLines)) {
                    if (index == settings.maxNumberOfProblems) break;

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

                resolve(diagnostics);
            });
        });
    }

    private static buildOptionList(settings: JStarSettings): Array<string> {
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

export class PulsarExecutionError extends Error {
    constructor(message: string) {
        super(message);
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
