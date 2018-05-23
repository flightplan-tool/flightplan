# Flightplan

Flightplan is a Javascript library that makes it easy to scrape and parse airline websites for award inventory. It uses Puppeteer for scraping, which is built on top of headless Chrome, meaning it behaves just like a full-fledged Chrome browser, but it can be run from the command line with no visible window (allowing you to use your computer for other things). Furthermore, it can run on any platform supported by headless Chrome, which is just about everything (Windows, Mac, or Linux).

### Why?

If you're sitting on a pile of airline miles or credit card points, you know that redeeming them can be difficult. Often, planning for my own trips, I would spend hours clicking through an airline's website, searching for available awards, while writing down what I found in a notebook. Eventually, I decided to automate that process, so I could free up my time. Flightplan doesn't scrape much faster than a human would, it simply will do it for hours on end without complaining or making mistakes. This can make planning complex award itineraries much less stressful!

**Disclaimer:** Scraping is generally against an airline's website's terms of service. As mentioned above, Flightplan typically doesn't place more load on a website than a normal human would, but unlike the human, it can run 24/7. So please use responsibly! Use of any scraping tool (or even excessive non-automated usage) can cause an airline to temporarily (or permanently) ban your IP or member account.

### Supported Airlines

Airline                 | Website               | Search             | Parse
------------------------|-----------------------|:------------------:|:------------------:
CX (Cathay Pacific)     | [AsiaMiles][1]        | :warning:          | :white_check_mark:
KE (Korean Air)         | [SKYPASS][2]          | :white_check_mark: | :x:
NH (All Nippon Airways) | [ANA Mileage Club][3] | :white_check_mark: | :x:
SQ (Singapore Airlines) | [KrisFlyer][4]        | :white_check_mark: | :x:

[1]: https://www.asiamiles.com/
[2]: https://www.koreanair.com/global/en/skypass/
[3]: https://www.ana.co.jp/en/us/amc/
[4]: http://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/

**Notes:** CX searches are being blocked aggressively, needs more investigation as to the cause.

# Geting Started

To use Flightplan, there are a few prerequisites that must be installed:
1. Node.js (Installation instructions: [Windows](http://blog.teamtreehouse.com/install-node-js-npm-windows) | [Mac](http://blog.teamtreehouse.com/install-node-js-npm-mac) | [Linux](http://blog.teamtreehouse.com/install-node-js-npm-linux))
2. Yarn ([Installation instructions](https://yarnpkg.com/lang/en/docs/install/#mac-stable))

To add Flightplan to an existing Javascript project, simply use:

```bash
yarn add flightplan-tool
# or "npm i flightplan-tool"
```

If using Flightplan stand-alone, then run:

```bash
# Create a directory for Flightplan
mkdir flightplan && cd flightplan

# Initialize a new project
yarn init -y

# Install Flightplan
yarn add flightplan-tool
```

**Note:** When you install Flightplan, it will be bundled with a recent version of Chromium automatically (so you do not need Chrome installed on your machine to use Flightplan).

## Usage ##

With Flightplan, you specify an airline and get back an *engine*, which supports two operations: searching and parsing.

1. *Searching* simply takes a query, and fetches the HTML response (or multiple responses for some websites, which break the results up across multiple tabs).
2. *Parsing* takes those HTML responses, and returns the list of flight awards. (**Note:** currently, Flightplan ignores non-direct routes and partner awards, this may change in the future.)

This is useful, because searching is expensive, but parsing is cheap. So it makes sense to search once, but be able to parse many times (perhaps due to bug fixes or new features being added).

```javascript
import fp from flightplan

const cx = fp.new('cx')

(async () => {
  // Must call initialize before searching
  const success = await cx.initialize({ username: '1234567890', 'password': 'passw0rd' })
  if (!success)
    return
  }

  // Do a one-way search (replace credentials with real ones below)
  const { responses, error } = await cx.search({
    fromCity: 'HKG', toCity: 'LHR',
    departDate: '2019-03-06', cabin: 'first'
  })
  
  // Check for an error
  if (error) {
    console.log(error)
    return
  }
  
  // Parse out awards from the responses
  const { awards } = cx.parse(responses)
  console.log(awards)
})
```

You can also instruct the search engine to save both the HTML output, and even screenshots! :tada: This makes debugging what might've gone wrong later much easier. Let's try it out:

```javascript
import fp from flightplan

const sq = fp.new('sq')

(async () => {
  if (await sq.initialize({ username: '1234567890', password: '123456' })) {
    const { htmlFiles, screenshots, fileCount, error } = sq.search({
      fromCity: 'SIN', toCity: 'HKG',
      departDate: '2019-03-06', cabin: 'business',      
      htmlFile: 'output.html', screenshot: 'output.jpg'
    })
    
    if (!error) {
      console.log('Files Saved:', fileCount)
      console.log('HTML:', htmlFiles)
      console.log('Screenshots:', screenshots)
    }
  }
})
```

More API details to come later...
