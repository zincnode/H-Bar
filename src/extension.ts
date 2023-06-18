import * as vscode from 'vscode';
import systeminfo = require('systeminformation');
import * as os from 'os';

export const platform = os.platform();
export const isWin32 = platform === 'win32';

export function systeminfoInit() {
	if (isWin32) {
		systeminfo.powerShellStart();
	}
}

let cpuItem: vscode.StatusBarItem;
let memItem: vscode.StatusBarItem;
let uptimeItem: vscode.StatusBarItem;
let dockerItem: vscode.StatusBarItem;

export function activate({ subscriptions }: vscode.ExtensionContext) {
	cpuItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -100);
	memItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -110);
	uptimeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -120);
	dockerItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -130);
	subscriptions.push(cpuItem, memItem, uptimeItem, dockerItem);

	setInterval(allUpdate, 500);
}

async function allUpdate(): Promise<void>{
	systeminfoInit();
	getCPUUsage();
	getMemoryUsage();
	getUptime();
	getDockerUsage();
	getCPUInfo();
	getDockerInfo();
}


async function getCPUInfo(): Promise<string> {
	const cpuData = await systeminfo.cpu();
	const cpuInfo = `CPU: ${cpuData.manufacturer} ${cpuData.brand} ${cpuData.speed}GHz ${cpuData.physicalCores}C${cpuData.cores}T`;
	cpuItem.tooltip = cpuInfo;
	return cpuInfo;
}

async function getDockerInfo(): Promise<string> {
	const containersData = await systeminfo.dockerContainers();
	const imagesData = await systeminfo.dockerImages();
	const infoData = await systeminfo.dockerInfo();
	let dockerInfo = "";

	let imageInfo = new Array();
	for (let i = 0; i < imagesData.length; i++) {
		let dockerImageSize = "";
		if (imagesData[i].size / 1024 / 1024 / 1024 > 1) {
			dockerImageSize = `${(imagesData[i].size / 1024 / 1024 / 1024).toFixed(2)}GB`;
		}
		else if (imagesData[i].size / 1024 / 1024 > 1) {
			dockerImageSize = `${(imagesData[i].size / 1024 / 1024).toFixed(2)}MB`;
		}
		else {
			dockerImageSize = `${(imagesData[i].size / 1024).toFixed(2)}KB`;
		}
		imageInfo[i] = new Array();
		if (imagesData[i].repoTags[0] == undefined) {
			imageInfo[i][0] = "<none>";
		} else {
			imageInfo[i][0] = imagesData[i].repoTags[0] as string;
		}

		imageInfo[i][1] = imagesData[i].id.slice(7, 19) as string;
		imageInfo[i][2] = dockerImageSize;
	}

	let maxRepoTagsLength = 0;
	let maxIdLength = 0;
	let maxSizeLength = 0;
	for (let i = 0; i < imageInfo.length; i++) {
		if (imageInfo[i][0].length > maxRepoTagsLength) {
			maxRepoTagsLength = imageInfo[i][0].length;
		}
		if (imageInfo[i][1].length > maxIdLength) {
			maxIdLength = imageInfo[i][1].length;
		}
		if (imageInfo[i][2].length > maxSizeLength) {
			maxSizeLength = imageInfo[i][2].length;
		}
	}

	dockerInfo += `Docker Images:\n`;
	for (let i = 0; i < imageInfo.length; i++) {
		dockerInfo += `${imageInfo[i][0]}`;
		for (let j = 0; j < maxRepoTagsLength - imageInfo[i][0].length; j++) {
			dockerInfo += " ";
		}
		dockerInfo += `\t${imageInfo[i][1]}`;
		for (let j = 0; j < maxIdLength - imageInfo[i][1].length; j++) {
			dockerInfo += " ";
		}
		dockerInfo += `\t${imageInfo[i][2]}\n`;
	}

	let containerInfo = new Array();
	for (let i = 0; i < containersData.length; i++) {
		containerInfo[i] = new Array();
		containerInfo[i][0] = containersData[i].id.slice(0, 12);

		if (containersData[i].image != containersData[i].imageID) {
			containerInfo[i][1] = containersData[i].image + " (" + containersData[i].imageID.slice(7, 19) + ")";
		} else {
			containerInfo[i][1] = "<none> (" + containersData[i].imageID.slice(7, 19) + ")";
		}

		containerInfo[i][2] = containersData[i].name;
	}

	let maxContainerImageLength = 0;

	for (let i = 0; i < containerInfo.length; i++) {
		if (containerInfo[i][1].length > maxContainerImageLength) {
			maxContainerImageLength = containerInfo[i][1].length;
		}
	}

	dockerInfo += "\nRunning Containers:\n";

	for (let i = 0; i < containerInfo.length; i++) {
		dockerInfo += `${containerInfo[i][0]}\t${containerInfo[i][1]}`;
		for (let j = 0; j < maxContainerImageLength - containerInfo[i][1].length; j++) {
			dockerInfo += " ";
		}
		dockerInfo += `\t${containerInfo[i][2]}\n`;
	}

	dockerItem.tooltip = dockerInfo;
	return dockerInfo;
}

async function getCPUUsage(): Promise<void> {
	const data = await systeminfo.currentLoad();
	cpuItem.text = `$(pulse) ${data.currentLoad.toFixed(2)}%`;
	cpuItem.show();
}

async function getMemoryUsage(): Promise<void> {
	const data = await systeminfo.mem();
	const total = data.total / 1024 / 1024 / 1024;
	const used = data.active / 1024 / 1024 / 1024;
	memItem.text = `$(database) ${used.toFixed(2)}/${total.toFixed(2)}GB`;
	memItem.show();
}

async function getUptime(): Promise<void> {
	const data = await systeminfo.time();
	const uptime = data.uptime;
	const days = Math.floor(uptime / 86400);
	const hours = Math.floor((uptime % 86400) / 3600);
	const minutes = Math.floor(((uptime % 86400) % 3600) / 60);
	const seconds = Math.floor(((uptime % 86400) % 3600) % 60);
	const uptimeString = `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	uptimeItem.text = `$(heart) ${uptimeString}`;
	uptimeItem.show();
}

async function getDockerUsage(): Promise<void> {
	const data = await systeminfo.dockerContainers();
	dockerItem.text = `$(package) ${data.length} running containers`;
	dockerItem.show();
}

export function deactivate() { }
