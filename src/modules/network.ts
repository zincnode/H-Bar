import * as vscode from 'vscode';
import { BaseModule } from './base';
import { SystemData } from '../types';
import * as utils from '../utils';

export class NetworkModule extends BaseModule {
    getModuleName(): string {
        return 'network';
    }

    update(netData: SystemData['network']): void {
        if (!netData?.stats || !Array.isArray(netData.stats)) {
            this.statusBarItem.hide();
            return;
        }

        const { stats, interfaces } = netData;
        const totalUp = stats.reduce((sum, net) => sum + this.safeNumber(net.tx_sec, 0), 0);
        const totalDown = stats.reduce((sum, net) => sum + this.safeNumber(net.rx_sec, 0), 0);

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## Network Information\n\n`);
        this.appendInterfaceDetails(tooltip, interfaces);

        const upIcon = this.displayConfig.showIcons ? '$(arrow-up) ' : '↑';
        const downIcon = this.displayConfig.showIcons ? '$(arrow-down) ' : '↓';

        this.statusBarItem.text = `${upIcon}${utils.formatBytes(totalUp)}/s ${downIcon}${utils.formatBytes(totalDown)}/s`;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.show();
    }

    private appendInterfaceDetails(tooltip: vscode.MarkdownString, interfaces: any): void {
        const interfaceArray = Array.isArray(interfaces) ? interfaces : [interfaces].filter(Boolean);
        const activeInterfaces = interfaceArray.filter(net => net.operstate === 'up');

        if (activeInterfaces.length > 0) {
            tooltip.appendMarkdown(`**Active Interfaces:**\n\n`);
            activeInterfaces.slice(0, 5).forEach((net, index) => {
                ;
                if (net.ip4) {
                    tooltip.appendMarkdown(`• **IP:** \`${net.ip4}\`\n`);
                }
                if (net.type) {
                    tooltip.appendMarkdown(`• **Type:** \`${net.type}\`\n`);
                }
                if (net.speed && net.speed > 0) {
                    tooltip.appendMarkdown(`• **Speed:** \`${this.formatNetworkSpeed(net.speed)}\`\n`);
                }
                tooltip.appendMarkdown(`\n`);
            });
            if (activeInterfaces.length > 5) {
                tooltip.appendMarkdown(`\n\n*...and ${activeInterfaces.length - 5} more interfaces*`);
            }
        } else {
            tooltip.appendMarkdown(`**No active interfaces found**`);
        }
    }

    private formatNetworkSpeed(speedMbps: number): string {
        return this.formatWithUnits(speedMbps, [
            { threshold: 1000000, divisor: 1000000, unit: 'Tbps' },
            { threshold: 1000, divisor: 1000, unit: 'Gbps' },
            { threshold: 1, divisor: 1, unit: 'Mbps' },
            { threshold: 0, divisor: 0.001, unit: 'Kbps' }
        ]);
    }

    private formatWithUnits(value: number, units: Array<{ threshold: number, divisor: number, unit: string }>): string {
        const decimals = this.displayConfig.decimalPlaces;
        const unit = units.find(u => value >= u.threshold) || units[units.length - 1];
        return `${(value / unit.divisor).toFixed(decimals)} ${unit.unit}`;
    }
}
