import { window, commands, ExtensionContext, ThemeColor } from 'vscode';
import { ConnectionStatus, StatusEvents } from './StatusEvents';

const USER_TOKEN_KEY = 'trafficlight.usertoken';
const PARTICLE_ID_KEY = 'trafficlight.particleId';

enum UserStatus {
  AVAILABLE = 0,
  BUSY,
  DO_NOT_DISTURB,
};

type ParticleResponse = {
	id: string;
	name: string;
	connected: boolean;
	return_value: number;
}

type TrafficCommand = 'Available' | 'Busy' | 'DoNotDisturb';

type StatusIndication = {
	name: string;
	color: ThemeColor;
	backgroundColor?: ThemeColor;
}

const STATUS_INDICATIONS: Record<UserStatus, StatusIndication> = {
	[UserStatus.AVAILABLE]: {
		name: 'Available',
		color: '#00ff00'
	},
	[UserStatus.BUSY]: {
		name: 'Busy',
		color: new ThemeColor('statusBarItem.warningForeground'),
		backgroundColor: new ThemeColor('statusBarItem.warningBackground')
	},
	[UserStatus.DO_NOT_DISTURB]: {
		name: 'DND',
		color: new ThemeColor('statusBarItem.errorForeground'),
		backgroundColor: new ThemeColor('statusBarItem.errorBackground')
	},
};

const statusIndicator = window.createStatusBarItem();
statusIndicator.command = 'trafficlight.showPicker';

const outputChannel = window.createOutputChannel('Traffic Light', { log: true});

export async function activate(context: ExtensionContext) {
	let statusEvents: StatusEvents | undefined;
	let currentStatus: UserStatus | undefined;

	outputChannel.show(true);

	const showStatus = (status: UserStatus) => {
		const { name, color, backgroundColor } = STATUS_INDICATIONS[status];

		statusIndicator.text = name;
		statusIndicator.color = color;
		statusIndicator.backgroundColor = backgroundColor;

		statusIndicator.show();
		currentStatus = status;
	};

	const handleStatusEvent = (message: string) => {
		const data = JSON.parse(message);
		outputChannel.info('Status changed event received', data);

		const status = Number(data.data);
		showStatus(status);
	};

	const getStatus = async () => {
		const userToken = await context.secrets.get(USER_TOKEN_KEY);
		const partcileId = await context.secrets.get(PARTICLE_ID_KEY);

		if (!userToken || !partcileId) {
			outputChannel.warn('Unable to retrieve current status because the user token or particle id is missing.');
			return false;
		}

		const init: RequestInit = {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${userToken}`,
			},
		};

		const response = await fetch(`https://api.particle.io/v1/devices/${partcileId}/status`, init);
		const body = await response.json() as any;

		showStatus(body?.result);

		return true;
	};

	const subscribeToChanges = async () => {
		if (!!statusEvents && statusEvents.status === ConnectionStatus.OPEN) { return; }

		await getStatus();

		const userToken = await context.secrets.get(USER_TOKEN_KEY);
		if (!userToken) {
			outputChannel.warn('Unable to subscribe to status change events because the user token is missing.');
			return;
		}

		const action = !!statusEvents ? 'resubscribe' : 'subscribe';
		outputChannel.info(`Attempting to ${action} to status change events`);

		statusEvents = new StatusEvents('https://api.particle.io/v1/devices/events/status_changed', userToken);
		statusEvents.on('status_changed', handleStatusEvent);
	};

	const setStatus = async (status: TrafficCommand) => {
		const userToken = await context.secrets.get(USER_TOKEN_KEY);

		if (!userToken) {
			outputChannel.warn('User has not set a Traffic Light user token yet.');
			window.showErrorMessage('You have not set a Traffic Light user token yet.');
			return false;
		}

		const partcileId = await context.secrets.get(PARTICLE_ID_KEY);

		if (!partcileId) {
			outputChannel.warn('User has not set a Traffic Light particle id yet.');
			window.showErrorMessage('You have not set a particle id yet.');
			return false;
		}

		const init: RequestInit = {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${userToken}`,
			},
		};

		const response = await fetch(`https://api.particle.io/v1/devices/${partcileId}/set${status}`, init);
		const result = await response.json() as ParticleResponse;

		if (result.return_value !== 1) {
			outputChannel.error('Unable to update traffic light status.', result);
			window.showErrorMessage('Unable to update traffic light status. :(');
			return false;
		}

		return true;
	};

	const setParticleId = commands.registerCommand('trafficlight.setParticleId', async () => {
		const newId = await window.showInputBox({
			placeHolder: 'Enter your new particle id.',
		});

		if (!newId) {
			await context.secrets.delete(PARTICLE_ID_KEY);
			window.showWarningMessage('Deleted your particle id.');
			return;
		}

		await context.secrets.store(PARTICLE_ID_KEY, newId);
		window.showInformationMessage('Your new particle id is now set.');
	});

	const setUserToken = commands.registerCommand('trafficlight.setUserToken', async () => {
		const newToken = await window.showInputBox({
			placeHolder: 'Enter your new particle user key.',
		});

		if (!newToken) {
			await context.secrets.delete(USER_TOKEN_KEY);
			window.showWarningMessage('Deleted your particle user token.');
			return;
		}

		await context.secrets.store(USER_TOKEN_KEY, newToken);
		window.showInformationMessage('Particle user token updated.');
	});

	const doNotDisturb = commands.registerCommand('trafficlight.doNotDisturb', async () => {
		await setStatus('DoNotDisturb');
	});

	const available = commands.registerCommand('trafficlight.available', async () => {
		await setStatus('Available');
	});

	const busy = commands.registerCommand('trafficlight.busy', async () => {
		await setStatus('Busy');
	});

	const showPicker = commands.registerCommand('trafficlight.showPicker', async () => {
		const isAvailable = (currentStatus ?? UserStatus.AVAILABLE) === UserStatus.AVAILABLE;
		const newStatus = isAvailable ? 'DoNotDisturb' : 'Available';

		outputChannel.info(`Toggling status to ${newStatus}`);
		await setStatus(newStatus);
	});

	const resubscribeInterval = setInterval(subscribeToChanges, 1000);

	context.subscriptions.push(statusIndicator);
	context.subscriptions.push(outputChannel);
	context.subscriptions.push(available);
	context.subscriptions.push(busy);
	context.subscriptions.push(doNotDisturb);
	context.subscriptions.push(showPicker);
	context.subscriptions.push(setUserToken);
	context.subscriptions.push(setParticleId);

	context.subscriptions.push({ dispose: () => statusEvents?.dispose() });
	context.subscriptions.push({ dispose: () => clearInterval(resubscribeInterval) });
}

export function deactivate() {}
