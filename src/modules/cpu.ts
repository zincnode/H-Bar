import * as vscode from 'vscode';
import { BaseModule } from './base';
import { SystemData } from '../types';

export class CpuModule extends BaseModule {
    getModuleName(): string {
        return 'cpu';
    }

    update(cpuData: SystemData['cpu']): void {
        if (!cpuData?.currentLoad) {
            this.statusBarItem.hide();
            return;
        }

        const { currentLoad, cpu } = cpuData;
        const usage = this.safeNumber(currentLoad.currentLoad, 0);
        const isWarning = usage > this.thresholdConfig.cpuWarning;

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## CPU Information\n\n`);
        tooltip.appendMarkdown(`**Processor:** ${cpu?.manufacturer || 'Unknown'} ${cpu?.brand || 'Unknown'}\n\n`);
        tooltip.appendMarkdown(`**Specifications:**\n`);
        tooltip.appendMarkdown(`• **Base Speed:** ${cpu?.speed || 'Unknown'} GHz\n`);
        tooltip.appendMarkdown(`• **Physical Cores:** ${cpu?.physicalCores || 'Unknown'}\n`);
        tooltip.appendMarkdown(`• **Logical Cores:** ${cpu?.cores || 'Unknown'}\n\n`);

        const iconText = this.displayConfig.showIcons ? '$(chip) ' : '';
        this.statusBarItem.text = `${iconText}${usage.toFixed(this.displayConfig.decimalPlaces)}%`;
        this.statusBarItem.tooltip = tooltip;

        if (this.thresholdConfig.enableWarningColors && isWarning) {
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        } else {
            this.statusBarItem.color = undefined;
        }

        this.statusBarItem.show();
    }
}
