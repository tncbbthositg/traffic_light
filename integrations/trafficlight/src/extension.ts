import { window, commands, ExtensionContext, StatusBarItem, ThemeColor } from 'vscode';
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

const statusIndicator: StatusBarItem = window.createStatusBarItem();

const showStatus = (status: UserStatus) => {
	const { name, color, backgroundColor } = STATUS_INDICATIONS[status];

	statusIndicator.text = name;
	statusIndicator.color = color;
	statusIndicator.backgroundColor = backgroundColor;

	statusIndicator.show();
};

export async function activate(context: ExtensionContext) {
	let statusEvents: EventSource | undefined;

	const handleStatusEvent = (ev: MessageEvent) => {
		const data = JSON.parse(ev.data);
		const status = data.data;

		showStatus(status);
	};

	const getStatus = async () => {
		const userToken = await context.secrets.get(USER_TOKEN_KEY);
		const partcileId = await context.secrets.get(PARTICLE_ID_KEY);

		if (!userToken || !partcileId) {
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
		if (!userToken) { return; }

		const init: EventSourceInitDict = {
			headers: {
				'Authorization': `Bearer ${userToken}`,
			},
		};

		const eventSource = new EventSource('https://api.particle.io/v1/devices/events/status_changed', init);
		eventSource.addEventListener('status_changed', handleStatusEvent);

		eventSource.onerror = (msg) => {
			console.error('An error occurred in the status change event source.', msg);
			console.log('Status change event source ready state:', eventSource.readyState);
			eventSource.close();
		};

		statusEvents = eventSource;
	};

	const setStatus = async (status: TrafficCommand) => {
		const userToken = await context.secrets.get(USER_TOKEN_KEY);

		if (!userToken) {
			window.showErrorMessage('You have not set a Traffic Light user token yet.');
			return false;
		}

		const partcileId = await context.secrets.get(PARTICLE_ID_KEY);

		if (!partcileId) {
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

	const statusChangeReconnect = setInterval(subscribeToChanges, 1000);

	context.subscriptions.push(statusIndicator);
	context.subscriptions.push(available);
	context.subscriptions.push(busy);
	context.subscriptions.push(doNotDisturb);
	context.subscriptions.push(setUserToken);
	context.subscriptions.push(setParticleId);

	context.subscriptions.push({ dispose: () => statusEvents?.close() });
	context.subscriptions.push({ dispose: () => clearTimeout(statusChangeReconnect) });
}

export function deactivate() {}
