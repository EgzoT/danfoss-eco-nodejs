var noble = require('@abandonware/noble');
var xxtea = require('../xxtea-nodejs/lib/xxtea');
var consts = require('./const.js');
const EventEmitter = require('events');

class DanfossEco {
    constructor() {
        this.event = new EventEmitter();
        this.device = false;
        this.key = false;
    }

    connect = async (address) => {
        this.device = false;

        noble.on('discover', async (device) => {
            await this._onFindDevice(address, device)
        });

        await noble.startScanningAsync([], false);
    }

    disconnect = async () => {
        if (this.device) {
            await this.device.disconnectAsync();
            this.device = false;
        }
    }

    setKey = (value) => {
        this.key = value;
    }

    setKeyBase64 = (value) => {
        this.key = Buffer.from(value, 'base64')
    }

    // Actions

    getKey = async () => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.KEY.SERVICE],
                [consts.KEY.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                return await characteristics[0].readAsync();
            } else {
                return false;
            }
        }
    }

    getKeyBase64 = async () => {
        let keyBuffer = await this.getKey();
        if (keyBuffer !== false) {
            return keyBuffer.toString('base64');
        } else {
            return false;
        }
    }

    login = async (pin) => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.PIN.SERVICE],
                [consts.PIN.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let bytes = Buffer.from(pin);
                return await characteristics[0].writeAsync(bytes, false);
            } else {
                return false;
            }
        }
    }

    changeByteOrder = (data) => {
        let byteArray = Buffer.from(data);    
        let length = byteArray.length;

        // padding
        let padding = Buffer.allocUnsafe(0);
        if (length%4) {
            padding = Buffer.from(4 - (length % 4));
        }
        byteArray = Buffer.concat([byteArray, padding], byteArray.length + padding.length);
        length = byteArray.length;

        // reversing
        for (let i = 0; i < length >> 2; i++) {
            let reversePart = byteArray.slice(i * 4, (i + 1) * 4);
            reversePart.reverse();
            let startPart = byteArray.slice(0, i * 4);
            let endPart = byteArray.slice((i + 1) * 4, byteArray.length);
            byteArray = Buffer.concat([startPart, reversePart, endPart], startPart.length + reversePart.length + endPart.length);
        }

        return byteArray;
    }

    encrypt = (data) => {
        return this.changeByteOrder(Buffer.from(xxtea.encrypt(new Uint8Array(this.changeByteOrder(data)), new Uint8Array(this.key), false)));
    }

    decrypt = (data) => {
        return this.changeByteOrder(Buffer.from(xxtea.decrypt(new Uint8Array(this.changeByteOrder(data)), new Uint8Array(this.key), false)));
    }

    setTemperature = async (value) => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.TEMPERATURE.SERVICE],
                [consts.TEMPERATURE.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                const buf = Buffer.allocUnsafe(8);
                buf.writeInt8(Math.round(value * 2), 0, 0, 0, 0, 0, 0, 0);
                characteristics[0].write(this.encrypt(buf));

                return true;
            } else {
                return false;
            }
        }
    }

    getTemperature = async () => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.TEMPERATURE.SERVICE],
                [consts.TEMPERATURE.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let value = await characteristics[0].readAsync();
                let decryptValue = this.decrypt(value);

                let returnData = { currentTemp: false, targetTemp: false };
                returnData.currentTemp = decryptValue.readInt8(1) / 2;
                returnData.targetTemp = decryptValue.readInt8(0) / 2;

                return returnData;
            } else {
                return false;
            }
        }
    }

    getBatteryLevel = async () => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.BATTERY.SERVICE],
                [consts.BATTERY.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let value = await characteristics[0].readAsync();

                return value.readInt8(0);
            } else {
                return false;
            }
        }
    }

    // Events

    // device found

    onceDeviceFound = (listener) => {
        this.event.once('deviceFound', listener);
    }

    removeListenerDeviceFound = (listener) => {
        this.event.removeListener('deviceFound', listener);
    }

    // device connect

    onceDeviceConnect = (listener) => {
        this.event.once('deviceConnect', listener);
    }

    removeListenerDeviceConnect = (listener) => {
        this.event.removeListener('deviceConnect', listener);
    }

    // device connect error

    onDeviceConnectError = (listener) => {
        this.event.on('connectError', listener);
    }

    onceDeviceConnectError = (listener) => {
        this.event.once('connectError', listener);
    }

    removeListenerDeviceConnectionError = (listener) => {
        this.event.removeListener('connectError', listener);
    }

    // Additional

    _onFindDevice = async (address, device) => {
        if (device.address === address) {
            await noble.stopScanningAsync();

            this.event.emit('deviceFound', device);

            device.once('connect', () => {
                this.device = device;

                this.event.emit('deviceConnect', device);
            });

            device.connect(this._onConnectError);
        }
    }

    _onConnectError = (error) => {
        this.event.emit('connectError', error);
    }
}

module.exports = DanfossEco;
