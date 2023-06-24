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
        this.hBarItems.forEach((item) => {  
            item.show();
        });
        this._context.subscriptions.push(...this.hBarItems.values());
    }

    async update() {
        setInterval(async () => {
            this.cpuItem();
            this.memItem();
            this.uptimeItem();
            this.userItem();
            this.dockerItem();
            this.netSpeedItem();
        }, 500);
    }

    async cpuItem(): Promise<void> {
        const currentLoadData = await systeminfo.currentLoad();
        const cpuData = await systeminfo.cpu();
        let cpuTooltip = new vscode.MarkdownString();
        cpuTooltip.appendMarkdown(`# CPU Info\n`);
        cpuTooltip.appendMarkdown(`- CPU: ${cpuData.manufacturer} ${cpuData.brand} ${cpuData.speed}GHz ${cpuData.physicalCores} Physical Cores ${cpuData.cores} Cores\n`);
        this.hBarItems.get('cpu')!.text = `$(dashboard) ${currentLoadData.currentLoad.toFixed(2)}%`;
        this.hBarItems.get('cpu')!.tooltip = cpuTooltip;
    }

    async memItem(): Promise<void> {
        const memData = await systeminfo.mem();
        let memTooltip = new vscode.MarkdownString();
        const totalMem = memData.total / 1024 / 1024 / 1024;
        const usedMem = memData.active / 1024 / 1024 / 1024;
        memTooltip.appendMarkdown(`# Memory Info\n`);
        this.hBarItems.get('mem')!.text = `$(pulse) ${usedMem.toFixed(2)}/${totalMem.toFixed(2)}GB`;
        this.hBarItems.get('mem')!.tooltip = memTooltip;
    }

    async uptimeItem(): Promise<void> {
        const timeData = await systeminfo.time();
        let uptimeTooltip = new vscode.MarkdownString();
        const uptime = timeData.uptime;
        const days = Math.floor(uptime / 86400).toString().padStart(2, '0');
        const hours = Math.floor((uptime % 86400) / 3600).toString().padStart(2, '0');
        const minutes = Math.floor(((uptime % 86400) % 3600) / 60).toString().padStart(2, '0');
        const seconds = Math.floor(((uptime % 86400) % 3600) % 60).toString().padStart(2, '0');
        uptimeTooltip.appendMarkdown(`# Uptime Info\n`);
        this.hBarItems.get('uptime')!.text = `$(heart) ${days}:${hours}:${minutes}:${seconds}`;
        this.hBarItems.get('uptime')!.tooltip = uptimeTooltip;
    }
    
    async dockerItem(): Promise<void> {
        const dockerImagesData = await systeminfo.dockerImages();
        const dockerContainersData = await systeminfo.dockerContainers();
        if (dockerImagesData.length === 0) {
            this.hBarItems.get('docker')!.hide();
            return;
        }
        let dockerTooltip = new vscode.MarkdownString();
        dockerTooltip.appendMarkdown(`# Docker Info\n`);
        // Docker images info
        dockerTooltip.appendMarkdown(`## Images\n`);
        if (dockerImagesData.length === 0) {
            dockerTooltip.appendMarkdown(`- No images\n`);
        } else {
            dockerTooltip.appendMarkdown(`| Name | Tag | Image ID | Created | Size |\n`);
            dockerTooltip.appendMarkdown(`| :--- | :--- | :--- | :--- | :--- |\n`);
            dockerImagesData.forEach((image) => {
                const name = image.repoTags[0] === undefined ? image.repoDigests[0].split('@')[0] : image.repoTags[0].split(':')[0];
                const tag = image.repoTags[0] === undefined ? "\\<none\\>" : image.repoTags[0].split(':')[1];
                dockerTooltip.appendMarkdown(`| ${name} | ${tag} | ${image.id.slice(7, 19)} | ${utils.formatTime(image.created)} | ${utils.formatBytes(image.size)} |\n`);
            });
        }

        // Docker containers info
        dockerTooltip.appendMarkdown(`## Containers\n`);
        if (dockerContainersData.length === 0) {
            dockerTooltip.appendMarkdown(`- No running containers\n`);
        } else {
            dockerTooltip.appendMarkdown(`|Container ID | Image ID | Created | Name |\n`);
            dockerTooltip.appendMarkdown(`| :--- | :--- | :--- | :--- |\n`);
            dockerContainersData.forEach((container) => {
                const name = container.name.slice(1);
                dockerTooltip.appendMarkdown(`| ${container.id.slice(7, 19)} | ${container.imageID.slice(7, 19)} | ${utils.formatTime(container.created)} | ${container.name} |\n`);
            });
        }

        this.hBarItems.get('docker')!.text = `$(package) ${dockerContainersData.length} containers`;
        this.hBarItems.get('docker')!.tooltip = dockerTooltip;
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
    }
}

export { HBar };
