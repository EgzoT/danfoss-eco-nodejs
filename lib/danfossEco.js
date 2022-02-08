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

    getTemperatureCurrent = async () => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.TEMPERATURE.SERVICE],
                [consts.TEMPERATURE.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let value = await characteristics[0].readAsync();
                let decryptValue = this.decrypt(value);

                return decryptValue.readInt8(1) / 2;
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

    setScheduleData_1 = async (value) => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.SCHEDULE_1.SERVICE],
                [consts.SCHEDULE_1.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                await characteristics[0].write(this.encrypt(value));

                return true;
            } else {
                return false;
            }
        } else {
            return false;
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

    setScheduleData_2 = async (value) => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.SCHEDULE_2.SERVICE],
                [consts.SCHEDULE_2.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                await characteristics[0].write(this.encrypt(value));

                return true;
            } else {
                return false;
            }
        } else {
            return false;
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

    setScheduleData_3 = async (value) => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.SCHEDULE_3.SERVICE],
                [consts.SCHEDULE_3.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                await characteristics[0].write(this.encrypt(value));

                return true;
            } else {
                return false;
            }
        } else {
            return false;
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

    setSchedule = async (scheduleData) => {
        let scheduleData1 = await this.getScheduleData_1();
        let scheduleData2 = await this.getScheduleData_2();
        let scheduleData3 = await this.getScheduleData_3();

        if (scheduleData1 && scheduleData2 && scheduleData3) {
            // Mon
            scheduleData1.writeInt8(scheduleData[0].schedule1.start, 2);
            scheduleData1.writeInt8(scheduleData[0].schedule1.end, 3);

            scheduleData1.writeInt8(scheduleData[0].schedule2.start, 4);
            scheduleData1.writeInt8(scheduleData[0].schedule2.end, 5);

            scheduleData1.writeInt8(scheduleData[0].schedule3.start, 6);
            scheduleData1.writeInt8(scheduleData[0].schedule3.end, 7);

            // Tue
            scheduleData1.writeInt8(scheduleData[1].schedule1.start, 8);
            scheduleData1.writeInt8(scheduleData[1].schedule1.end, 9);

            scheduleData1.writeInt8(scheduleData[1].schedule2.start, 10);
            scheduleData1.writeInt8(scheduleData[1].schedule2.end, 11);

            scheduleData1.writeInt8(scheduleData[1].schedule3.start, 12);
            scheduleData1.writeInt8(scheduleData[1].schedule3.end, 13);

            // Wed
            scheduleData1.writeInt8(scheduleData[2].schedule1.start, 14);
            scheduleData1.writeInt8(scheduleData[2].schedule1.end, 15);

            scheduleData1.writeInt8(scheduleData[2].schedule2.start, 16);
            scheduleData1.writeInt8(scheduleData[2].schedule2.end, 17);

            scheduleData1.writeInt8(scheduleData[2].schedule3.start, 18);
            scheduleData1.writeInt8(scheduleData[2].schedule3.end, 19);

            // Thu
            scheduleData2.writeInt8(scheduleData[3].schedule1.start, 0);
            scheduleData2.writeInt8(scheduleData[3].schedule1.end, 1);

            scheduleData2.writeInt8(scheduleData[3].schedule2.start, 2);
            scheduleData2.writeInt8(scheduleData[3].schedule2.end, 3);

            scheduleData2.writeInt8(scheduleData[3].schedule3.start, 4);
            scheduleData2.writeInt8(scheduleData[3].schedule3.end, 5);

            // Fri
            scheduleData2.writeInt8(scheduleData[4].schedule1.start, 6);
            scheduleData2.writeInt8(scheduleData[4].schedule1.end, 7);

            scheduleData2.writeInt8(scheduleData[4].schedule2.start, 8);
            scheduleData2.writeInt8(scheduleData[4].schedule2.end, 9);

            scheduleData2.writeInt8(scheduleData[4].schedule3.start, 10);
            scheduleData2.writeInt8(scheduleData[4].schedule3.end, 11);

            // Sat
            scheduleData3.writeInt8(scheduleData[5].schedule1.start, 0);
            scheduleData3.writeInt8(scheduleData[5].schedule1.end, 1);

            scheduleData3.writeInt8(scheduleData[5].schedule2.start, 2);
            scheduleData3.writeInt8(scheduleData[5].schedule2.end, 3);

            scheduleData3.writeInt8(scheduleData[5].schedule3.start, 4);
            scheduleData3.writeInt8(scheduleData[5].schedule3.end, 5);

            // Sun
            scheduleData3.writeInt8(scheduleData[6].schedule1.start, 6);
            scheduleData3.writeInt8(scheduleData[6].schedule1.end, 7);

            scheduleData3.writeInt8(scheduleData[6].schedule2.start, 8);
            scheduleData3.writeInt8(scheduleData[6].schedule2.end, 9);

            scheduleData3.writeInt8(scheduleData[6].schedule3.start, 10);
            scheduleData3.writeInt8(scheduleData[6].schedule3.end, 11);

            let result1 = await this.setScheduleData_1(scheduleData1);
            if (result1 === false) {
                return false;
            }

            let result2 = await this.setScheduleData_2(scheduleData2);
            if (result2 === false) {
                return false;
            }

            let result3 = await this.setScheduleData_3(scheduleData3);
            if (result3 === false) {
                return false;
            }

            return true;
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
                start: scheduleData1.readInt8(2),
                end: scheduleData1.readInt8(3)
            };
            mon.schedule2 = {
                start: scheduleData1.readInt8(4),
                end: scheduleData1.readInt8(5)
            };
            mon.schedule3 = {
                start: scheduleData1.readInt8(6),
                end: scheduleData1.readInt8(7)
            };
            weekSchedule[0] = mon;

            let tue = {};
            tue.schedule1 = {
                start: scheduleData1.readInt8(8),
                end: scheduleData1.readInt8(9)
            };
            tue.schedule2 = {
                start: scheduleData1.readInt8(10),
                end: scheduleData1.readInt8(11)
            };
            tue.schedule3 = {
                start: scheduleData1.readInt8(12),
                end: scheduleData1.readInt8(13)
            };
            weekSchedule[1] = tue;

            let wed = {};
            wed.schedule1 = {
                start: scheduleData1.readInt8(14),
                end: scheduleData1.readInt8(15)
            };
            wed.schedule2 = {
                start: scheduleData1.readInt8(16),
                end: scheduleData1.readInt8(17)
            };
            wed.schedule3 = {
                start: scheduleData1.readInt8(18),
                end: scheduleData1.readInt8(19)
            };
            weekSchedule[2] = wed;

            let thu = {};
            thu.schedule1 = {
                start: scheduleData2.readInt8(0),
                end: scheduleData2.readInt8(1)
            };
            thu.schedule2 = {
                start: scheduleData2.readInt8(2),
                end: scheduleData2.readInt8(3)
            };
            thu.schedule3 = {
                start: scheduleData2.readInt8(4),
                end: scheduleData2.readInt8(5)
            };
            weekSchedule[3] = thu;

            let fri = {};
            fri.schedule1 = {
                start: scheduleData2.readInt8(6),
                end: scheduleData2.readInt8(7)
            };
            fri.schedule2 = {
                start: scheduleData2.readInt8(8),
                end: scheduleData2.readInt8(9)
            };
            fri.schedule3 = {
                start: scheduleData2.readInt8(10),
                end: scheduleData2.readInt8(11)
            };
            weekSchedule[4] = fri;

            let sat = {};
            sat.schedule1 = {
                start: scheduleData3.readInt8(0),
                end: scheduleData3.readInt8(1)
            };
            sat.schedule2 = {
                start: scheduleData3.readInt8(2),
                end: scheduleData3.readInt8(3)
            };
            sat.schedule3 = {
                start: scheduleData3.readInt8(4),
                end: scheduleData3.readInt8(5)
            };
            weekSchedule[5] = sat;

            let sun = {};
            sun.schedule1 = {
                start: scheduleData3.readInt8(6),
                end: scheduleData3.readInt8(7)
            };
            sun.schedule2 = {
                start: scheduleData3.readInt8(8),
                end: scheduleData3.readInt8(9)
            };
            sun.schedule3 = {
                start: scheduleData3.readInt8(10),
                end: scheduleData3.readInt8(11)
            };
            weekSchedule[6] = sun;

            return weekSchedule;
        } else {
            return false;
        }
    }

    // Settings

    setSettings = async (value) => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.SETTINGS.SERVICE],
                [consts.SETTINGS.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                await characteristics[0].write(this.encrypt(value));

                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    getSettings = async () => {
        if (this.device) {
            const { characteristics } = await this.device.discoverSomeServicesAndCharacteristicsAsync(
                [consts.SETTINGS.SERVICE],
                [consts.SETTINGS.CHARACTERISTIC]
            );

            if (characteristics[0]) {
                let value = await characteristics[0].readAsync();
                return this.decrypt(value);
            } else {
                return false;
            }
        }
    }

    setMinTemperature = async (value) => {
        let settingsData = await this.getSettings();

        if (settingsData) {
            settingsData.writeInt8(Math.round(value * 2), 1);

            let result = await this.setSettings(settingsData);
            if (result === false) {
                return false;
            }

            return true;
        } else {
            return false;
        }
    }

    getMinTemperature = async () => {
        let minTempData = await this.getSettings();

        if (minTempData) {
            return minTempData.readInt8(1) / 2;
        } else {
            return false;
        }
    }

    setMaxTemperature = async (value) => {
        let settingsData = await this.getSettings();

        if (settingsData) {
            settingsData.writeInt8(Math.round(value * 2), 2);

            let result = await this.setSettings(settingsData);
            if (result === false) {
                return false;
            }

            return true;
        } else {
            return false;
        }
    }

    getMaxTemperature = async () => {
        let minTempData = await this.getSettings();

        if (minTempData) {
            return minTempData.readInt8(2) / 2;
        } else {
            return false;
        }
    }

    getAntiFreezeTemperature = async () => {
        let settings = await this.getSettings();

        if (settings) {
            return settings.readInt8(3) / 2;
        } else {
            return false
        }
    }

    // Device

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
