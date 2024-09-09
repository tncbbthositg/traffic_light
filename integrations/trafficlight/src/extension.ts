import { window, commands, ExtensionContext } from 'vscode';

const USER_TOKEN_KEY = 'trafficlight.usertoken';
const PARTICLE_ID_KEY = 'trafficlight.particleId';

type ParticleResponse = {
	id: string;
	name: string;
	connected: boolean;
	return_value: number;
}

type TrafficCommand = 'Available' | 'Busy' | 'DoNotDisturb';

export function activate(context: ExtensionContext) {
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
			window.showInformationMessage('Deleted your particle id.');
			return;
		}

		await context.secrets.store(PARTICLE_ID_KEY, newId);
		window.showInformationMessage('Your new particle id is now set');
	});

	const setUserToken = commands.registerCommand('trafficlight.setUserToken', async () => {
		const newToken = await window.showInputBox({
			placeHolder: 'Enter your new particle user key.',
		});

		if (!newToken) {
			await context.secrets.delete(USER_TOKEN_KEY);
			window.showInformationMessage('Deleted your particle user token.');
			return;
		}

		await context.secrets.store(USER_TOKEN_KEY, newToken);
		window.showInformationMessage('Particle user token updated.');
	});

	const doNotDisturb = commands.registerCommand('trafficlight.doNotDisturb', async () => {
		const status = await setStatus('DoNotDisturb');
		if (!status) { return; }

		window.showInformationMessage('Your traffic light is now set to Do Not Disturb.');
	});

	const available = commands.registerCommand('trafficlight.available', async () => {
		const status = await setStatus('Available');
		if (!status) { return; }

		window.showInformationMessage('Your traffic light is now set to Available.');
	});

	const busy = commands.registerCommand('trafficlight.busy', async () => {
		const status = await setStatus('Busy');
		if (!status) { return; }

		window.showInformationMessage('Your traffic light is now set to Busy.');
	});

	context.subscriptions.push(available);
	context.subscriptions.push(busy);
	context.subscriptions.push(doNotDisturb);
	context.subscriptions.push(setUserToken);
	context.subscriptions.push(setParticleId);
}

export function deactivate() {}
