# API

##### Table of Contents

- [Overview](#overview)
- [Error handling](#error-handling)
- [class: Flightplan](#class-flightplan)
- [class: Engine](#class-engine)
- [class: Config](#class-config)
- [class: BookingClass](#class-bookingclass)
- [class: Searcher](#class-searcher)
- [class: Parser](#class-parser)
- [class: Query](#class-query)
- [class: Results](#class-results)
- [class: Flight](#class-flight)
- [class: Segment](#class-segment)
- [class: Award](#class-award)
- [Simple Duration](#simple-duration)

# Overview

`Flightplan` is the entry point to the Flightplan library. From it, you can create a new [`Engine`], which will allow you to run award searches and get back the results (represented as a hierarchy of [`Flight`] and [`Award`] instances). Adding support for a new airline website to Flightplan is easy! Simply define a new [`Searcher`] and [`Parser`], and register them along with a [`Config`] in `./src/engines/index.js`.

In the diagram below, you can see the full class hierarchy. The classes with a dotted outline have a subclass defined for each supported airline website, that provides the knowledge specific to that website. Searches are run by creating a [`Query`], and passing it to the [`engine.search()`](#engine-search-query) method. In return, you receive back a [`Results`] object, that contains the assets (HTML, JSON, screenshots) collected from the search results. You can access the list of either [`Award`] or [`Flight`] instances, from the [`Results`]. Each [`Flight`] has one or more [`Segment's`](#class-segment), which fully describes the flight itinerary (airlines, aircraft, cities, date and times of departure and arrival, etc...). The flight itself contains one or more [`Award`] instances, which represent the award availability for that flight. Each [`Award`] *belongs* to a single [`Flight`], and it's unique parent can always be accessed using the [`award.flight`](#award-flight) property. When a flight is accessed this way, it's segments automatically populate their `cabin` property with the cabin of service indicated by the [`Award`]. When a flight is accessed directly (not via [`award.flight`](#award-flight)) the segments will have no cabin assignment.

<img src="https://raw.githubusercontent.com/flightplan-tool/flightplan/master/docs/Classes.png" width="645" height="654">

# Error Handling

Flightplan has two special error types: `Searcher.Error` and `Parser.Error`. You can think of two classes of errors:

1. `Searcher.Error`, `Parser.Error`: Errors which fall outside of our control (we cannot prevent them).
2. `Error`: Regular errors due to unexpected behavior or bugs in the code base.

Some examples of this first type could be:
- An airline website is down for maintenance
- The airline website itself encountered an unexpected error
- There could be connection issues
- The airline website may have blocked your account or IP address
- The airline website may not support our query (maybe the dates are outside the valid range, or we're searching for a combination of parameters that isn't supported)

For all these types of scenarios, which can be predicted, but not prevented, both [`Searcher`] and [`Parser`] should throw their respective custom `Error` class. Such errors are caught by [`Engine`] and [`Results`], and set on the [`Results`] object rather than propagating the error further (see [`results.error`](#results-error)).

The reason for this, is knowing the type of error can be useful upstream. For example, if the failure reason is beyond our control, we know that retrying the search later may be successful, or that this error may be benign because nothing we can do will fix it. Unexpected errors on the other hand, are useful indicators that the fault lies in the Flightplan code base, and warrants [filing an issue](https://github.com/flightplan-tool/flightplan/issues).

# class: Flightplan

Flightplan module provides a method to create an [Engine], used to execute award searches against an airline website. This is a typical example:

```javascript
const fp = require('flightplan-tool')

const cx = fp.new('CX')
await cx.initialize()
const results = await cx.search({ ... })
console.log(`Found: ${results.awards.length} awards`)
// more searches...
await cx.close()
```

#### Methods
- [fp.new(*airline*)](#fp-new-airline)
- [fp.supported([*airline*])](#fp-supported-airline)

#### Properties
- [fp.aircraft](#fp-aircraft)
- [fp.airlines](#fp-airlines)
- [fp.airports](#fp-airports)
- [fp.cabins](#fp-cabins)
- [fp.cabinCodes](#fp-cabincodes)
- [fp.profiles](#fp-profiles)

### fp.new(*airline*)

- `airline` <[string]> 2-letter airline IATA code.
- returns: <[Engine]>

Create a new [Engine] for the provided airline's website and returns it.

Examples:

```javascript
fp.new('SQ') // Create an engine to search KrisFlyer awards
```

### fp.supported([*airline*])

- `airline` <[string]> Optional 2-letter airline IATA code.
- returns: <[boolean]|[Array]> `true` if the specified airline's website is supported. If no `airline` is specified, an [Array] of all supported airlines will be returned.

Used to check which airline websites can be searched by Flightplan.

Examples:

```javascript
fp.supported('BA') // Returns true
fp.supported() // Returns [ 'AC', 'BA', 'CX', ... ]
```

### fp.aircraft

- returns: <[Array]> List of known aircraft
  - `iata` <[string]> 3-letter IATA code of the aircraft
  - `icao` <[string]> 4-letter ICAO code of the aircraft
  - `name` <[string]> Common name for the aircraft

Examples:

```javascript
fp.aircraft.find(x => x.icao === 'B777')
// Returns { iata: '777', icao: 'B777', name: 'Boeing 777-200/300' }
```

### fp.airlines

- returns: <[Array]> List of known airlines
  - `iata` <[string]> 2-letter IATA code of the airline
  - `icao` <[string]> 3-letter ICAO code of the airline
  - `name` <[string]> Common name of the airline
  - `callsign` <[string]> Callsign used by the airline
  - `aliases` <[Array<[string]>]> List of other names that may be commonly used, or `null`
  - `alliances` <[Array<[string]>]> List of alliances this airline belongs to, or `null`

Examples:

```javascript
fp.aircraft.find(x => x.icao === 'SIA')
// Returns { iata: 'SQ', icao: 'SIA', name: 'Singapore Airlines', callsign: 'SINGAPORE', aliases: [ 'Singapore Airlines Ltd' ], alliances: [ 'KF', '*A' ] }
```

### fp.airports

- returns: <[Object]> Map of known airports. Keys are 3-letter IATA airport codes. Values are objects which may contain:
  - `name` <[string]> Common name of the airport
  - `city` <[string]> Name of the airport's city, or `null`
  - `country` <[string]> Name of the airport's country, or `null`
  - `timezone` <[string]> Name of the airport's time zone, or `null`
  - `offset` <[string]> UTC offset of the airport's time zone

Airport data is primarily used by Flightplan to map airport arrival and departure times to their proper time zone, so itineraries can be properly understood.

Examples:

```javascript
fp.airports['JFK']
// Returns { name: 'John F Kennedy International Airport', city: 'New York', country: 'United States', time zone: 'America/New_York', offset: -5 }
```

### fp.cabins

- returns: <[Object]<[string], [string]>> Map, whose both keys and values represent known cabins

All awards are mapped to this set of cabins (one cabin per [Segment] of a [Flight]). Current supported values are: `first`, `business`, `premium`, and `economy`.

Examples:

```javascript
fp.cabins.first // Returns 'first'
Object.keys(fp.cabins) // Returns [ 'first', 'business', 'premium', 'economy' ]
```

### fp.cabinCodes

- returns: <[Object]<[string], [string]>> Map, whose keys represent known cabins

Same as [fp.cabins](#fp-cabins), except that the values are shortened one-letter values ideal for saving space. Current values are: `F`, `J`, `W`, and `Y`.

Examples:

```javascript
fp.cabinCodes.first // Returns 'F'
Object.values(fp.cabinCodes) // Returns [ 'F', 'J', 'W', 'Y' ]
```

### fp.profiles

- returns: <[Object]<[string], [Object]>> Map of profile names to throttling presets
  - `delayBetweenRequests` <[TimeRange]> Amount of time to wait between successive search requests. This is inclusive of the time the request took, so if this value was one minute, and the request took 15 seconds, the actual delay until the start of the next request would be 45 seconds.
  - `requestsPerHour` <[number]> An absolute limit, on the number of requests that can be made per hour
  - `restPeriod` <[TimeRange]> How often we enforce the rate limit given by `requestsPerHour`. For example, if we have a rest period of 30 minutes, and `requestsPerHour` is 100, we can only execute 50 requests every 30 minutes (`requestsPerHour * restPeriod / 1 hour`). Once we've made 50 requests, we must wait until that 30 minutes is up (called the resting period). This allows for more sophisticated human-like behavior, such as searching a short spurt, taking a break, and then continuing.

Useful presets of throttling settings specified in [`Config.throttling`](#config-throttling). While an engine can completely customize it's throttling behavior, these profiles provide reasonable defaults.

Examples:

```javascript
Object.keys(fp.profiles) // Returns [ 'slow', 'normal', 'fast' ]
flightplan.profiles.normal
// Returns:
// { delayBetweenRequests: [ '00:20', '00:30' ],
//   requestsPerHour: 60,
//   restPeriod: [ '15:00', '30:00' ] }
```

# class: Engine

An Engine is used to execute a flight award search. Each Engine instance is associated with a specific airline or frequent flyer program website (for example, "KrisFlyer" or "Miles & More"). The logic to search and parse awards from a particular website is provided by an instance of [Searcher] and [Parser].

> Developers wishing to add support for a new airline website to Flightplan, do so by creating their own subclass of [Searcher] and [Parser], and then registering them along with a [Config]. (See: [`./src/index.js`](https://github.com/flightplan-tool/flightplan/blob/master/src/index.js))

#### Methods
- [engine.initialize(*options*)](#engine-initialize-options)
- [engine.login(*retries*)](#engine-login-retries)
- [engine.search(*query*)](#engine-search-query)
- [engine.getCookies()](#engine-getcookies)
- [engine.close()](#engine-close)
- [engine.success(*obj1* [, *obj2*, ..., *objN*])](#engine-success-obj1-obj2-objn)
- [engine.info(*obj1* [, *obj2*, ..., *objN*])](#engine-info-obj1-obj2-objn)
- [engine.warn(*obj1* [, *obj2*, ..., *objN*])](#engine-warn-obj1-obj2-objn)
- [engine.error(*obj1* [, *obj2*, ..., *objN*])](#engine-error-obj1-obj2-objn)

#### Properties
- [engine.id](#engine-id)
- [engine.config](#engine-config)
- [engine.loginRequired](#engine-loginRequired)
- [engine.browser](#engine-browser)
- [engine.page](#engine-page)

### engine.initialize(*options*)

- `options` <[Object]> Optional
  - `credentials` <[Array<[string]>]> Required if [`engine.loginRequired`](#engine-loginrequired) is `true`. Usually consists of just a `username` and `password`, though some Engine's may require additional credentials.
  - `args` <[Array<[string]>]> Extra arguments to pass to Chromium when it is launched, defaults to `[]`
  - `headless` <[boolean]> Instructs Puppeteer to launch Chromium in headless mode, defaults to `false`
  - `docker` <[boolean]> Changes certain environment flags to allow Chromium to launch in a docker container, defaults to `false`
  - `width` <[number]> Width of the default viewport, defaults to a random integer in the range `[1200, 1280]`
  - `height` <[number]> Height of the default viewport, defaults to a random integer in the range `[1400, 1440]`
  - `proxy` <[Object]> Specifies a proxy for Headless Chrome to use
    - `server` <[string]> Takes same format as `--proxy-server` flag
    - `username` <[string]> Optional proxy username, if proxy requires authentication
    - `password` <[string]> optional proxy password, if proxy requires authentication
  - `throttle` <[boolean]> Turns throttling behavior on or off, defaults to `true`
  - `timeout` <[boolean]> Timeout in milliseconds when waiting for pages or elements to load, defaults to `90000`
  - `verbose` <[boolean]> Turns verbose logging on or off, defaults to `true`
  - `cookies` <[Array]<[Object]>> List of cookies to populate the Chromium instance, uses the same format as [engine.getCookies()](#engine-getcookies)
- returns: <[Promise]>

Initializes the Engine (this primarily involves launching the Chromium instance associated with this Engine). This method must be called, and the returned [Promise] must finish resolving, before the [`search()`](engine-search-query) method can be called.

### engine.login(*retries*)

- `retries` <[number]> Optional number of time to attempt to login before giving up, defaults to `3`
- returns: <[Promise]<[boolean]>>

Logs in to the airline website using the credentials provided to [`initialize()`](engine-initialize-options). It is not necessary to manually call this method, since it will be automatically called during searching if a user is ever detected to not be signed in. Return a [Promise] that resolves to `true` if login was successful.

### engine.search(*query*)

- `query` <[Query]|[Object]> If an [Object], it will be passed to [`new Query()`](new-query)
- returns: <[Promise]<[Results]>>

Executes the given query, and returns a [Promise] that resolves to the [Results] received from the airline website.

### engine.getCookies()

- returns: <[Promise]<[Array]<[Object]>>>

Returns the cookies for the instance of Chromium launched by the Engine. (See [Puppeteer Documentation](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagecookiesurls))

### engine.close()

- returns: <[Promise]>

Closes all resources associated with the Engine (including the instance of Chromium and all of its pages). The Engine object itself is considered to be disposed and cannot be used anymore.

### engine.success(*obj1* [, *obj2*, ..., *objN*])
### engine.info(*obj1* [, *obj2*, ..., *objN*])
### engine.warn(*obj1* [, *obj2*, ..., *objN*])
### engine.error(*obj1* [, *obj2*, ..., *objN*])

- `obj1` ... `objN` <[any]> A list of JavaScript values to output

Prints a message to `stdout` with newline, prefixed with the ID of this [Engine]. The exact method invoked will determine the output color:

- `success()`: `green`
- `info()`: `blue`
- `warn()`: `yellow`
- `error()`: `red`

> Color output can be completely disabled by setting the environment variable `FORCE_COLOR=0`.

### engine.id

- returns: <[string]>

The ID used to instantiate the Engine (passed to [`Flightplan.new()`](#flightplan-new-id)). It is usually the 2-letter IATA code of the airline primarily associated with the website.

### engine.config

- returns: <[Config]>

The [Config] instance associated with this Engine.

### engine.loginRequired

- returns: <[boolean]>

Returns `true` if this Engine requires login credentials in order to search.

### engine.browser

- returns: <[Browser]>

The [Browser] created by Puppeteer when connecting to a Chromium instance.

### engine.page

- returns: <[Page]>

The [Page] created by Puppeteer in which the search will be executed.

# class: Config

Contains configuration details for each supported [Engine]. Can be accessed by calling [Engine.config](engine-config). For example:

```javascript
const { config } = fp.new('AC')
config.name // Returns 'Aeroplan'
config.homeURL // Returns 'https://www.aeroplan.com/'
config.searchURL // Returns 'https://www.aeroplan.com/en/use-your-miles/travel.html'
```

#### Methods
- [new Config(*settings*)](#new-config-settings)
- [config.validDateRange()](#config-validdaterange)
- [config.toJSON()](#config-tojson)
- [config.toString()](#config-tostring)

#### Properties
- [config.name](#config-name)
- [config.homeURL](#config-homeURL)
- [config.searchURL](#config-searchURL)
- [config.waitUntil](#config-waituntil)
- [config.validation](#config-validation)
- [config.modifiable](#config-modifiable)
- [config.throttling](#config-throttling)
- [config.fares](#config-fares)

### new Config(*settings*)

- `settings` <[Object]>
  - `name` <[string]> The name of the frequenty flyer program
  - `homeURL` <[string]> The URL of the airline website's home page
  - `searchURL` <[string]> The URL of the airline website's search page
  - `waitUntil` <[string]> Optional setting used by Puppeteer to know when a page has finished loading, defaults to `'networkidle0'` (See [Puppeteer documentation](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagewaitfornavigationoptions))
  - `validation` <[Object]>
    - `minDays` <[number]> Optional minimum number of days from today that can be searched, defaults to `0`
    - `maxDays` <[number]> Optional maximum number of days from today that can be searched, defaults to `365`
  - `modifiable` <[Array]<[string]>> Optional list of search fields which can be modified, defaults to `[]`. See the lifecycle method [`Searcher.modify()`](#search-modify-page-diff-query-lastquery) for more details. Valid fields are:
    - `partners`
    - `cabin`
    - `quantity`
    - `fromCity`
    - `toCity`
    - `departDate`
    - `returnDate`
    - `oneWay`
    - `quantity`
  - `throttling` <[Object]> Optional throttling settings, defaults to [`Flightplan.profiles.normal`](#fp-profiles).
  - `fares` <[Array]<[BookingClass]|[Object]>> A list of booking classes supported by the [Engine].

Creates a new Config from the provided `*settings*`. The resulting Config is usually registered with Flightplan in [`./src/index.js`](https://github.com/flightplan-tool/flightplan/blob/master/src/index.js).

### config.validDateRange()

- returns: <[<string>, <string>]>

Returns the minimum and maximum allowable date range for searching.

### config.toString()

- returns: <[string]>

A string representation of the Config object.

### config.name

- returns: <[string]>

The name of the frequent flyer program.

Examples:

```javascript
fp.new('BA').name // Returns 'Executive Club'
```

### config.homeURL

- returns: <[string]>

The URL of the airline website's home page.

Examples:

```javascript
fp.new('BA').homeURL // Returns 'https://www.britishairways.com/en-us/home#/'
```

### config.searchURL

- returns: <[string]>

The URL of the airline website's search page.

Examples:

```javascript
fp.new('BA').searchURL // Returns 'https://www.britishairways.com/travel/redeem/execclub/'
```

### config.waitUntil

- returns: <[string]>

Used by Puppeteer to know when a page has finished loading. (See [Puppeteer documentation](https://github.com/GoogleChrome/puppeteer/blob/master/docs/))

### config.validation

- returns: <[Object]>
  - `minDays` <[number]> Minimum number of days from today that can be searched
  - `maxDays` <[number]> Maximum number of days from today that can be searched

Provides configuration settings used to validate a [Query].

### config.modifiable

- returns: <[Array]<[string]>>

The list of search fields which can be modified. Will be an empty list if the [Engine] does not support modifying a search. See the lifecycle method [`Searcher.modify()`](#search-modify-page-diff-query-lastquery) for more details.

### config.throttling

- returns: <[Object]>
  - `delayBetweenRequests` <[TimeRange]>
  - `requestsPerHour` <[number]>
  - `restPeriod` <[TimeRange]>

See [Flightplan.profiles](#fp-profiles) for further explanation of throttling settings.

### config.fares

- returns: <[Array]<[BookingClass]>>

The list of booking classes supported by this airline's website.

# class: BookingClass

Much like paid airline tickets, award fares can be thought of having an underlying booking class, which determines special rules and pricing of that award. One associated property of a booking class is it's nominal *cabin* (though this may differ from the actual service cabin on one or more segments). Other properties of the booking class may affect cost in miles (saver vs priority, fixed vs market, or seasonality).

The list of available booking classes for an [Engine] is available by calling [Config.fares](config-fares). For example:

```javascript
fp.new('CX').config.fares
// Returns:
// [ { code: 'FS', cabin: 'first', saver: true, name: 'First Standard' },
//   { code: 'F1', cabin: 'first', saver: false, name: 'First Choice' },
//   { code: 'F2', cabin: 'first', saver: false, name: 'First Tailored' },
//   ... } ]
```

#### Methods
- [new BookingClass(*settings*)](#new-bookingclass-settings)
- [fare.toJSON](#fare-tojson)
- [fare.toString](#fare-tostring)

#### Properties
- [fare.code](#fare-code)
- [fare.cabin](#fare-cabin)
- [fare.saver](#fare-saver)
- [fare.name](#fare-name)

### new BookingClass(*settings*)

- `code` <[string]> Short-hand code
- `cabin` <[string]> Value belonging to [`Flightplan.cabins`](#flightplan-cabins) indicating the nominal cabin of service
- `saver` <[string]> Optional, `false` if the booking class is not discounted, defaults to `true`
- `name` <[string]> Human-readable full name

Creates a new BookingClass with the provided settings.

### fare.toJSON()

- returns: <[Object]>

Creates a JSON representation of the BookingClass.

### fare.toString()

- returns: <[string]>

A string representation of the return value of [`fare.toJSON()`](#fare-tojson).

### fare.code

- returns: <[string]>

The booking class's unique string identifier.

### fare.cabin

- returns: <[string]>

The nominal cabin associated with the booking class. (See [Flightplan.cabins](#fp-cabins))

### fare.saver

- returns: <[boolean]>

Returns `false` if the award cost is considered higher than another booking class with the same service cabin.

> **Note:** Saver awards are not guaranteed to be cheaper than a non-saver award. For example, an Aeroplan market price award could be cheaper than the corresponding fixed price award (even though this is rare). The `saver` flag is set based on booking class, not actual price.

### fare.name

- returns: <[string]>

The full name used to refer to the booking class on the airline's website.

# class: Searcher

A Searcher is used by [Engine] to connect to an airline's website, enter search parameters, and return the results (in the form of HTML or JSON responses). It is given control over the [Engine's](#class-engine) Chromium instance, in order to execute the search and collect the responses.

Flightplan lets you add support for other frequent flyer programs, by extending Searcher and Parser, and then registering those types as a new [Engine] in [`./src/index.js`](https://github.com/flightplan-tool/flightplan/blob/master/src/index.js). For example:

```javascript
class MySearcher extends Searcher {
  async search (page, query, results) {
    results.saveHTML('main', `<h1>Searching ${query.cabin} class...</h1>')
  }
}
```

Each Searcher has several "lifecycle methods" that you can override to further customize the behavior of your Searcher. For example, if the Searcher must login before searching, you would override the [`isLoggedIn()`](#searcher-isloggedin-page) and [`login()`](#searcher-login-page-credentials) lifecycle methods. Or if your Searcher supports modifying an existing search (as opposed to running a new search from scratch for each query), your subclass should override [`modify()`](#modify-page-diff-query-lastquery).

The only method you must define in your Searcher subclass is called `search()`. All other lifecycle methods are optional.

> The Searcher class is used to allow developers to add support for a new airline website to Flightplan, otherwise it is not normally exposed to end-users of the API.

#### Class Properties
- [static Searcher.Error](#static-searcher-error)
- [static Searcher.errors](#static-searcher-errors)

#### Lifecycle Methods
- [searcher.isLoggedIn(*page*)](#searcher-isloggedin-page)
- [searcher.login(*page*, *credentials*)](#searcher-login-page-credentials)
- [searcher.validate(*query*)](#searcher-validate-query)
- [searcher.search(*page*, *query*, *results*)](#searcher-search-page-query-results)
- [searcher.modify(*page*, *diff*, *query*, *lastQuery*, *results*)](#searcher-modify-page-diff-query-lastquery-results)

#### Other Methods
- [searcher.checkResponse(*response*)](#searcher-checkresponse)
- [searcher.clear(*selector*)](#searcher-clear-selector)
- [searcher.clickAndWait(*selector*, [*waitUntil*])](#searcher-clickandwait-selector-waituntil)
- [searcher.clickIfVisible(*selector*, [*timeout*])](#searcher-clickifvisible-selector-timeout)
- [searcher.enterText(*selector*, *value*)](#searcher-entertext-selector-values)
- [searcher.fillForm(*values*)](#searcher-fillform-values)
- [searcher.goto(*url*)](#searcher-goto)
- [searcher.monitor(*selector*, [*timeout1*], [*timeout2*])](#searcher-monitor-selector-timeout1-timeout2)
- [searcher.retry(fn, [*attempts*], [*delay*])](#searcher-retry-fn-attempts-delay)
- [searcher.select(*selector*, *value*, [*wait*])](#searcher-select-selector-value-wait)
- [searcher.setValue(*selector*, *value*)](#searcher-setvalue-selector-value)
- [searcher.submitForm(*name*, *options*)](#searcher-submitform-name-options)
- [searcher.textContent(*selector*, [*defaultValue*])](#searcher-textcontent-selector-defaultvalue)
- [searcher.visible(*selector*)](#searcher-visible-selector)
- [searcher.waitBetween(*range*)](#searcher-waitbetween-range)
- [searcher.success(*obj1* [, *obj2*, ..., *objN*])](#searcher-success-obj1-obj2-objn)
- [searcher.info(*obj1* [, *obj2*, ..., *objN*])](#searcher-info-obj1-obj2-objn)
- [searcher.warn(*obj1* [, *obj2*, ..., *objN*])](#searcher-warn-obj1-obj2-objn)
- [searcher.error(*obj1* [, *obj2*, ..., *objN*])](#searcher-error-obj1-obj2-objn)

#### Properties
- [searcher.id](#searcher-id)
- [searcher.config](#searcher-config)
- [searcher.browser](#searcher-browser)
- [searcher.page](#searcher-page)

### static Searcher.Error

- extends: <[Error]>

Returns the `SearcherError` custom error class, which is emitted whenever a search fails due to circumstances beyond the control of the Searcher. For example, the airline website may be down or unresponsive.

### static Searcher.errors

- returns: <[Object]>

A helper method that returns custom errors which extend `SearcherError`. These are useful across Searcher's, to signal common failure scenarios. Possible custom errors include:

- `BlockedAccess` - Access to the web page blocked by website
- `BlockedAccount` - Account has been blocked by website
- `BotDetected` - Suspicious activity detected by website
- `LoginFailed` - Failed to login to website
- `MissingCredentials` - Missing login credentials
- `InvalidCredentials` - Invalid login credentials
- `InvalidRoute` - Airline and its partners do not fly this route
- `InvalidCabin` - Selected cabin is not available for this route

### searcher.isLoggedIn(*page*)

- `page` <[Page]> Browser page created by Puppeteer
- returns: <[Promise]<[boolean]>> Resolves to `true` if the user is already logged in

Checks whether a user is logged in to the airline website. Most airline websites will require a user to be logged in before searching.

### searcher.login(*page*, *credentials*)

- `page` <[Page]> Browser page created by Puppeteer
- `credentials` <[Array]<[string]>> List of credentials used to login
- returns: <[Promise]>

Logs in to the airline website, using the provided credentials. What exact credentials are required depends on the website, but usually it is of the form `[*username*, *password*]`.

### searcher.validate(*query*)

- `query` <[Query]> Search query

Checks that the provided `query` is valid, before executing it. If not valid, throws `Searcher.Error` with the reason.

### searcher.search(*page*, *query*, *results*)

- `page` <[Page]> Browser page created by Puppeteer
- `query` <[Query]> Search query
- `results` <[Results]> Results to store assets from the search response
- returns: <[Promise]>

Executes the award search defined by `query`, storing the search response on `results`. If unable to execute the search successfully, throws `Searcher.Error` with the reason.

### searcher.modify(*page*, *diff*, *query*, *lastQuery*, *results*)

- `page` <[Page]> Browser page created by Puppeteer
- `diff` <[Object]> The difference between `query` and `lastQuery`
- `query` <[Query]> The new query we wish to run
- `lastQuery` <[Query]> The query from the previously run search
- `results` <[Results]> Results to store assets from the search response
- returns: <[Promise]<[boolean]>> `true` if the existing search was successfully modified

Modifies an existing search that has just been run. `diff` contains only those query properties which have changed (see [`query.diff(*other*)`](#query-diff-other)). If the existing search was successfully modified, and the search response saved, returns `true`. Otherwise, returning `false` will cause the [Engine] to fall back to running `query` as a complete search from scratch.

This method will only be called if the [Engine] is called to run a successive query, such that the keys of `query.diff(lastQuery)` fall completely within the set of [`config.modifiable`](#config-modifiable) defined for the [Engine].

> It is not required for a Searcher subclass to define `modify()`, however it may make sense when modifying an existing search is much faster than running a new search from scratch every time.

### searcher.checkResponse(*response*)

- `response` <[Response]> A Puppeteer response

Checks the status of the provided `response`, and throws `Searcher.Error` if not `200 (OK)` or `304 (redirect)`. If an error is thrown, the throttle counter is also advanced, so that a cool-down period will be triggered immediately (this has the effect of slowing down the search rate when non-OK responses are detected).

### searcher.clear(*selector*)

- `selector` <[string]> A [selector] to query page for
- returns: <[Promise]>

Clears the value of the element matching the selector.

### searcher.clickAndWait(*selector*, [*waitUntil*])

- `selector` <[string]> A [selector] to query page for
- `waitUntil` <[string]> When to consider navigation succeeded, defaults to the [`config.waitUntil`](#config-waituntil) of the [Engine]
- returns: <[Promise]>

Clicks and element and waits for any triggered navigation to succeed.

> If no navigation is triggered by the click, this method will hang until the navigation timeout is reached, and a timeout exception will be thrown.

### searcher.clickIfVisible(*selector*, [*timeout*])

- `selector` <[string]> A [selector] to query page for
- `timeout` <[number]> Timeout in milliseconds to wait for the element to appear
- returns: <[Promise]>

Clicks the element matching the `selector`, but only if it is visible (waiting up to `timeout` milliseconds for it to appear).

### searcher.enterText(*selector*, *value*)

- `selector` <[string]> A [selector] to query page for
- `value` <[string]> Value to enter into the text field
- returns: <[Promise]>

Checks the value of the element matching the `selector`, and if it does not match the desired `value`, will clear any existing value before clicking the element and typing in the new value.

### searcher.fillForm(*values*)

- `values` <[Object]<[string], [string]>> Object whose keys are the names of form elements, and the values are the string values which the element's `value` will be set to
- returns: <[Promise]>

Fills out an HTML form with the named values.

### searcher.goto(*url*)

- `url` <[string]> URL to navigate to
- returns: <[Promise]>

Navigates to the provided URL, and then calls [`checkResponse()`](#searcher-checkresponse) on the response.

### searcher.monitor(*selector*, [*timeout1*], [*timeout2*])

- `selector` <[string]> A [selector] to query page for
- `timeout1` <[number]> Timeout in milliseconds to wait for the element to appear
- `timeout2` <[number]> Timeout in milliseconds to wait for the element to disappear
- returns: <[Promise]>

Waits for an element, such as a spinner, to appear, and then waits until it disappears.

### searcher.retry(fn, [*attempts*], [*delay*])

- `fn` <[function]:<[Promise]<[boolean]>>> Callback function
- `attempts` <[number]> Total number of attempts before giving up
- `delay` <[number]> Delay in milliseconds between successive calls
- returns: <[Promise]>

Attempts to call the provided function `fn`, until it resolves to `true`, with a given `delay` in between successive calls. If all attempts fail, throws a `Searcher.Error`.

### searcher.select(*selector*, *value*, [*wait*])

- `selector` <[string]> A [selector] to query page for
- returns: <[Promise]<[boolean]>>

Sets the `value` of the drop-down `select` element matching the selector.

### searcher.setValue(*selector*, *value*)

- `selector` <[string]> A [selector] to query page for
- returns: <[Promise]>

Sets the `value` of the element matching the selector.

### searcher.submitForm(*name*, *options*)

- `name` <[string]> Name of the form to submit
- `options` <[Object]>
  - `capture` <[string]>|<[Array]<[string]>> A partial URL (or list of partial URL's) to capture the responses of
  - `waitUntil` <[string]> When to consider navigation succeeded, defaults to the [`config.waitUntil`](#config-waituntil) of the [Engine]
  - `timeout` <[number]> Timeout in milliseconds, defaults to the default navigation timeout of the [Engine]
- returns: <[Promise]<[Response]>|<[Array]<[Response]>>>

Calls the `submit()` method of the named form. If `capture` is provided, the method will wait until the responses for each partial URL in `capture` is found. Otherwise, the method waits until navigation has succeeded, as indicated by `waitUntil`. If the method takes longer than `timeout` milliseconds, a `Searcher.Error` is thrown. The return value is the same form as `capture`, an [Array] of responses or a single response value.

### searcher.textContent(*selector*, [*defaultValue*])

- `selector` <[string]> A [selector] to query page for
- `defaultValue` <[string]> Value to return if no matching element was found
- returns: <[Promise]<[boolean]>>

Fetches an element's `textContent`, returning `defualtValue` if the selector had no match.

### searcher.visible(*selector*)

- `selector` <[string]> A [selector] to query page for
- returns: <[Promise]<[boolean]>> Resolves to `true` if the element is visible

Tests element visibility by checking the `display`, `visibility`, and `opacity` CSS properties.

### searcher.waitBetween(*min*, *max*)

- `min` <[number]> Lower bound of time to wait for, in milliseconds
- `max` <[number]> Optional upper bound of time to wait for, in milliseconds
- returns: <[Promise]>

Waits for a variable amount of time (unlike `page.waitFor()` which waits for an exact amount of time). If `max` is not given, the wait time will be exactly `min`.

### parser.success(*obj1* [, *obj2*, ..., *objN*])
### parser.info(*obj1* [, *obj2*, ..., *objN*])
### parser.warn(*obj1* [, *obj2*, ..., *objN*])
### parser.error(*obj1* [, *obj2*, ..., *objN*])

- `obj1` ... `objN` <[any]> A list of JavaScript values to output

Prints a message to `stdout` with newline, prefixed with the ID of the [Engine] this Parser instance is associated wtih. The exact method invoked will determine the output color:

- `success()`: `green`
- `info()`: `blue`
- `warn()`: `yellow`
- `error()`: `red`

> Color output can be completely disabled by setting the environment variable `FORCE_COLOR=0`.

### searcher.id

- returns: <[string]>

The ID of the [Engine] this Searcher belongs to.

### searcher.config

- returns: <[Config]>

The [Config] instance associated with the [Engine] this Searcher belongs to.

### searcher.browser

- returns: <[Browser]>

The [Browser] created by Puppeteer by the [Engine] this Searcher belongs to.

### searcher.page

- returns: <[Page]>

The [Page] created by Puppeteer by the [Engine] this Searcher belongs to.

# class: Parser

A Parser is used by [Results] to parse [Flight] and [Award] instances from a search response. A simple example would look like:

```javascript
class MyParser extends Parser {
  parse (results) {
    const $ = results.$('main')
    // Inspect the DOM to find awards and flights
    const flight = new Flight(...)
    const awards = [ new Award({...}, flight) ]
    return { awards }

    // Alternatively, return a list of flights
    const flights = [ new Flight(segments, [ new Award({...})])]
    return { flights }
  }
}
```

Parser has only a single lifecycle method, `parse()`, and every Parser subclass must define this method.

> The Parser class is used to allow developers to add support for a new airline website to Flightplan, otherwise it is not normally exposed to end-users of the API.

#### Lifecycle Methods
- [parser.parse(results)](#parser-parse-results)

#### Other Methods
- [parser.findFare(*cabin*, *saver*)](#parser-findfare-cabin-saver)
- [parser.isPartner(*segments*, *other*)](#parser-ispartner-segments-other)
- [parser.success(*obj1* [, *obj2*, ..., *objN*])](#parser-success-obj1-obj2-objn)
- [parser.info(*obj1* [, *obj2*, ..., *objN*])](#parser-info-obj1-obj2-objn)
- [parser.warn(*obj1* [, *obj2*, ..., *objN*])](#parser-warn-obj1-obj2-objn)
- [parser.error(*obj1* [, *obj2*, ..., *objN*])](#parser-error-obj1-obj2-objn)

#### Properties
- [parser.id](#parser-id)
- [parser.config](#parser-config)
- [parser.results](#parser-results)
- [parser.query](#parser-query)

### parser.parse(*results*)

- `results` <[Results]> Encapsulates the search response being parsed
- returns <[Array]<[Award]|[Flight]>> List of parsed [Award] or [Flight] objects (they can be mixed together in the same [Array])

This is the primary lifecycle method of the Parser, which does all the heavy lifting. It takes a [Results] instance, which has one or more assets (or an error, see [`Results.error`](#results-error), parses available award and flight data, and returns the result as an [Array] of [Flight] or [Award] instances.

### parser.findFare(*cabin*, *saver*)

- `cabin` <[string]> Cabin to search for
- `saver` <[boolean]> Optional flag to search for saver awards, defaults to `true`
- returns: <[BookingClass]> If no matching fare was found, then `undefined`

Searches the list of fares supported by this Parser's [Engine] instance (defined by [`config.fares`](#config-fares)).

### parser.isPartner(*segments*, *other*)

- `segments` <[Array]<[Segment]>> List of [Segment] instances
- `other` <[Array]<[string]>> Optional set of additional non-partner airlines
- returns: <[boolean]> `false` if none of the segments are operated by a partner airline

Checks whether every segment is operated by a partner airline or not. By default, the only non-partner airline is `parser.query.engine`, though `other` can specify additional non-partner airlines as a list of two-letter IATA airline codes.

### parser.success(*obj1* [, *obj2*, ..., *objN*])
### parser.info(*obj1* [, *obj2*, ..., *objN*])
### parser.warn(*obj1* [, *obj2*, ..., *objN*])
### parser.error(*obj1* [, *obj2*, ..., *objN*])

- `obj1` ... `objN` <[any]> A list of JavaScript values to output

Prints a message to `stdout` with newline, prefixed with the ID of the [Engine] this Parser instance is associated wtih. The exact method invoked will determine the output color:

- `success()`: `green`
- `info()`: `blue`
- `warn()`: `yellow`
- `error()`: `red`

> Color output can be completely disabled by setting the environment variable `FORCE_COLOR=0`.

### engine.id

- returns: <[string]>

The ID of the [Engine] that is associated with the [Results] instance being parsed.

### engine.config

- returns: <[Config]>

The [Config] instance associated with the [Engine] of the [Results] instance being parsed.

### engine.results

- returns: <[Results]>

A convenience property to access the same [Results] instance being parsed.

### engine.query

- returns: <[Query]>

The [Query] from the [Results] instance being parsed.

# class: Query

The Query object is used to define search parameters that are passed to the [`Engine.search()`](engine-search-query) method.

#### Methods
- [new Query(*params*)](#new-query-params)
- [query.departDateMoment()](#query-departdatemoment)
- [query.returnDateMoment()](#query-returndatemoment)
- [query.closestDeparture(*date*)](#query-closest-departure)
- [query.closestReturn(*date*)](#query-closest-return)
- [query.diff(*other*)](#query-diff-other)
- [query.toJSON()](#query-tojson)
- [query.toString()](#query-tostring)

#### Properties
- [query.partners](#segment-airline)
- [query.fromCity](#segment-flight)
- [query.toCity](#segment-aircraft)
- [query.departDate](#segment-fromCity)
- [query.returnDate](#segment-toCity)
- [query.oneWay](#segment-toCity)
- [query.cabin](#segment-airline)
- [query.quantity](#segment-airline)
- [query.json](#segment-date)
- [query.html](#segment-departure)
- [query.screenshot](#segment-arrival)

### new Query(*params*)

- `params` <[Object]>
  - `partners` <[boolean]> Optional flag whether to search for partner awards, defaults to `false`
  - `cabin` <[string]> Search for awards with this cabin of service, must be a value belonging to [`Flightplan.cabins`](#flightplan-cabins)
  - `quantity` <[number]> Optional number of passengers to search for, defaults to `1`
  - `fromCity` <[string]> 3-letter ICAO code of the departure city to search for
  - `toCity` <[string]> 3-letter ICAO code of the destination city to search for
  - `departDate` <[string]|[Moment]> Departure date to search, as an ISO 8601 [string] or [Moment] object
  - `returnDate` <[string]|[Moment]> Optional return date to search, as an ISO 8601 [string] or [Moment] object, or `null` if searching one-way awards. Defaults to `null`.
  - `json`, `html` <[Object]> Optional settings for JSON and HTML assets
    - `path` <[string]> The path (including extension) to save assets
    - `gzip` <[boolean]> Whether assets should be gzip compressed
  - `screenshot` <[Object]> Optional settings for screenshots
    - `enabled` <[boolean]> Optional flag to enable screenshots, defaults to `true` if `screenshot.path` is defined
    - `path` <[string]> The path (including extension) to save screenshots

Creates a new query with the parameters provided. These values are used to populate the airline website's search form, but it is not gauranteed that the awards returned will be limited to these parameters. For example, searching `"economy"` on AC will also return `"premium"` cabin awards. Some websites will also include partner awards even when `partners` is `false`, or include non-partner awards when `partners` is `true`. This behavior is specific to each airline website.

### query.departDateMoment()

- returns: <[Moment]>

Departure date (no time set) of the query, with the time zone set to UTC.

### query.returnDateMoment()

- returns: <[Moment]>

Return date (no time set) of the query, with the time zone set to UTC, if searching for round-trip awards. If only searching one-way awards, returns `null`.

### query.closestDeparture(*date*)

- `date` <[string]|[Moment]> A date to inspect, as an ISO 8601 [string] or [Moment] object
- returns: <[Moment]>

Often an airline website will provide an ambiguous date, in the form of "MM/DD". This method takes a date, and returns a copy as a [Moment] with the year set such that it is closest to [`query.departDate`](#query-departdate).

Examples:

```javascript
query.departDate // Returns: '2018-01-01'
const newDate = moment('12-28', 'MM-dd')
query.closestDeparture(newDate).format('YYYY-MM-DD') // Returns: '2017-12-28'
```

### query.closestReturn(*date*)

- `date` <[string]|[Moment]> A date to inspect, as an ISO 8601 [string] or [Moment] object
- returns: <[Moment]>

Often an airline website will provide an ambiguous date, in the form of "MM/DD". This method takes a date, and returns a copy as a [Moment] with the year set such that it is closest to [`query.returnDate`](#query-returndate).

Examples:

```javascript
query.returnDate // Returns: '2019-12-28'
const newDate = moment('01-02', 'MM-dd')
query.closestReturn(newDate).format('YYYY-MM-DD') // Returns: '2020-01-02'
```

### query.diff(*other*)

- `other` <[Query]> A Query instance to compare against
- returns: <[Object]> `null` if the queries are considered the same, otherwise the filtered set of properties which have different values than `other`

Compares a Query's properties (excluding assets) against those of another Query instance, returning an [Object] representing the difference. Useful for [Engine] instances that support modifying an existing search.

### query.toJSON()

- returns: <[Object]>

Creates a JSON representation of the Query.

> The Query's JSON output does not include asset options (`html`, `json`, or `screenshot` keys) since this information can be inferred from Results.

### query.toString()

- returns: <[string]>

A string representation of the return value of [`query.toJSON()`](#query-tojson).

### query.partners

- returns: <[boolean]>

Search should include partner awards.

### query.fromCity

- returns: <[string]>

3-letter ICAO code of the departure city to search for.

### query.toCity

- returns: <[string]>

3-letter ICAO code of the destination city to search for.

### query.departDate

- returns: <[string]>

Departure date to search for in ISO 8601 format.

### query.returnDate

- returns: <[string]>

Return date to search for in ISO 8601 format, or `null` if only searching one-way awards.

### query.oneWay

- returns: <[string]>

Indicates whether the search is for one-way or round-trip awards. If one-way, [`query.returnDate`](#query-returndate) will be `null`.

### query.cabin

- returns: <[string]> A value belonging to [`Flightplan.cabins`](#flightplan-cabins)

Search for awards with this cabin of service.

### query.quantity

- returns: <[string]>

Number of passengers to search for.

### query.json

- returns: <[Object]>
  - `path` <[string]> Optional path, defaults to `null`
  - `gzip` <[boolean]> Optional flag to compress assets on disk, defaults to `false`

Specifies a path to save JSON assets to, and an optional compression flag. [`results.assets`](#results-assets) will contain the list of all JSON assets saved, with their final paths.

### query.html

- returns: <[Object]>
  - `path` <[string]> Optional path, defaults to `null`
  - `gzip` <[boolean]> Optional flag to compress assets on disk, defaults to `false`

Specifies a path to save HTML assets to, and an optional compression flag. [`results.assets`](#results-assets) will contain the list of all HTML assets saved, with their final paths.

### query.screenshot

- returns: <[Object]>
  - `enabled` <[boolean]> Optional flag controlling whether to take screenshots
  - `path` <[string]> Optional path, defaults to `null`

Specifies a path to save screenshots to, and an optional compression flag. [`results.assets`](#results-assets) will contain the list of all screenshots saved, with their final paths.

# class: Results

Results is used to contain the results of a search. It is created by [Engine], populated by [Searcher], and then returned to the caller of [`Engine.search()`](#engine-search-query). Internally, Results uses a [Parser] instance to expose available awards and flights from the search results. In addition, Results can provide access to raw data returned by the search, such as HTML, JSON, or screenshots.

#### Class Methods
- [static Results.parse(*json*)](#static-results-parse-json)

#### Methods
- [results.saveHTML(*name*, *contents*)](#results-savehtml-name-contents)
- [results.saveJSON(*name*, *contents*)](#results-savejson-name-contents)
- [results.screenshot(*name*)](#results-screenshot-name)
- [results.$(*name*)](#results-$-name)
- [results.contents(*type*, *name*)](#results-contents-type-name)
- [results.trimContents()](#results-trimcontents)
- [results.toJSON()](#results-tojson)
- [results.toString()](#results-tostring)

#### Properties
- [results.ok](#results-ok)
- [results.error](#results-error)
- [results.engine](#results-engine)
- [results.query](#results-query)
- [results.assets](#results-query)
- [results.awards](#results-awards)
- [results.flights](#results-flights)

### static Results.parse(*json*)

- `json` <[Object]>
  - `engine` <[string]> ID of the [Engine] to associate with this Results instance
  - `query` <[Object]> Required JSON representation of a [Query] instance (see [`new Query()`](#new-query-params))
  - `html`, `json`, `screenshot` <[Array]<[Object]>> Optional lists of assets
    - `name` <[string]> Name of the asset
    - `contents` <[Object]> Optional contents of the asset
    - `path` <[string]> Optional path of the asset, if stored on disk
- returns: <[Results]>

Takes the output from the [`Results.toJSON()`](#results-tojson) call, and reconstructs the Results. Useful for persisting the search response to disk, or re-parsing awards after the parser logic has been updated. For example:

```javascript
const results = await engine.search(query)
const json = results.toJSON()
// save json somewhere, then later retrieve it...
const results = Results.parse(json)
```

### results.saveHTML([*name*, [*contents*]])

- `name` <[string]> Optional name to save the asset under, defaults to `"default"`
- `contents` <[string]> Optional content to save, defaults to the full HTML contents of the page, including the doctype
- returns: <[Promise]> Resolves when asset is successfully saved

Stores the HTML contents provided by `contents` as an asset on the Results objects. If `results.query.html.path` is set, the asset will be saved to disk as well (if more than one HTML asset is saved, subsequent filenames will be appended with `-1`, `-2`, ...). See [`Query.html`](query-html) for more options on how assets are saved.

### results.saveJSON([*name*, [*contents*]])

- `name` <[string]> Optional name to save the asset under, defaults to `"default"`
- `contents` <[Object]> JSON object to save
- returns: <[Promise]> Resolves when asset is successfully saved

Stores the JSON contents provided by `contents` as an asset on the Results objects. If `results.query.json.path` is set, the asset will be saved to disk as well (if more than one JSON asset is saved, subsequent filenames will be appended with `-1`, `-2`, ...). See [`Query.json`](#query-json) for more options on how assets are saved.

### results.screenshot([*name*])

- `name` <[string]> Optional name to save the asset under, defaults to `"default"`
- returns: <[Promise]> Resolves when asset is successfully saved

Takes a snapshot of the browser's web page, and stores the raw image data as an asset on the Results objects. If `results.query.screenshot.path` is set, the asset will be saved to disk as well (if more than one screenshot asset is saved, subsequent filenames will be appended with `-1`, `-2`, ...). See [`Query.screenshot`](#query-screenshot) for more options on how assets are saved.

> If [`query.screenshot`](#query-screenshot) is set and the call to [`Engine.search()`](#engine-search-query) returns without taking at least one screenshot, a screenshot will automatically be taken, to aid the end-user in diagnosing the outcome of the search. This is true even if the search failed due to an error.

### results.$(*name*)

- `name` <[string]> Name of the HTML asset to retrieve

Returns the contents of the named HTML asset, loaded by [cheerio](https://cheerio.js.org), a jQuery-like DOM parser and manipulator.

### results.contents(*type*, *name*)

- `type` <[string]> Asset type, one of: `html`, `json`, or `screenshots`
- `name` <[string]> Name of the asset to retrieve
- returns: <[string]|[Buffer]|[Object]> HTML contents are returned as a [string], JSON contents as an [Object], and screenshot contents as a [Buffer]

Returns the contents of the named asset with the given type.

### results.trimContents()

- returns: <[Results]> Will return itself

Modifies the Results object in-place, by deleting the `contents` key from every asset. This is useful when serializing the Results object, since if the assets were saved to disk, they can be loaded later from the provided `path`.

### results.toJSON()

- returns: <[Object]>

Creates a JSON representation of the Results, with everything needed to reconstruct the Results using the [`Results.parse()`](static-results-parse-json) method.

> The JSON object will not contain any parsed [Award] or [Flight] instances, however those objects can always be reconstructed on-demand from the search response (which is saved). If you wish to serialize the [Award] or [Flight] instances, you should access the [`results.awards`](#results-awards) and [`results.flights`](#results-flights) properties, and utilize the [Award.toJSON()](#award-tojson) and [Flight.toJSON()](#flight-tojson) methods instead.

Examples:

```javascript
const results = await engine.search(query)
results.toJSON()
// Returns: {
//   engine: 'CX',
//   query: { ... },
//   html: [ {
//     name: 'default',
//     contents: '<html>...</html>' } ],
//   json: [ {
//     name: 'pricing',
//     contents: { ... },
//     path: 'data/CX-LAX-HKG-2019-10-01.json.gz' },
//     name: 'flightInfo',
//     contents: { ... },
//     path: 'data/CX-LAX-HKG-2019-10-01-2.json.gz' } ],
//   screenshot: [ {
//     name: 'default',
//     contents: '/9j/4AAQ...Xm//2Q==' } ] }
```

### results.toString()

- returns: <[string]>

A string representation of the return value of [`results.toJSON()`](#results-tojson).

### results.ok

- returns: <[boolean]>

Returns `true` if no error occurred while executing the search. In other words, `ok` will be `true` if [`Results.error`](#results-error) is `null`.

### results.error

- returns: <[string]> `null` if no error occurred during searching

If the [Searcher] or [Parser] encounter an error, due to a fault beyond its own control (for example, an error returned by the airline website), it will set the `error` on the Results, rather than throwing an exception. For more details, see [Error handling](#error-handling).

### results.engine

- returns: <[string]>

Returns the ID of the [Engine] which created this Results instance.

### results.query

- returns: <[Query]>

Returns the query used by [`engine.search()`](#engine-search-query), used to generate the search response contained by this Results instance.

### results.assets

- returns: <[Object]>
  - `html`, `json`, `screenshot` <[Array]<[Object]>> Asset type
    - `name` <[string]> A unique identifier for the asset
    - `path` <[string]> If asset paths were provided on the associated [Query], the final path of the asset will be stored here, otherwise `null`
    - `contents` <[string]|[Buffer]|[Object]> [string] for HTML assets, [Object] for JSON assets, [Buffer] for screenshot assets, or `undefined` if [Results.trimContents()](#results-trimcontents) was called

Returns the list of assets stored by the Results.

Examples:

```javascript
const results = await engine.search(query)
results.assets.json
// Returns: [
//   { name: 'routes', path: 'data/CX-LAX-HKG-2019-10-01.json.gz' },
//   { name: 'pricing', path: 'data/CX-LAX-HKG-2019-10-01-2.json.gz' }
// ]
```

### results.awards

- returns: <[Array]<[Award]>>

Returns a list of [Award] objects that can be parsed from the search response.

> Awards are parsed on-demand and cached internally within the Results instance, so the first time this property is accessed it may be noticeably slower.

### results.flights

- returns: <[Array]<[Flight]>>

Returns the list of flights that can be parsed from the search results.

> Flights are parsed on-demand and cached internally within the Results instance, so the first time this property is accessed it may be noticeably slower.

# class: Flight

A unique itinerary constructed from one or more [Segment's](#class-segment). While the Flight itself is independent of an award fare or cabin designation, it may be associated with multiple [Award's](#class-award) via the [`awards`](#flight-awards) property. A typical example looks like:

```javascript
flight.toJSON()
// Returns:
// { awards: [ ... ],
//   segments: [
//   { airline: 'CX',
//     flight: 'CX636',
//     ... },
//   { airline: 'CX',
//     flight: 'CX826',
//     ... } ]
//   fromCity: 'SIN',
//   toCity: 'YYZ',
//   date: '2018-11-08',
//   departure: '20:15',
//   arrival: '20:20',
//   duration: 2225,
//   minLayover: 1090,
//   maxLayover: 1090,
//   stops: 1,
//   lagDays: 1,
//   overnight: true }
```

#### Methods
- [new Flight(*segments*, [*awards*])](#new-flight-segments-awards)
- [flight.key()](#flight-key)
- [flight.departureMoment()](#flight-departuremoment)
- [flight.arrivalMoment()](#flight-arrivalmoment)
- [flight.airlineMatches(*airline*)](#flight-airlinematches-airline)
- [flight.highestCabin()](#flight-highestcabin)
- [flight.toJSON(*includeAwards*)](#flight-tojson-includeawards)
- [flight.toString()](#flight-tostring)

#### Properties
- [flight.awards](#flight-awards)
- [flight.segments](#flight-segments)
- [flight.fromCity](#flight-fromcity)
- [flight.toCity](#flight-tocity)
- [flight.date](#flight-date)
- [flight.departure](#flight-departure)
- [flight.arrival](#flight-arrival)
- [flight.duration](#flight-duration)
- [flight.minLayover](#flight-minlayover)
- [flight.maxLayover](#flight-maxlayover)
- [flight.stops](#flight-stops)
- [flight.lagDays](#flight-lagdays)
- [flight.overnight](#flight-overnight)

### new Flight(*segments*, [*awards*])

- `segments` <[Array]<[Segment]>>
- `awards` <[Array]<[Award]>> Optional list of [Award's](#class-award) to associate with this flight, defaults to `[]`

Creates a new Flight from an array of segments. An optional list of awards may also be provided.

### flight.key()

- returns: <[string]>

A unique identifier for the itinerary, created by combining flight numbers, departure cities, and departure dates of each segment (with successive dates encoded as the difference in days from the first date).

Examples:

```javascript
flight.key() // Returns '2018-10-01:SIN:CX636:1:HKG:CX826'
```

> Note that flight numbers alone are not sufficient to uniquely identify an itinerary. It is possible for two itineraries to have the same series of flight numbers, but on different dates (even if the first segment is on the same date). In fact, this is quite common with stopovers, where a traveler may choose to stay for longer than 24 hours in a connecting city. The same flight number can also be used for two distinct flights on the same date (so called "direct flights" with a stop in the middle, which continue under the same flight number the entire route).

### flight.departureMoment()

- returns: <[Moment]>

Departure date and time (with time zone of the departure airport) of the first segment.

### flight.arrivalMoment()

- returns: <[Moment]>

Arrival date and time (with time zone of the destination airport) of the last segment.

### flight.airlineMatches(*airline*)

- returns: <[boolean]>

Checks whether the airline of each segment on the Flight matches `airline`, and if so returns `true`.

### flight.highestCabin()

- returns: <[string]> A value belonging to [`Flightplan.cabins`](#flightplan-cabins))

The highest service of cabin across all segments of the Flight. If any segment does not have a cabin defined, returns `null`.

### flight.toJSON(*includeAwards*)

- `includeAwards` Optional flag to render the [`awards`](#flight-awards) property in the JSON output, defaults to `true`
- returns: <[Object]>

Creates a JSON representation of the Flight.

### flight.toString()

- returns: <[string]>

A string representation of the return value of [`flight.toJSON()`](flight-tojson).

### flight.awards

- returns: <[Array]<[Award]>>

The list of [Award's](class-award) associated with this Flight.

### flight.segments

- returns: <[Array]<[Segment]>>

The list of [Segment's](class-segment) in the itinerary.

### flight.fromCity

- returns: <[string]>

The 3-letter IATA departure airport of the first segment.

### flight.toCity

- returns: <[string]>

The 3-letter IATA destination airport of the last segment.

### flight.date

- returns: <[string]>

The departure date of the first segment in ISO 8601 format.

### flight.departure

- returns: <[string]>

The departure time of the first segment in ISO 8601 format.

### flight.arrival

- returns: <[string]>

The arrival time of the last segment in ISO 8601 format.

### flight.duration

- returns: <[number]>

The duration of the flight in minutes (including layovers).

### flight.minLayover

- returns: <[number]>

The duration of the shortest layover (or `null` if there are no layovers).

### flight.maxLayover

- returns: <[number]>

The duration of the longest layover (or `null` if there are no layovers).

### flight.stops

- returns: <[number]>

The total number of stops in the itinerary.

### flight.lagDays

- returns: <[number]>

The difference in days between the departure date of the first segment and the arrival date of the last segment.

### flight.overnight

- returns: <[boolean]>

True if the itinerary contains any overnight segments.

# class: Segment

A single component of an itinerary, with the same flight number, aircraft, and cabin of service.

> A segment may have one or more stops. For example, a "direct" flight may have a stop in the middle, but uses the same flight number for the entire route.

A typical example looks like:

```javascript
segment.toJSON()
// Returns:
// { airline: 'NZ',
//   flight: 'NZ5',
//   aircraft: 'B777',
//   fromCity: 'LAX',
//   toCity: 'AKL',
//   date: '2018-11-08',
//   departure: '21:40',
//   arrival: '07:30',
//   duration: 770,
//   nextConnection: null,
//   cabin: null,
//   stops: 0,
//   lagDays: 2,
//   overnight: true }
```

#### Methods
- [new Segment(*attributes*)](#segment-new-airline)
- [segment.key()](#segment-key)
- [segment.departureMoment()](#segment-departuremoment)
- [segment.arrivalMoment()](#segment-arrivalmoment)
- [segment.toJSON()](#segment-tojson)
- [segment.toString()](#segment-tostring)

#### Properties
- [segment.airline](#segment-airline)
- [segment.flight](#segment-flight)
- [segment.aircraft](#segment-aircraft)
- [segment.fromCity](#segment-fromCity)
- [segment.toCity](#segment-toCity)
- [segment.date](#segment-date)
- [segment.departure](#segment-departure)
- [segment.arrival](#segment-arrival)
- [segment.duration](#segment-duration)
- [segment.nextConnection](#segment-nextConnection)
- [segment.cabin](#segment-cabin)
- [segment.stops](#segment-stops)
- [segment.lagDays](#segment-lagDays)
- [segment.overnight](#segment-overnight)

### new Segment(*attributes*)

- `attributes` <[Object]>
  - `airline` <[string]> Optional 2-letter IATA code of the airline operating the flight, defaults to the first 2-letters of `flight`
  - `flight` <[string]> Official flight number, formed by a 2-letter airline designator followed by a number, such as `"CX888"`
  - `aircraft` <[string]> Optional 4-letter ICAO code of the aircraft (although may be an IATA code or regular description if the ICAO code cannot be found), defaults to `null`
  - `fromCity` <[string]> The 3-letter IATA departure airport
  - `toCity` <[string]> The 3-letter IATA destination airport
  - `date` <[string]|[Moment]> Departure date as an ISO 8601 [string] (`'YYYY-MM-DD'`) or [Moment] object
  - `departure` <[string]|[Moment]> Departure time as an ISO 8601 [string] (`'HH:mm'`) or [Moment] object
  - `arrival` <[string]|[Moment]> Arrival time as an ISO 8601 [string] (`'HH:mm'`) or [Moment] object
  - `cabin` <[string]> Optional value belonging to [`Flightplan.cabins`](#flightplan-cabins) used to populate the `cabins` property of the parent [Award]. Defaults to `null`.
  - `stops` <[number]> Optional number of stops, defaults to `0`
  - `lagDays` <[number]> Optional difference in days between departure and arrival dates, defaults to `0`

Creates a new Segment from the provided `*attributes*`.

### segment.key()

- returns: <[string]>

A unique identifier for the segment, created by combining the flight number, departure city, and departure date.

Examples:

```javascript
segment.key() // Returns '2018-10-01:SIN:CX636'
```

### segment.departureMoment()

- returns: <[Moment]>

Departure date and time (with time zone of the departure airport).

### segment.arrivalMoment()

- returns: <[Moment]>

Arrival date and time (with time zone of the destination airport).

### segment.toJSON()

- returns: <[Object]>

Creates a JSON representation of the Segment.

### segment.toString()

- returns: <[string]>

A string representation of the return value of [`segment.toJSON()`](#segment-tojson).

### segment.airline

- returns: <[string]>

2-letter IATA code of the operator (which may be different from the flight number prefix).

### segment.flight

- returns: <[string]>

Official flight number, formed by a 2-letter airline designator followed by a number, such as `"CX888"`.

### segment.aircraft

- returns: <[string]>

4-letter ICAO code of the aircraft (although may be an IATA code or regular description if the ICAO code cannot be found). If the aircraft type is unknown, returns `null`.

### segment.fromCity

- returns: <[string]>

The 3-letter IATA departure airport.

### segment.toCity

- returns: <[string]>

The 3-letter IATA destination airport.

### segment.date

- returns: <[string]>

The departure date in ISO 8601 format (`'YYYY-MM-DD'`).

### segment.departure

- returns: <[string]>

The departure time in ISO 8601 format (`'HH:mm'`).

### segment.arrival

- returns: <[string]>

The arrival time in ISO 8601 format (`'HH:mm'`).

### segment.duration

- returns: <[number]>

The duration of the flight in minutes.

### segment.nextConnection

- returns: <[number]>

The layover time in minutes. If there is no connecting flight or the Segment does not yet belong to a [Flight], will be `null`.

### segment.cabin

- returns: <[string]> A value belonging to [`Flightplan.cabins`](#flightplan-cabins))

If a Segment is accessed via an [Award], the `cabin` property will be set according to the [Award.cabins](#award-cabins) property. Otherwise it will be `null`.

Examples:

```javascript
const results = await engine.search(query)
results.awards[0].cabins // Returns [ 'first', 'business' ]
results.awards[0].flight.segments[0].cabin // Returns 'first'
results.awards[0].flight.segments[1].cabin // Returns 'business'
results.flights[0].segments[0].cabin // Returns null
```

### segment.stops

- returns: <[number]>

The number of stops on this segment.

### segment.lagDays

- returns: <[number]>

If the flight arrives on a different date than it departed, this will be the difference in days (positive or negative). In other words, adding this number of days to the departure date will give the arrival date.

Examples:

```javascript
const iso = 'YYYY-MM-DD HH:mm Z'

// NH 106 (HND - LAX) arrives 1 day earlier than it departs
segment.departureMoment().format(iso) // Returns: '2018-11-10 00:05 +09:00'
segment.arrivalMoment().format(iso)   // Returns: '2018-11-09 17:00 -08:00'
segment.lagDays // Returns: -1

// NZ 5 (LAX - AKL) arrives 2 days later than it departs
segment.departurMoment().format(iso)  // Returns: '2018-10-25 22:30 +09:00'
segment.arrivalMoment().format(iso)   // Returns: '2018-10-27 07:15 +13:00'
segment.lagDays // Returns: 2
```

### segment.overnight

- returns: <[boolean]>

Returns `true` if the departure time plus duration would crossover 1:00 AM in the departure airport's time zone.

# class: Award

A reedemable award fare, associated with a specific [Flight]. A typical example looks like:

```javascript
award.toJSON()
// Returns:
// { flight: { ... },
//   engine: 'CX',
//   partner: false,
//   cabins: [ 'first' ],
//   mixedCabin: false,
//   fare: { ... },
//   quantity: 2,
//   exact: false,
//   waitlisted: false,
//   mileageCost: 110000,
//   fees: '1188.06 HKD' }
```

#### Methods
- [new Award(*attributes*, [*flight*])](#new-award-attributes-flight)
- [award.toJSON(*includeFlight*)](#award-tojson-includeflight)
- [award.toString()](#award-tostring)

#### Properties
- [award.flight](#award-flight)
- [award.engine](#award-engine)
- [award.partner](#award-partner)
- [award.cabins](#award-cabins)
- [award.mixedCabin](#award-mixedcabin)
- [award.fare](#award-fare)
- [award.quantity](#award-quantity)
- [award.exact](#award-exact)
- [award.waitlisted](#award-waitlisted)
- [award.mileageCost](#award-mileageCost)
- [award.fees](#award-fees)

### new Award(*attributes*, [*flight*])

- `attributes` <[Object]>
  - `engine` <[string]> 2-letter IATA code of the airline website providing the award
  - `partner` <[boolean]> Optional flag specifying whether this is a partner award, defaults to comparing the segments on `flight` to `engine`, otherwise `false` if `flight` is `null`
  - `cabins` <[Array]<[string]>> Optional list of values belonging to [`Flightplan.cabins`](#flightplan-cabins)). Defaults to the value of [Segment.cabin](#segment-cabin) for each [Segment] on the provided `*flight*`. If a [Segment] does not have a `cabin` defined, the `cabin` from the `fare` will be substituted.
  - `fare` <[BookingClass]|[string]> A booking class (or booking class code) corresponding to the list returned by [`Config.fares`](#config-fares)
  - `quantity` <[number]> Number of passengers for which the award is available
  - `exact` <[boolean]> Optional flag specifying whether the quantity provided is exact, or a lower bound, defaults to `false`
  - `waitlisted` <[boolean]> Optional flag specifying whether the award is waitlisted, defaults to `false`
  - `mileageCost` <[number]> Optional cost of the award (for a single passenger) in miles, defaults to `null`
  - `fees` <[string]> Optional fees associated with the award (for example `"123.10 USD"`), defaults to `null`
- `flight` <[Flight]> Optional [Flight] associated with this Award, defaults to `null`

Creates a new Award from the provided `*attributes*`.

### award.toJSON(*includeFlight*)

- `includeFlight` Optional flag to render the [`flight`](#award-flight) property in the JSON output, defaults to `true`
- returns: <[Object]>

Creates a JSON representation of the Award.

### award.toString()

- returns: <[string]>

A string representation of the return value of [`award.toJSON()`](#award-tojson).

### award.flight

- returns: <[Flight]>

The [Flight] associated with the Award.

### award.engine

- returns: <[string]>

The 2-letter IATA code of the airline website offering the award.

### award.partner

- returns: <[boolean]>

Whether the award is being offered by a partner of the airline. Airlines have different rules for defining *partner* awards, this property usually indicates what the website calls the award, irrespective of what actual airline the flight is on. For example, the KrisFlyer website may consider Silk Air flights to not be partner awards, even though they are on a different airline than Singapore Airlines.

### award.cabins

- returns: <[Array]<[string]>> A list of values belonging to [`Flightplan.cabins`](#flightplan-cabins))

A list of cabins (belonging to [Flightplan.cabins](#fp-cabins) that indicates the cabin of service on each segment of the award flight.

### award.mixedCabin

- returns: <[boolean]> 

If `false`, the cabin of service is the same on every segment of the award flight.

### award.fare

- returns: <[BookingClass]>

The [BookingClass] associated with the Award.

### award.quantity

- returns: <[number]>

The quantity at which the award is being offered.

### award.exact

- returns: <[boolean]>

If `true`, the quantity offered is exactly how many seats are available. If false, there may be more available seats than reflected by `quantity`.

### award.waitlisted

- returns: <[boolean]>

If `true`, the award being offered is subject to clearing a waitlist and not immediately available.

### award.mileageCost

- returns: <[number]>

If known, the cost of the award (in miles) per person. If not known, returns `null`.

### award.fees

- returns: <[string]>

If known, the fees associated with the award, formatted as a floating-point number and currency code. For example, `"123.10 USD"`. The currency is determined by the airline website, Flightplan performs no currency conversions. If not known, returns `null`.

# Simple Duration
Time durations are provided by the following format:

> [[[*days*:]*hours*:]*minutes*:]*seconds*[.milliseconds]

For example, all of the following are valid durations:

```javascript
'01:12:15:30' // 1 day, 12 hours, 15 minutes, 30 seconds
'3:15' // 3 minutes, 15 seconds
'00:30' // 30 seconds
'15' // 15 seconds
'3.850' // 3 seconds, 850 milliseconds
```

When providing a time range, if an array is provided, it will be interpreted as a range, and a value chosen randomly from within the range. Otherwise, if a string, the exact value will be used.

```javascript
[ '00:15', '01:30' ] // A random duration between 15 and 90 seconds
'00:30' // Exactly 30 seconds
```

[any]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Data_types "any"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "function"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[Response]: https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-response "Response"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[Browser]: https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-browser "Browser"
[Page]: https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-page "Page"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Moment]: http://momentjs.com "Moment"
[SimpleDuration]: #simple-duration "Simple Duration"
[ISO8601Duration]: https://en.wikipedia.org/wiki/ISO_8601#Durations "ISO 8601 Duration"
[Engine]: #class-engine
[Config]: #class-config
[Searcher]: #class-searcher
[Parser]: #class-parser
[Query]: #class-query
[Results]: #class-results
[Flight]: #class-flight
[Segment]: #class-segment
[Award]: #class-award