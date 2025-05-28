import * as vscode from 'vscode';
import { BaseModule } from './base';
import { SystemData } from '../types';

export class MemoryModule extends BaseModule {
    getModuleName(): string {
        return 'memory';
    }

    update(memData: SystemData['memory']): void {
        if (!memData) {
            this.statusBarItem.hide();
            return;
        }

        const totalMem = this.safeNumber(memData.total, 0);
        const usedMem = this.safeNumber(memData.active || memData.used, 0);
        const usagePercent = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;
        const isWarning = usagePercent > this.thresholdConfig.memoryWarning;

        const usedFormatted = this.formatMemory(usedMem);
        const totalFormatted = this.formatMemory(totalMem);

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## 💾 Memory Information\n\n`);
        tooltip.appendMarkdown(`**Usage Overview:**\n`);
        tooltip.appendMarkdown(`• **Used:** ${usedFormatted}\n`);
        tooltip.appendMarkdown(`• **Total:** ${totalFormatted}\n`);
        tooltip.appendMarkdown(`• **Available:** ${this.formatMemory(totalMem - usedMem)}\n\n`);
        tooltip.appendMarkdown(`**Usage:** \`${usagePercent.toFixed(this.displayConfig.decimalPlaces)}%\`\n`);

        const iconText = this.displayConfig.showIcons ? '$(database) ' : '';
        const displayText = `${usedFormatted}/${totalFormatted}`;

        this.statusBarItem.text = `${iconText}${displayText}`;
        this.statusBarItem.tooltip = tooltip;

        if (this.thresholdConfig.enableWarningColors && isWarning) {
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        } else {
            this.statusBarItem.color = undefined;
        }

        this.statusBarItem.show();
    }

    private formatMemory(bytes: number): string {
        if (!this.safeNumber(bytes, 0)) return '0B';

        const gb = bytes / (1024 ** 3);
        const mb = bytes / (1024 ** 2);

        switch (this.displayConfig.memoryUnit) {
            case 'MB':
                return `${mb.toFixed(this.displayConfig.decimalPlaces)}MB`;
            case 'auto':
                return gb >= 1
                    ? `${gb.toFixed(this.displayConfig.decimalPlaces)}GB`
                    : `${mb.toFixed(this.displayConfig.decimalPlaces)}MB`;
            case 'GB':
            default:
                return `${gb.toFixed(this.displayConfig.decimalPlaces)}GB`;
        }
    }
}
