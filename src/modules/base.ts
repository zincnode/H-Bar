import * as vscode from 'vscode';
import { DisplayConfig, ThresholdConfig } from '../types';

export abstract class BaseModule {
    protected statusBarItem: vscode.StatusBarItem;
    protected displayConfig: DisplayConfig;
    protected thresholdConfig: ThresholdConfig;

    constructor(
        statusBarItem: vscode.StatusBarItem,
        displayConfig: DisplayConfig,
        thresholdConfig: ThresholdConfig
    ) {
        this.statusBarItem = statusBarItem;
        this.displayConfig = displayConfig;
        this.thresholdConfig = thresholdConfig;
    }

    abstract update(data: any): void;
    abstract getModuleName(): string;

    protected safeNumber(value: any, fallback: number): number {
        return (typeof value === 'number' && !isNaN(value) && isFinite(value)) ? value : fallback;
    }

    protected createErrorTooltip(title: string, message: string, note: string): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## ${title} Status\n\n`);
        tooltip.appendMarkdown(`❌ **${message}**\n\n`);
        tooltip.appendMarkdown(`*${note}*`);
        return tooltip;
    }

    updateConfig(displayConfig: DisplayConfig, thresholdConfig: ThresholdConfig): void {
        this.displayConfig = displayConfig;
        this.thresholdConfig = thresholdConfig;
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
