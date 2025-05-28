import * as vscode from 'vscode';
import { BaseModule } from './base';
import { SystemData } from '../types';

export class DockerModule extends BaseModule {
    getModuleName(): string {
        return 'docker';
    }

    update(dockerData: SystemData['docker']): void {
        const iconText = this.displayConfig.showIcons ? '$(vm) ' : '';

        if (!dockerData || !Array.isArray(dockerData.containers)) {
            this.statusBarItem.text = `${iconText}N/A`;
            this.statusBarItem.tooltip = this.createErrorTooltip(
                'Docker',
                'Unable to fetch Docker information',
                'Docker may not be installed or running'
            );
            this.statusBarItem.show();
            return;
        }

        const { containers } = dockerData;
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## 🐳 Docker Containers\n\n`);

        if (containers.length === 0) {
            tooltip.appendMarkdown(`📦 **No containers found**\n\n`);
            tooltip.appendMarkdown(`*Start a container to see it here*\n`);
            this.statusBarItem.text = `${iconText}0`;
        } else {
            const runningCount = containers.filter(c => c.state === 'running').length;
            const stoppedCount = containers.length - runningCount;

            tooltip.appendMarkdown(`**Summary:** ${containers.length} total containers\n`);
            tooltip.appendMarkdown(`• 🟢 **Running:** ${runningCount}\n`);
            if (stoppedCount > 0) {
                tooltip.appendMarkdown(`• 🔴 **Stopped:** ${stoppedCount}\n`);
            }
            tooltip.appendMarkdown(`\n`);

            this.appendContainerDetails(tooltip, containers);
            this.statusBarItem.text = `${iconText}${containers.length}`;
        }

        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.show();
    }

    private appendContainerDetails(tooltip: vscode.MarkdownString, containers: any[]): void {
        const maxShow = 5;
        const containersToShow = containers.slice(0, maxShow);

        if (containersToShow.length > 0) {
            tooltip.appendMarkdown(`**Container Details:**\n\n`);
            containersToShow.forEach((container) => {
                const statusIcon = container.state === 'running' ? '🟢' : '🔴';
                const status = container.state?.charAt(0).toUpperCase() + container.state?.slice(1) || 'Unknown';
                tooltip.appendMarkdown(`${statusIcon} **${container.name || 'Unknown'}** - \`${status}\`\n`);
            });

            if (containers.length > maxShow) {
                tooltip.appendMarkdown(`\n*...and ${containers.length - maxShow} more containers*\n`);
            }
        }
    }
}
