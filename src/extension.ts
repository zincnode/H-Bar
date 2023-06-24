import * as vscode from 'vscode';
import * as hBar from './hBar';

export function activate(context: vscode.ExtensionContext) {
	const bar = new hBar.HBar(context);
	bar.update();
}

export function deactivate() { }
