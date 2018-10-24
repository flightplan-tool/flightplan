# Setup Guide

In order to install Flightplan, there are a few development tools needed first. The below steps will guide you through installing them.

### Node.js

To run Javascript programs outside the browser, you'll need to install a JavaScript runtime, called Node.js. The method is slightly different, depending on your platform.

#### Windows

1. Download and run the [Node.js Installer](https://nodejs.org/en/). Choose the Current version instead of the LTS version.

> **Note:** After the installer completes, be sure to restart your computer.

2. Open an elevated PowerShell prompt (in taskbar search, type `powershell`, right-click on "Windows PowerShell" and select "Run as Administrator"). Then run:

```bash
> npm install --add-python-to-path --global --production windows-build-tools --vs2015
```

> **Note:** Once the install is complete, you must restart your computer again.

#### MacOS

1. Install XCode from the [Apple App Store](https://itunes.apple.com/us/app/xcode/id497799835?mt=12).

2. Open a Terminal window, and run the following command to install the XCode command line tools:

```bash
$ xcode-select --install
```

3. Install [HomeBrew](https://brew.sh), following the instructions on their website.

4. Open a Terminal window, and run:
```bash
$ brew install node
```

#### Ubuntu

1. Make sure `curl` is installed, by opening Terminal and running:

```bash
$ sudo apt install curl
```

2. Add the PPA for the latest Node.js release:

```bash
$ curl -sL https://deb.nodesource.com/setup_10.x | sudo bash -
```

3. Now install Node.js and NPM:

```bash
$ sudo apt install -y nodejs
```

4. Finally, install the build tools:

```bash
$ sudo apt install -y build-essential
```

## Verify Your Setup

To make sure Node.js and NPM were installed successfully, open up a command line (cmd.exe or PowerShell on Windows, or Terminal on MacOS or Ubuntu), and run the following commands:

```bash
$ node -v
v10.12.0

$ npm -v
6.2.0
```

Your versions may be slightly different, just be sure there are no error messages.

## Installing Flightplan

The final step is to install Flightplan itself:

```bash
$ npm install --global flightplan-tool
```

If you received any errors, please [file an issue](https://github.com/flightplan-tool/flightplan/issues/new). Otherwise, run the following command to verify Flightplan was installed properly:

```bash
$ flightplan --version
0.2.7
```

Again, your exact version may be slightly different, that's OK.

**Note:** When you install Flightplan, it will be bundled with a recent version of Chromium automatically (so you do not need Chrome installed on your machine to use Flightplan).
