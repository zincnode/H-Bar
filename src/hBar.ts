import * as vscode from 'vscode';
import systeminfo = require('systeminformation');
import * as utils from './utils';

class HBar {
    _context: vscode.ExtensionContext;
    hBarItems: Map<string, vscode.StatusBarItem> = new Map<string, vscode.StatusBarItem>();

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        utils.systeminfoInit();
        this.init();
    }

    init() {
        this.hBarItems.set('cpu', vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1));
        this.hBarItems.set('mem', vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1));
        this.hBarItems.set('uptime', vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1));
        this.hBarItems.set('user', vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1));
        this.hBarItems.set('docker', vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1));
        this.hBarItems.set('net', vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1));
        this._context.subscriptions.push(...this.hBarItems.values());
    }

    async update() {
        setInterval(async () => {
            await this.cpuItem();
            await this.memItem();
            await this.uptimeItem();
            await this.userItem();
            await this.dockerItem();
            await this.netSpeedItem();
        }, 500);
    }

    async cpuItem(): Promise<void> {
        const currentLoadRes = await systeminfo.currentLoad();
        const cpuRes = await systeminfo.cpu();
        this.hBarItems.get('cpu')!.text = `$(dashboard) ${currentLoadRes.currentLoad.toFixed(2)}%`;
        this.hBarItems.get('cpu')!.tooltip = `CPU: ${cpuRes.manufacturer} ${cpuRes.brand} ${cpuRes.speed}GHz ${cpuRes.physicalCores}C${cpuRes.cores}T`;
        this.hBarItems.get('cpu')!.show();
    }

    async memItem(): Promise<void> {
        const memData = await systeminfo.mem();
        const totalMem = memData.total / 1024 / 1024 / 1024;
        const usedMem = memData.active / 1024 / 1024 / 1024;
        this.hBarItems.get('mem')!.text = `$(pulse) ${usedMem.toFixed(2)}/${totalMem.toFixed(2)}GB`;
        this.hBarItems.get('mem')!.tooltip = `Memory`;
        this.hBarItems.get('mem')!.show();
    }

    async uptimeItem(): Promise<void> {
        const data = await systeminfo.time();
        const uptime = data.uptime;
        const days = Math.floor(uptime / 86400).toString().padStart(2, '0');
        const hours = Math.floor((uptime % 86400) / 3600).toString().padStart(2, '0');
        const minutes = Math.floor(((uptime % 86400) % 3600) / 60).toString().padStart(2, '0');
        const seconds = Math.floor(((uptime % 86400) % 3600) % 60).toString().padStart(2, '0');
        this.hBarItems.get('uptime')!.text = `$(heart) ${days}:${hours}:${minutes}:${seconds}`;
        this.hBarItems.get('uptime')!.tooltip = `Uptime`;
        this.hBarItems.get('uptime')!.show();
    }
    
    async dockerItem(): Promise<void> {
        const dockerImages = await systeminfo.dockerImages();
        if (dockerImages.length === 0) {
            this.hBarItems.get('docker')!.hide();
            return;
        }
        const dockerContainers = await systeminfo.dockerContainers();

        let dockerTooltip = new vscode.MarkdownString();
        dockerTooltip.appendMarkdown(`# Docker Info\n`);
        
        // Docker images info
        dockerTooltip.appendMarkdown(`## Images\n`);
        if (dockerImages.length === 0) {
            dockerTooltip.appendMarkdown(`- No images\n`);
        } else {
            dockerTooltip.appendMarkdown(`| Name | Image ID | Created | Size |\n`);
            dockerTooltip.appendMarkdown(`| :--- | :--- | :--- | :--- |\n`);
            dockerImages.forEach((image) => {
                const name = image.repoTags[0] === undefined ? image.repoDigests[0].split('@')[0] + ":\\<none\\>" : image.repoTags[0].split(':')[0];
                dockerTooltip.appendMarkdown(`| ${name} | ${image.id.slice(7, 19)} | ${utils.formatTime(image.created)} | ${utils.formatBytes(image.size)} |\n`);
            });
        }

        // Docker containers info
        dockerTooltip.appendMarkdown(`## Containers\n`);
        if (dockerContainers.length === 0) {
            dockerTooltip.appendMarkdown(`- No running containers\n`);
        } else {
            dockerTooltip.appendMarkdown(`|Container ID | Image ID | Created | Name |\n`);
            dockerTooltip.appendMarkdown(`| :--- | :--- | :--- | :--- |\n`);
            dockerContainers.forEach((container) => {
                const name = container.name.slice(1);
                dockerTooltip.appendMarkdown(`| ${container.id.slice(7, 19)} | ${container.imageID.slice(7, 19)} | ${utils.formatTime(container.created)} | ${container.name} |\n`);
            });
        }

        this.hBarItems.get('docker')!.text = `$(package) ${dockerContainers.length} containers`;
        this.hBarItems.get('docker')!.tooltip = dockerTooltip;
        this.hBarItems.get('docker')!.show();
    }

    async userItem(): Promise<void> {
        const users = await systeminfo.users();
        users.sort((a, b) => {
            if (a.user < b.user) {
                return -1;
            } else if (a.user > b.user) {
                return 1;
            } else {
                return 0;
            }
        });
        let userTooltip = new vscode.MarkdownString();
        userTooltip.appendMarkdown(`# User Info\n`);
        userTooltip.appendMarkdown(`| User | TTY | IP | Count |\n`);
        userTooltip.appendMarkdown(`| :--- | :--- | :--- | :--- |\n`);
        let lastUser = users[0].user;
        let userCount = 0;
        users.forEach((user) => {
            if (user.user === lastUser) {
                userCount++;
            } else {
                userTooltip.appendMarkdown(`| ${lastUser} | ${user.tty} | ${user.ip} | ${userCount} |\n`);
                userCount = 1;
                lastUser = user.user;
            }
        });
        userTooltip.appendMarkdown(`| ${lastUser} | ${users[users.length - 1].tty} | ${users[users.length - 1].ip} | ${userCount} |\n`);
        this.hBarItems.get('user')!.text = `$(account) ${users.length} users`;
        this.hBarItems.get('user')!.tooltip = userTooltip;
        this.hBarItems.get('user')!.show();
    }

    async netSpeedItem(): Promise<void> {
        const netStats = await systeminfo.networkStats();
        const netInterfaces = await systeminfo.networkInterfaces();
        let upSpeed = 0;
        let downSpeed = 0;
        netStats.forEach((net) => {
            upSpeed += net.tx_sec;
            downSpeed += net.rx_sec;
        }
        );

        let netTooltip = new vscode.MarkdownString();
        netTooltip.appendMarkdown(`# Network Info\n`);
        netTooltip.appendMarkdown(`| Interface | IP | MAC |\n`);
        netTooltip.appendMarkdown(`| :--- | :--- | :--- |\n`);
        if (netInterfaces instanceof Array) {
            netInterfaces.forEach((net) => {
                netTooltip.appendMarkdown(`| ${net.iface} | ${net.ip4} | ${net.mac} |\n`);
            });
        } else {
            netTooltip.appendMarkdown(`| ${netInterfaces.iface} | ${netInterfaces.ip4} | ${netInterfaces.mac} | ${utils.formatBytes(netStats.find((netStat) => netStat.iface === netInterfaces.iface)!.tx_sec)}/s | ${utils.formatBytes(netStats.find((netStat) => netStat.iface === netInterfaces.iface)!.rx_sec)}/s |\n`);
        }
        this.hBarItems.get('net')!.text = `$(cloud-upload) ${utils.formatBytes(upSpeed)}/s  $(cloud-download) ${utils.formatBytes(downSpeed)}/s`;
        this.hBarItems.get('net')!.tooltip = netTooltip;
        this.hBarItems.get('net')!.show();
    }
}

export { HBar };