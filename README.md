# Flightplan

Flightplan is a Javascript library that makes it easy to scrape and parse airline websites for award inventory. It uses Puppeteer for scraping, which is built on top of Headless Chrome, meaning it behaves just like a full-fledged web browser, but it can be run from the command line with no visible window (allowing you to use your computer for other things). Furthermore, it can run on any platform supported by Headless Chrome, which is just about everything (Windows, Mac, or Linux).

![Flightplan Web UI](https://media.giphy.com/media/3JOyfG4DUoh4bpqUvY/giphy.gif)

**Disclaimer:** Scraping is generally against an airline's website's terms of service. As mentioned above, Flightplan typically doesn't place more load on a website than a normal human would, but unlike the human, it can run 24/7. So please use responsibly! Use of any scraping tool (or even excessive non-automated usage) can cause an airline to temporarily (or permanently) ban your IP or member account.

### Website

Don't feel comfortable with a command line? Wish there was a way to use Flightplan without installing anything or waiting hours to collect data? Now you can! Just visit:

<https://www.flightplantool.com>

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

## Installation

If you are a developer using Flightplan as a library in your own Javascript project:

```bash
$ npm install flightplan-tool
# or "yarn add flightplan-tool"
```

Otherwise, if you just want to run the Flightplan tools as an end-user, you can install globally:

```bash
$ npm install --global flightplan-tool
# or "yarn global add flightplan-tool"
```

> Don't have `npm` installed? Read the [setup guide](./docs/setup.md)

## Usage

> Not a developer? Check out the section on Flightplan's [Command Line Interface](#command-line-interface).

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

## API

[API Documentation](./docs/api.md)

## Command Line Interface

Flightplan comes bundled with a set of command line tools and web UI, that makes it easy to search for flight awards, without knowing how to code! If you're a more visual person, please check out the tutorial on YouTube:

http://www.youtube.com/watch?feature=player_embedded&v=QMtiucIPOxs

<a href="http://www.youtube.com/watch?feature=player_embedded&v=QMtiucIPOxs" target="_blank"><img src="http://img.youtube.com/vi/QMtiucIPOxs/0.jpg" 
alt="Screencast: Install and use Flightplan" width="240" height="180" border="10" /></a>

> **Note:** The YouTube tutorial covers v1, so some things will be a bit different.

If you installed Flightplan globally (using the `--global` flag with `npm`) you can run the Flightplan command from anywhere. For a list of commands, run:

```bash
$ flightplan --help
Usage: flightplan [options] [command]

Options:
  -V, --version  output the version number
  -h, --help     output usage information

Commands:
  search         Search for award inventory.
  parse          Parse search results from database.
  import         Import search results from another directory.
  cleanup        Remove incomplete requests or data resources.
  stats          Print statistics on routes stored in the database.
  client         Launch the web client.
  server         Launch the web server.
  help [cmd]     display help for [cmd]
```

Each of the commands are covered in more detail below.

### Working Directory

Whenever you run the `flightplan` command, your current working directory is important. Flightplan stores data in several subdirectories inside the working directory, and will create them automatically if it cannot find them. The subdirectories it looks for are:

```bash
config/ # Stores your account credentials in accounts.txt
data/   # Webpages / screenshots when searching awards are saved here
db/     # The database containing all requests and awards found
```

To keep things organized, it's recommended to create a directory just for Flightplan (for example `C:\flightplan` or `~/flightplan`, although you can call it whatever you like). When running Flightplan, be sure to always run it from the same directory.

## Commands

### Search

Search a specific *engine* for awards, over a specified date range. If no query parameters are provided, they can be entered interactively on the command line. By default, Chrome will be visible, but can be hidden with the `--headless` flag. Awards will also be parsed and added to the database by default, but this can also be turned off with `--no-parser`. The search command is smart enough to avoid re-running queries that are already in the database, though this can be overridden with `--force`.

#### Example

```bash
# search AsiaMiles for JFK-HKG first-class awards in September 2019
$ flightplan search -w CX -f JFK -t HKG -c first -s 2019-09-01 -e 2019-09-30 -q 1
```

### Parse

By default, when searching for awards, the HTML or JSON is parsed for awards which are then written to the database. Sometimes, due to bugs or updates to the parser code, it is necessary to re-parse the awards (using the HTML/JSON files saved to disk, instead of re-running all searches, which could be very time-consuming). The parse command will look for all requests, which have not yet been parsed (in case the `--no-parser` flag was used) and will parse them. If you wish to re-parse all requests, even those that have already been parsed, use the `--force` flag.

#### Example

```bash
# forcibly re-parse all AsiaMiles awards
$ flightplan parse -w CX --force
```

### Import

If you are running Flightplan on one or more computers, and wish to combine multiple databases into a single one (so you can see all the results in the Web UI), the `import` command is used to do this. It takes the path of a database, which it will add to the database in the current working directory. In the case of conflicts (e.g. the same search exists in both databases) the data for the more recent one will be used. Request resources (HTML/JSON files and screenshots) will also be imported.

#### Example

```bash
# import data from another directory
$ flightplan import -d ~/Downloads/my-other-flightplan
```

> **Note:** May need some fixes to work properly in V2.

### Cleanup

Normally, there is a one-to-one mapping between requests in the database, and resource files saved in the `data` subdirectory. If either become orphaned they can be cleaned up using this command. You can also get rid of old data (by providing an age), so you can get more recent data when running the search command (otherwise the older data will prevent the searches from being re-run unless the `--force` flag is used).

#### Example

```bash
# remove all requests older than 2 months (durations are in ISO 8601 format)
$ flightplan cleanup -m P2M
```

> **Note:** May need some fixes to work properly in V2.

### Stats

Prints the # of requests and awards stored in the database, for all unique routes (grouped by cabin and quantity). Useful to know which routes have already been searched, and which may need additional searching to be complete.

```bash
$ flightplan stats
Opening database...
Analyzing requests table...
Analyzing awards table...

BKK-SYD:
  NH [first, 1x]: 2 requests, 9 awards
SYD-BKK:
  NH [first, 1x]: 2 requests, 9 awards
SIN-MEL:
  SQ [first, 2x]: 8 requests, 80 awards
MEL-SIN:
  SQ [first, 2x]: 5 requests, 49 awards
ORD-LHR:
  BA [economy, 1x]: 35 requests, 488 awards
LHR-ORD:
  BA [economy, 1x]: 11 requests, 134 awards

Totals:
  6 routes (3 unique)
  49 requests
  769 awards
```

### Client

Runs the Web UI, which can be accessed by pointing your web browser at `http://localhost:3000`.

> **Important:** You must also run the API server, so the client can fetch award data (see the next command).

### Server

Runs the back-end server, which reads the database and provides an API endpoint for the web client to query available awards.
