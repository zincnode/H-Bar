import * as vscode from 'vscode';
import { BaseModule } from './base';
import { SystemData } from '../types';

export class DockerModule extends BaseModule {
    getModuleName(): string {
        return 'docker';
    }

    update(dockerData: SystemData['docker']): void {
        const iconText = this.displayConfig.showIcons ? '$(package) ' : '';

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
        const runningContainers = containers.filter(c => c.state === 'running');

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## Docker Containers\n\n`);

        if (runningContainers.length === 0) {
            tooltip.appendMarkdown(`📦 **No running containers found**\n\n`);
            tooltip.appendMarkdown(`*Start a container to see it here*\n`);
            this.statusBarItem.text = `${iconText}0`;
        } else {
            tooltip.appendMarkdown(`**Running Containers:** ${runningContainers.length}\n\n`);

            this.appendContainerDetails(tooltip, runningContainers);
            this.statusBarItem.text = `${iconText}${runningContainers.length}`;
        }

        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.show();
    }

    private appendContainerDetails(tooltip: vscode.MarkdownString, containers: any[]): void {
        const maxShow = 10;
        const containersToShow = containers.slice(0, maxShow);

        if (containersToShow.length > 0) {
            tooltip.appendMarkdown(`**Container Details:**\n\n`);
            containersToShow.forEach((container) => {
                tooltip.appendMarkdown(`🟢 **${container.name || 'Unknown'}** - \`Running\`\n\n`);
            });

            if (containers.length > maxShow) {
                tooltip.appendMarkdown(`\n*...and ${containers.length - maxShow} more running containers*\n`);
            }
        }
    }
}
