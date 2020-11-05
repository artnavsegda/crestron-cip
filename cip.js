const net = require('net');
const EventEmitter = require('events');

const cipEvents = new EventEmitter();

let client;

var digital = new Array(10000);
var analog = new Array(10000);

exports.connect = (params, callback) => {
    const client = new net.Socket();
    let intervalConnect;

    console.log("connecting to " + params.host);

    function connect() {
        client.connect({ port: 41794, host: params.host});
    };

    function launchIntervalConnect() {
        if(false != intervalConnect) return
        intervalConnect = setInterval(connect, 5000)
    }

    function clearIntervalConnect() {
        if(false == intervalConnect) return
        clearInterval(intervalConnect)
        intervalConnect = false
    }

    client.on('connect', () => {
        clearIntervalConnect();
        callback();
        let heartbeat = setInterval(()=>{
            if (client.readyState == "open")
                client.write("\x0D\x00\x02\x00\x00");
            else
                clearInterval(heartbeat);
        },5000);
    });
    
    client.on('data', (data) => {
        let index = 0;
        console.log("data length:" + data.length);
        console.log(data.toString('hex'));
    
        while (index < data.length)
        {
            let payloadType = data[index];
            console.log("type: 0x" + payloadType.toString(16));
    
            let payloadLength = data[index + 2]
            console.log("payloadLength: " + payloadLength);
    
            let payload = data.slice(index+3, index+3+payloadLength);
            console.log("payloadData: " + payload.toString('hex'));
    
            switch (payloadType)
            {
                case 0x0f:
                    console.log("Client registration request");
                    client.write("\x01\x00\x0b\x00\x00\x00\x00\x00" + params.ipid + "\x40\xff\xff\xf1\x01");
                break;
                case 0x02:
                    if (payloadLength == 4 && payload.toString('hex') == "0000200f")
                    {
                        console.log("registration ok");
                        client.write("\x05\x00\x05\x00\x00\x02\x03\x00");
                    }
                    else if (payloadLength == 3 && payload.toString('hex') == "ffff02")
                    {
                        console.log("registration failed");
                        client.end();
                    }
                break;
                case 0x05:
                    console.log("data");
                    switch(payload[3])
                    {
                        case 0x0:
                            console.log("digital join " + ((((payload[5] & 0x7F) << 8) | payload[4]) + 1) + " state " + (((payload[5] & 0x80) >> 7) ^ 0x01));
                            digital[((((payload[5] & 0x7F) << 8) | payload[4]) + 1)] = (((payload[5] & 0x80) >> 7) ^ 0x01);
                            cipEvents.emit("data", {type: "digital", join: (((payload[5] & 0x7F) << 8) | payload[4]) + 1, value: (((payload[5] & 0x80) >> 7) ^ 0x01)});
                        break;
                        case 0x14:
                            console.log("analog join " + (((payload[4] << 8) | payload[5]) + 1) + " value " + ((payload[6] << 8) + payload[7]));
                            analog[(((payload[4] << 8) | payload[5]) + 1)] = ((payload[6] << 8) + payload[7]);
                            cipEvents.emit("data", {type: "analog", join: ((payload[4] << 8) | payload[5]) + 1, value: (payload[6] << 8) + payload[7]});
                        break;
                        case 0x03:
                            console.log("update request");
                        break;
                    }
                break;
                case 0x0D:
                case 0x0E:
                    console.log("heartbeat");
                break;
            }
            index = index + payloadLength + 3;
        }
    });
    
    client.on('end', () => {
        console.log('disconnected from server');
        launchIntervalConnect();
    });

    client.on('close', launchIntervalConnect);

    client.on('error', () => {
        console.log('socket error');
        launchIntervalConnect();
    });

    connect();

    return {
        aset: (join,value) =>
        {
            let ajoin = new Uint8Array([0x05, 0x00, 0x08, 0x00, 0x00, 0x05, 0x14, 0x00, 0x00, 0x00, 0x00]);
            let dataView = new DataView(ajoin.buffer);
            dataView.setUint16(7, join-1);
            dataView.setUint16(9, value);
            client.write(ajoin);
        },
        dset: (join,value) =>
        {
            let djoin = new Uint8Array([0x05, 0x00, 0x06, 0x00, 0x00, 0x03, 0x27, 0x00, 0x00]);
            let dataView = new DataView(djoin.buffer);

            if (!value)
                join |= 0x8000;

            dataView.setUint16(7, join-1, true);
            client.write(djoin);
        },
        pulse: (join) =>
        {
            let djoin = new Uint8Array([0x05, 0x00, 0x06, 0x00, 0x00, 0x03, 0x27, 0x00, 0x00]);
            let dataView = new DataView(djoin.buffer);
            dataView.setUint16(7, join-1 | 0x8000, true);
            client.write(djoin);
            dataView.setUint16(7, join-1, true);
            client.write(djoin);
        },
        aget: (join) => analog[join],
        dget: (join) => digital[join],
        subscribe: (callback) => {
            cipEvents.on("data", (data) => {
                callback(data);
            });
        }
    }
}