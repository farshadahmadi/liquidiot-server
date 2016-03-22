# Liquid-IoT project

The server side of the liquid-IoT project which is developed in Tampere university of Technology.

## Prerequisites

- [Nodejs and NPM](nodejs.org) >= v0.12.0
- [Git](https://git-scm.com/)

## How to run

This project is a nodejs application:

1. Clone the project. ```git clone https://github.com/farshadahmadi/liquidiot-server.git```

2. Go to the project directory you have just cloned. ```cd liquidiot-server```

3. Install needed dependencies. ```npm install```

4. There are three different config files in the root directory. You can info regarding each of them in the following:

  1. **config-template.txt.** Copy this file, name it "config.txt", and configure it. This file contanis information regarding the IoT device including device name, manufacturer, url and so on.
  
  2. **db-config-template.txt.** Copy this file, name it "dm-config.txt", and configure it. This file contanis information regarding the device manager. Right now it only has device manager url.
  
  3. **backend-config-template.txt.** Copy this file, name it "backend-config.txt", and configure it. This file contanis information regarding the IoT backend. We are using Wapice IoT backend (https://www.wapice.com/fi/tuotteet/iot-ticket-internet-of-things-ratkaisut). Right now, this file only has IoT backend url.

5. Run the project. ```npm start```


## Documentation

You can find the latest API documentation in /Documents/ folder.
