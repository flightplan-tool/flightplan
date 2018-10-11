# Flightplan

Flightplan is a Javascript library that makes it easy to scrape and parse airline websites for award inventory. It uses Puppeteer for scraping, which is built on top of headless Chrome, meaning it behaves just like a full-fledged Chrome browser, but it can be run from the command line with no visible window (allowing you to use your computer for other things). Furthermore, it can run on any platform supported by headless Chrome, which is just about everything (Windows, Mac, or Linux).

![Flightplan Web UI](https://media.giphy.com/media/3JOyfG4DUoh4bpqUvY/giphy.gif)

### Why?

If you're sitting on a pile of airline miles or credit card points, you know that redeeming them can be difficult. Often, planning for my own trips, I would spend hours clicking through an airline's website, searching for available awards, while writing down what I found in a notebook. Eventually, I decided to automate that process, so I could free up my time. Flightplan doesn't scrape much faster than a human would, it simply will do it for hours on end without complaining or making mistakes. This can make planning complex award itineraries much less stressful!

**Disclaimer:** Scraping is generally against an airline's website's terms of service. As mentioned above, Flightplan typically doesn't place more load on a website than a normal human would, but unlike the human, it can run 24/7. So please use responsibly! Use of any scraping tool (or even excessive non-automated usage) can cause an airline to temporarily (or permanently) ban your IP or member account.

### Supported Airlines

Airline                 | Website               | Search             | Parse              | Notes
------------------------|-----------------------|:------------------:|:------------------:|:------
AC (Air Canada)         | [Aeroplan][1]         | :white_check_mark: | :white_check_mark: |
BA (British Airways)    | [Executive Club][2]   | :white_check_mark: | :white_check_mark: | Award mileage not available
CX (Cathay Pacific)     | [AsiaMiles][3]        | :white_check_mark: | :white_check_mark: |
KE (Korean Air)         | [SKYPASS][4]          | :white_check_mark: | :white_check_mark: | Award mileage not available for partner awards
NH (All Nippon Airways) | [ANA Mileage Club][5] | :white_check_mark: | :white_check_mark: |
QF (Qantas)             | [Frequent Flyer][6]   | :construction:     | :construction:     | In progress
SQ (Singapore Airlines) | [KrisFlyer][7]        | :white_check_mark: | :white_check_mark: |

[1]: https://www.aeroplan.com/
[2]: https://www.britishairways.com/en-us/executive-club
[3]: https://www.asiamiles.com/
[4]: https://www.koreanair.com/global/en/skypass/
[5]: https://www.ana.co.jp/en/us/amc/
[6]: https://www.qantas.com/fflyer/dyn/program/welcome
[7]: http://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/

# Getting Started

To use Flightplan, there are a few prerequisites that must be installed:
1. Node.js 8.x or later (Installation instructions: ([Windows](http://blog.teamtreehouse.com/install-node-js-npm-windows) | [Mac](http://blog.teamtreehouse.com/install-node-js-npm-mac) | [Linux](http://blog.teamtreehouse.com/install-node-js-npm-linux))
2. Yarn ([Installation instructions](https://yarnpkg.com/lang/en/docs/install/#mac-stable))
3. Install the proper build tools for your platform:
   * **Windows:** Open an elevated PowerShell prompt (in taskbar search, type `powershell`, right-click on "Windows PowerShell" and select "Run as Administrator"). Then run `npm install --add-python-to-path --global --production windows-build-tools --vs2015`. Once the install is complete, you must restart your computer.
   * **MacOS:** Xcode will have already been installed if you followed the linked instructions to install `node` in Step 1 above.
   * **Ubuntu:** `sudo apt-get install build-essential`

If you simply wish to install and run the Flightplan tools, use:

```bash
yarn global add flightplan-tool

# Create a directory to store data in
mkdir flightplan
cd flightplan

# Explain all available commands
flightplan
```

If you're a developer, you can install Flightplan to an existing Javascript project with:

```bash
yarn add flightplan-tool
# or "npm i flightplan-tool"
```

**Note:** When you install Flightplan, it will be bundled with a recent version of Chromium automatically (so you do not need Chrome installed on your machine to use Flightplan).

## Running the tools ##

For developers who wish to use Flightplan in their own Javascript projects, skip to the [Library Usage](#library-usage) section below. For everyone else, you're in the right place! If you'd like a video introduction to using Flightplan, check out the tutorial on YouTube:

http://www.youtube.com/watch?feature=player_embedded&v=QMtiucIPOxs

<a href="http://www.youtube.com/watch?feature=player_embedded&v=QMtiucIPOxs" target="_blank"><img src="http://img.youtube.com/vi/QMtiucIPOxs/0.jpg" 
alt="Screencast: Install and use Flightplan" width="240" height="180" border="10" /></a>

```bash
# Create a directory to store data in
mkdir flightplan
cd flightplan

# Explain all available commands
flightplan

# Run a search
flightplan search
```

The first time you run the `search` command, you will be prompted to create a `config/accounts.json` file. You must enter valid credentials in this file, for any engine you will be using, or login will fail.

After you've run a search, you should see the raw HTML and screenshots in the `data` subdirectory. To extract award fares from the HTML and populate the database, run `flightplan parse`.

When you are ready to run the React web UI, run both `flightplan server` and `flightplan client`. When the React app has finished loading, a browser will automatically be opened, pointing to `http://localhost:3000/`.

## Library usage ##

With Flightplan, you specify an airline and get back an *engine*, which supports two operations: searching and parsing.

1. *Searching* simply takes a query, and fetches the HTML response (or multiple responses for some websites, which break the results up across multiple tabs).
2. *Parsing* takes those HTML responses, and returns the list of flight awards. (**Note:** currently, Flightplan ignores non-direct routes and partner awards, this may change in the future.)

This is useful, because searching is expensive, but parsing is cheap. So it makes sense to search once, but be able to parse many times (perhaps due to bug fixes or new features being added).

```javascript
const fp = require('flightplan');

const cx = fp.new('cx');

(async () => {
  // Must call initialize before searching (replace credentials with real ones below)
  await cx.initialize({ credentials: ['1234567890', 'passw0rd'] });

  // Do a one-way search
  const { responses, error } = await cx.search({
    fromCity: 'HKG', toCity: 'LHR',
    departDate: '2019-03-06', cabin: 'first'
  });
  
  // Check for an error
  if (error) {
    console.log(error);
    return;
  }
  
  // Parse out awards from the responses
  const { awards } = cx.parse(responses);
  console.log(awards);
})();
```

You can also instruct the search engine to save both the HTML output, and even screenshots! :tada: This makes debugging what might've gone wrong later much easier. Let's try it out:

```javascript
const fp = require('flightplan');

const sq = fp.new('sq');

(async () => {
  await sq.initialize({ credentials: ['1234567890', '123456'] });
  const { html, screenshots, error } = await sq.search({
    fromCity: 'SIN', toCity: 'HKG',
    departDate: '2019-09-06', cabin: 'business',
    html: { path: 'output.html' }, screenshot: { path: 'output.jpg' }
  });
    
  if (!error) {
    console.log('HTML Files:', html.length);
    console.log('Screenshots:', screenshots.length);
  }
})();
```

More API details to come later...
