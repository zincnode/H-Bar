import * as vscode from 'vscode';
import { BaseModule } from './base';
import { SystemData } from '../types';

export class UptimeModule extends BaseModule {
    getModuleName(): string {
        return 'uptime';
    }

    update(timeData: SystemData['uptime']): void {
        if (!timeData) {
            this.statusBarItem.hide();
            return;
        }

        const uptime = this.safeNumber(timeData.uptime, 0);
        const { days, hours, minutes, seconds } = this.parseUptime(uptime);

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## ⏰ System Uptime\n\n`);
        tooltip.appendMarkdown(`**Total Uptime:** \`${days}d ${hours}h ${minutes}m ${seconds}s\`\n\n`);

        const iconText = this.displayConfig.showIcons ? '$(clock) ' : '';
        const displayTime = this.displayConfig.compactMode
            ? `${days}:${this.pad(hours)}:${this.pad(minutes)}`
            : `${days}d ${hours}h ${minutes}m`;

        this.statusBarItem.text = `${iconText}${displayTime}`;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.show();
    }

    private parseUptime(uptime: number): { days: number; hours: number; minutes: number; seconds: number } {
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor(((uptime % 86400) % 3600) / 60);
        const seconds = Math.floor(((uptime % 86400) % 3600) % 60);
        return { days, hours, minutes, seconds };
    }

    private pad(num: number): string {
        return num.toString().padStart(2, '0');
    }
}
