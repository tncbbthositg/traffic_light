import https, { RequestOptions } from 'https';
import { Socket } from 'net';
import { EventEmitter } from 'stream';

export type Events = 'status_changed';

export enum ConnectionStatus {
  OPEN,
  CLOSED
};

export class StatusEvents extends EventEmitter {
  private _socket: Socket | undefined;
  private _lastMessagetime = new Date();

  private handleSocketData = (buffer: Buffer) => {
    this._lastMessagetime = new Date();

    const bufferString = buffer.toString();

    let event: string | undefined;
    let data: string | undefined;

    const lines = bufferString.split(/[\r\n]+/);

    lines.forEach((line) => {
      if (line.indexOf(':') < 1) { return; }

      const [field, ...value] = line.split(':');
      const fullValue = value.join(':').trim();

      if (field === 'event') {
        event = fullValue;
      } else if (field === 'data') {
        data = fullValue;
      }
    });

    if (!event) { return; }
    this.emit(event, data);
  };

  constructor(url: string, token: string) {
    super();

    const options: RequestOptions = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    };

    const request = https.request(url, options);

    request.on('socket', (socket) => {
      this._socket = socket;
      this._socket.on('data', this.handleSocketData);
    });

    request.end();
  }

  get status() {
    const now = new Date().valueOf();
    const difference = now - this._lastMessagetime.valueOf();

    return difference < 15000 ? ConnectionStatus.OPEN : ConnectionStatus.CLOSED;
  }

  on(eventName: Events, listener: (...args: any[]) => void) {
    return super.on(eventName, listener);
  }

  dispose() {
    this._socket?.end();
  }
}
