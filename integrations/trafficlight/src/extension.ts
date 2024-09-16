import { window, commands, ExtensionContext, ThemeColor } from 'vscode';
import EventSource, { EventSourceInitDict } from 'eventsource';

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
const outputChannel = window.createOutputChannel('Traffic Light', { log: true});

const showStatus = (status: UserStatus) => {
	const { name, color, backgroundColor } = STATUS_INDICATIONS[status];

	statusIndicator.text = name;
	statusIndicator.color = color;
	statusIndicator.backgroundColor = backgroundColor;

	statusIndicator.show();
};

export async function activate(context: ExtensionContext) {
	let statusEvents: EventSource | undefined;

	outputChannel.show(true);

	const handleStatusEvent = (ev: MessageEvent) => {
		const data = JSON.parse(ev.data);

		outputChannel.info('Status changed event received', data);

		const status = data.data;
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
		if (!!statusEvents && statusEvents.readyState !== EventSource.CLOSED) { return; }

		await getStatus();

		const userToken = await context.secrets.get(USER_TOKEN_KEY);
		if (!userToken) {
			outputChannel.warn('Unable to subscribe to status change events because the user token is missing.');
			return;
		}

		outputChannel.info('Attempting to subscribe to status change events');

		const init: EventSourceInitDict = {
			headers: {
				'Authorization': `Bearer ${userToken}`,
			},
		};

		const eventSource = new EventSource('https://api.particle.io/v1/devices/events/status_changed', init);
		eventSource.addEventListener('status_changed', handleStatusEvent);

		eventSource.onerror = (msg) => {
			outputChannel.error('An error occurred in the status change event source.', msg);
			outputChannel.info('Status change event source ready state:', eventSource.readyState);
			eventSource.close();
		};

		statusEvents = eventSource;
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
			window.setStatusBarMessage('Deleted your particle id.', 5000);
			return;
		}

		await context.secrets.store(PARTICLE_ID_KEY, newId);
		window.setStatusBarMessage('Your new particle id is now set', 5000);
	});

	const setUserToken = commands.registerCommand('trafficlight.setUserToken', async () => {
		const newToken = await window.showInputBox({
			placeHolder: 'Enter your new particle user key.',
		});

		if (!newToken) {
			await context.secrets.delete(USER_TOKEN_KEY);
			window.setStatusBarMessage('Deleted your particle user token.', 5000);
			return;
		}

		await context.secrets.store(USER_TOKEN_KEY, newToken);
		window.setStatusBarMessage('Particle user token updated.', 5000);
	});

	const doNotDisturb = commands.registerCommand('trafficlight.doNotDisturb', async () => {
		await setStatus('DoNotDisturb');
		// if (!result) { return; }
		// showStatus(UserStatus.DO_NOT_DISTURB);
	});

	const available = commands.registerCommand('trafficlight.available', async () => {
		await setStatus('Available');
		// if (!result) { return; }
		// showStatus(UserStatus.AVAILABLE);
	});

	const busy = commands.registerCommand('trafficlight.busy', async () => {
		await setStatus('Busy');
		// if (!result) { return; }
		// showStatus(UserStatus.BUSY);
	});

	const reportConnectionStatus = () => {
		const readyState = statusEvents?.readyState;

		outputChannel.info('Connection Monitor', { readyState });
	};

	const statusChangeReconnect = setInterval(subscribeToChanges, 1000);
	const connectionMonitor = setInterval(reportConnectionStatus, 30000);

	context.subscriptions.push(statusIndicator);
	context.subscriptions.push(outputChannel);
	context.subscriptions.push(available);
	context.subscriptions.push(busy);
	context.subscriptions.push(doNotDisturb);
	context.subscriptions.push(setUserToken);
	context.subscriptions.push(setParticleId);

	context.subscriptions.push({ dispose: () => statusEvents?.close() });
	context.subscriptions.push({ dispose: () => clearTimeout(statusChangeReconnect) });
	context.subscriptions.push({ dispose: () => clearTimeout(connectionMonitor) });
}

export function deactivate() {}
