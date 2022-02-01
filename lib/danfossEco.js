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

    setDeviceName = async (value) => {
        if (!(value && (typeof(value) === "string" && value.length < 16))) {
            return false;
        }

        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.DEVICE_NAME.SERVICE],
                [consts.DEVICE_NAME.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let buf = Buffer.from(value);
                if (buf.length < 16) {
                    let endBytes = [];
                    for (let i = buf.length; i < 16; i++) {
                        endBytes.push(0);
                    }
                    let endBuf = Buffer.from(endBytes);
                    buf = Buffer.concat([buf, endBuf], buf.length + endBuf.length);
                }
                characteristics[0].write(this.encrypt(buf));

                return true;
            } else {
                return false;
            }
        }
    }

    getDeviceName = async () => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.DEVICE_NAME.SERVICE],
                [consts.DEVICE_NAME.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let value = await characteristics[0].readAsync();
                let decryptValue = this.decrypt(value);

                return decryptValue.toString();
            } else {
                return false;
            }
        }
    }

    getScheduleData_1 = async () => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.SCHEDULE_1.SERVICE],
                [consts.SCHEDULE_1.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let value = await characteristics[0].readAsync();
                return this.decrypt(value);
            } else {
                return false;
            }
        }
    }

    getScheduleData_2 = async () => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.SCHEDULE_2.SERVICE],
                [consts.SCHEDULE_2.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let value = await characteristics[0].readAsync();
                return this.decrypt(value);
            } else {
                return false;
            }
        }
    }

    getScheduleData_3 = async () => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.SCHEDULE_3.SERVICE],
                [consts.SCHEDULE_3.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let value = await characteristics[0].readAsync();
                return this.decrypt(value);
            } else {
                return false;
            }
        }
    }

    setTemperatureInHomeSchedule = async (value) => {
        let scheduleData = await this.getScheduleData_1();

        if (scheduleData) {
            if (this.device) {
                const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                    [consts.SCHEDULE_1.SERVICE],
                    [consts.SCHEDULE_1.CHARACTERISTIC]
                );

                if (characteristics[0]) {
                    scheduleData.writeInt8(Math.round(value * 2), 0);
                    await characteristics[0].write(this.encrypt(scheduleData));

                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    getTemperatureInHomeSchedule = async () => {
        let scheduleData = await this.getScheduleData_1();

        if (scheduleData) {
            return scheduleData.readInt8(0) / 2;
        } else {
            return false;
        }
    }

    setTemperatureSleepSchedule = async (value) => {
        let scheduleData = await this.getScheduleData_1();

        if (scheduleData) {
            if (this.device) {
                const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                    [consts.SCHEDULE_1.SERVICE],
                    [consts.SCHEDULE_1.CHARACTERISTIC]
                );

                if (characteristics[0]) {
                    scheduleData.writeInt8(Math.round(value * 2), 1);
                    await characteristics[0].write(this.encrypt(scheduleData));

                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    getTemperatureSleepSchedule = async () => {
        let scheduleData = await this.getScheduleData_1();

        if (scheduleData) {
            return scheduleData.readInt8(1) / 2;
        } else {
            return false;
        }
    }

    getSchedule = async () => {
        let scheduleData1 = await this.getScheduleData_1();
        let scheduleData2 = await this.getScheduleData_2();
        let scheduleData3 = await this.getScheduleData_3();

        if (scheduleData1 && scheduleData2 && scheduleData3) {
            let weekSchedule = [];

            let mon = {};
            mon.schedule1 = {
                start: scheduleData1.readInt8(2) !== 0 ? scheduleData1.readInt8(2) / 2 : false,
                end: scheduleData1.readInt8(3) !== 0 ? scheduleData1.readInt8(3) / 2 : false
            };
            mon.schedule2 = {
                start: scheduleData1.readInt8(4) !== 0 ? scheduleData1.readInt8(4) / 2 : false,
                end: scheduleData1.readInt8(5) !== 0 ? scheduleData1.readInt8(5) / 2 : false
            };
            mon.schedule3 = {
                start: scheduleData1.readInt8(6) !== 0 ? scheduleData1.readInt8(6) / 2 : false,
                end: scheduleData1.readInt8(7) !== 0 ? scheduleData1.readInt8(7) / 2 : false
            };
            weekSchedule[0] = mon;

            let tue = {};
            tue.schedule1 = {
                start: scheduleData1.readInt8(8) !== 0 ? scheduleData1.readInt8(8) / 2 : false,
                end: scheduleData1.readInt8(9) !== 0 ? scheduleData1.readInt8(9) / 2 : false
            };
            tue.schedule2 = {
                start: scheduleData1.readInt8(10) !== 0 ? scheduleData1.readInt8(10) / 2 : false,
                end: scheduleData1.readInt8(11) !== 0 ? scheduleData1.readInt8(11) / 2 : false
            };
            tue.schedule3 = {
                start: scheduleData1.readInt8(12) !== 0 ? scheduleData1.readInt8(12) / 2 : false,
                end: scheduleData1.readInt8(13) !== 0 ? scheduleData1.readInt8(13) / 2 : false
            };
            weekSchedule[1] = tue;

            let wed = {};
            wed.schedule1 = {
                start: scheduleData1.readInt8(14) !== 0 ? scheduleData1.readInt8(14) / 2 : false,
                end: scheduleData1.readInt8(15) !== 0 ? scheduleData1.readInt8(15) / 2 : false
            };
            wed.schedule2 = {
                start: scheduleData1.readInt8(16) !== 0 ? scheduleData1.readInt8(16) / 2 : false,
                end: scheduleData1.readInt8(17) !== 0 ? scheduleData1.readInt8(17) / 2 : false
            };
            wed.schedule3 = {
                start: scheduleData1.readInt8(18) !== 0 ? scheduleData1.readInt8(18) / 2 : false,
                end: scheduleData1.readInt8(19) !== 0 ? scheduleData1.readInt8(19) / 2 : false
            };
            weekSchedule[2] = wed;

            let thu = {};
            thu.schedule1 = {
                start: scheduleData2.readInt8(0) !== 0 ? scheduleData2.readInt8(0) / 2 : false,
                end: scheduleData2.readInt8(1) !== 0 ? scheduleData2.readInt8(1) / 2 : false
            };
            thu.schedule2 = {
                start: scheduleData2.readInt8(2) !== 0 ? scheduleData2.readInt8(2) / 2 : false,
                end: scheduleData2.readInt8(3) !== 0 ? scheduleData2.readInt8(3) / 2 : false
            };
            thu.schedule3 = {
                start: scheduleData2.readInt8(4) !== 0 ? scheduleData2.readInt8(4) / 2 : false,
                end: scheduleData2.readInt8(5) !== 0 ? scheduleData2.readInt8(5) / 2 : false
            };
            weekSchedule[3] = thu;

            let fri = {};
            fri.schedule1 = {
                start: scheduleData2.readInt8(6) !== 0 ? scheduleData2.readInt8(6) / 2 : false,
                end: scheduleData2.readInt8(7) !== 0 ? scheduleData2.readInt8(7) / 2 : false
            };
            fri.schedule2 = {
                start: scheduleData2.readInt8(8) !== 0 ? scheduleData2.readInt8(8) / 2 : false,
                end: scheduleData2.readInt8(9) !== 0 ? scheduleData2.readInt8(9) / 2 : false
            };
            fri.schedule3 = {
                start: scheduleData2.readInt8(10) !== 0 ? scheduleData2.readInt8(10) / 2 : false,
                end: scheduleData2.readInt8(11) !== 0 ? scheduleData2.readInt8(11) / 2 : false
            };
            weekSchedule[4] = fri;

            let sat = {};
            sat.schedule1 = {
                start: scheduleData3.readInt8(0) !== 0 ? scheduleData3.readInt8(0) / 2 : false,
                end: scheduleData3.readInt8(1) !== 0 ? scheduleData3.readInt8(1) / 2 : false
            };
            sat.schedule2 = {
                start: scheduleData3.readInt8(2) !== 0 ? scheduleData3.readInt8(2) / 2 : false,
                end: scheduleData3.readInt8(3) !== 0 ? scheduleData3.readInt8(3) / 2 : false
            };
            sat.schedule3 = {
                start: scheduleData3.readInt8(4) !== 0 ? scheduleData3.readInt8(4) / 2 : false,
                end: scheduleData3.readInt8(5) !== 0 ? scheduleData3.readInt8(5) / 2 : false
            };
            weekSchedule[5] = sat;

            let sun = {};
            sun.schedule1 = {
                start: scheduleData3.readInt8(6) !== 0 ? scheduleData3.readInt8(6) / 2 : false,
                end: scheduleData3.readInt8(7) !== 0 ? scheduleData3.readInt8(7) / 2 : false
            };
            sun.schedule2 = {
                start: scheduleData3.readInt8(8) !== 0 ? scheduleData3.readInt8(8) / 2 : false,
                end: scheduleData3.readInt8(9) !== 0 ? scheduleData3.readInt8(9) / 2 : false
            };
            sun.schedule3 = {
                start: scheduleData3.readInt8(10) !== 0 ? scheduleData3.readInt8(10) / 2 : false,
                end: scheduleData3.readInt8(11) !== 0 ? scheduleData3.readInt8(11) / 2 : false
            };
            weekSchedule[6] = sun;

            return weekSchedule;
        } else {
            return false;
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
