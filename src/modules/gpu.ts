import * as vscode from 'vscode';
import { BaseModule } from './base';
import { SystemData } from '../types';

export class GpuModule extends BaseModule {
    getModuleName(): string {
        return 'gpu';
    }

    update(gpuData: SystemData['gpu']): void {
        if (!gpuData?.controllers?.length) {
            this.statusBarItem.hide();
            return;
        }

        const { controllers } = gpuData;
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## GPU Information\n\n`);
        tooltip.appendMarkdown(`**Detected GPUs:** ${controllers.length}\n\n`);

        controllers.forEach((gpu: any, index: number) => {
            const vendor = gpu.vendor || 'Unknown';
            const model = gpu.model || 'Unknown Model';

            tooltip.appendMarkdown(`**GPU ${index}:**\n`);
            tooltip.appendMarkdown(`• **Vendor:** \`${vendor}\`\n`);
            tooltip.appendMarkdown(`• **Model:** \`${model}\`\n`);

            if (index < controllers.length - 1) {
                tooltip.appendMarkdown(`\n`);
            }
        });

        const iconText = this.displayConfig.showIcons ? '$(circuit-board) ' : '';
        const displayText = `${controllers.length} GPU${controllers.length > 1 ? 's' : ''}`;

        this.statusBarItem.text = `${iconText}${displayText}`;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.show();
    }
}
