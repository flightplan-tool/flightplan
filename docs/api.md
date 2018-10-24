# API

# class *Flightplan*

- [Flightplan#new(airline)](#newairline---engine)
- [Flightplan#supported([airline])](#supporteddstring---boolean-array)
- [Flightplan#aircraft](#aircraft---array)
- [Flightplan#airlines](#airlines---array)
- [Flightplan#airports](#airports---object)
- [Flightplan#cabins](#cabins---object)
- [Flightplan#defaults.config](#defaults-config---object)
- [Flightplan#defaults.options](#defaults-options---object)
- [Flightplan#profiles](#profiles---object)

### .new(*airline*) -> *Engine*

Create a new [`Engine`](#class-engine) for the provided airline IATA code.

```javascript
flightplan.new('SQ') // Create an engine to search KrisFlyer awards
```

### .supported([*airline*]) -> *boolean* | *array*

Returns true if an engine can be created for the specified airline. If no airline is specified, an array of all supported airlines will be returned.

```javascript
flightplan.supported('BA') // Returns true
flightplan.supported() // Returns [ 'AC', 'BA', 'CX', ... ]
```

### .aircraft -> *array*

Returns an array of objects, representing known aircraft. Each object may contain the following keys:
* `iata`: *string*
* `icao`: *string*
* `name`: *string*

```javascript
flightplan.aircraft.find(x => x.icao === 'B777')
// Returns { iata: '777', icao: 'B777', name: 'Boeing 777-200/300' }
```

### .airlines -> *array*

Returns an array of objects, representing known airlines. Each object may contain the following keys:
* `iata`: *string*
* `icao`: *string*
* `name`: *string*
* `callsign`: *string*
* `aliases`: *string*
* `alliances`: *array*

```javascript
flightplan.aircraft.find(x => x.icao === 'SIA')
// Returns { iata: 'SQ', icao: 'SIA', name: 'Singapore Airlines', callsign: 'SINGAPORE', aliases: [ 'Singapore Airlines Ltd' ], alliances: [ 'KF', '*A' ] }
```

### .airports -> *Object*

Returns an Object, representing known airports. The keys of the object are IATA airport codes. The values are objects, which may contain the following keys:
* `name`: *string*
* `city`: *string*
* `country`: *string*
* `time zone`: *string*
* `offset`: *string*

```javascript
flightplan.airports['JFK']
// Returns { name: 'John F Kennedy International Airport', city: 'New York', country: 'United States', time zone: 'America/New_York', offset: -5 }
```

While airport data can be used for multiple purposes, most important they are needed by Flightplan to map airport arrival and departure times to their proper time zone, so itineraries can be properly understood.

### .cabins -> *Object*

Returns the list of cabins understood by Flightplan. All awards must map to a set of these cabins (one cabin per segment on the itinerary). The current supported values are: `first`, `business`, `premium`, and `economy`.

```javascript
flightplan.cabins.first // Returns 'first'
Object.keys(flightplan.cabins) // Returns [ 'first', 'business', 'premium', 'economy' ]
```

### .defaults.config -> *Object*

Default configuration options for [`Engine`](#class-engine) instances.

### .defaults.options -> *Object*

Default initialization options for [`Engine`](#class-engine) instances.

```javascript
flightplan.defaults.options
// Returns:
// { parse: true,
//   args: [],
//   headless: false,
//   proxy: undefined,
//   throttle: true,
//   timeout: 90000,
//   verbose: true }
```

### .profiles -> *Object*

Useful presets of throttling settings specified in an [`Engine`](#class-engine) instance's config. While an engine can completely customize it's throttling behavior, these profiles provide reasonable defaults.
* `delayBetweenRequests`: [*time-range*](#time-range) The amount of time to wait between successive search requests. This is inclusive of the time the request took, so if this value was one minute, and the request took 15 seconds, the actual delay until the start of the next request would be 45 seconds.
* `requestsPerHour`: *number* An absolute limit, on the number of requests that can be made per hour.
* `restPeriod`: [*time-range*](#time-range) How often we enforce the rate limit given by `requestsPerHour`. For example, if we have a rest period of 30 minutes, and `requestsPerHour` is 100, we can only execute 50 requests every 30 minutes (`requestsPerHour * restPeriod / 1 hour`). Once we've made 50 requests, we must wait until that 30 minutes is up (called the resting period). This allows for more sophisticated human-like behavior, such as searching a short spurt, taking a break, and then continuing.

```javascript
Object.keys(flightplan.profiles) // Returns [ 'slow', 'normal', 'fast' ]
flightplan.profiles.normal
// Returns:
// { delayBetweenRequests: [ '00:20', '00:30' ],
//   requestsPerHour: 60,
//   restPeriod: [ '15:00', '30:00' ] }
```

# class *Flightplan.Engine*

An Engine is used to execute a flight award search. Each Engine instance is associated with a specific airline website (for example, "KrisFlyer" or "AsiaMiles"), and contains [`Searcher`](#class-searcher) and [`Parser`](#class-parser) instance.

# class *Flightplan.Searcher*

> **Internal Only:** This class is not exposed to end-users, but must be subclassed by developers wishing to add support for a new airline website to Flightplan.

A Searcher is used by [`Engine`](#class-engine) to connect to the airline's website, enter search parameters, and return the results (in the form of HTML or JSON responses). It contains a single Headless Chrome Browser instance with a single Page, used to run the search. **Note:** A Searcher can only run one search at a time, so for both Searcher and Engine you must wait until the Promise returned by `.search()` is resolved before searching again.

# class *Flightplan.Parser*

> **Internal Only:** This class is not exposed to end-users, but must be subclassed by developers wishing to add support for a new airline website to Flightplan.

A Parser is used by [`Results`](#class-results) to parse the HTML or JSON responses returned by a [`Searcher`](#class-searcher), and return a list of [`Flights`](#class-Flight) and [`Awards`](#class-Award).

# class *Flightplan.Results*

Results wraps the [`Searcher`](#class-Searcher) response, and uses a [`Parser`](#class-Parser) to provide access to a list of [`Flights`](#class-Flight) and [`Awards`](#class-Award).

# class *Flightplan.Flight*

- [new Flight(segments)](#new-flight-segments)
- [new Flight(flight, award)](#new-flight-flight-award)
- [Flight#key()](#key---string)
- [Flight#dateObject()](#dateObject---DateTime)
- [Flight#departureObject()](#departureObject---DateTime)
- [Flight#arrivalObject()](#arrivalObject---DateTime)
- [Flight#toJSON()](#toJSON---object)
- [Flight#toString()](#toString---object)
- [Properties](#properties)

Flight represents a unique itinerary, independent of an award fare or cabin designation, having a list of [`Segments`](#class-segment). A flight can be uniquely identified by the list of flight numbers for each segment, as well as their departure dates. For example, consider the following itinerary:

* AA2 (LAX-JFK) - AA100 (JFK-LHR)

If both AA2 and AA100 depart on the same day, that is a different Flight than if AA100 departs the following day. Thus, the flight numbers alone are not enough to uniquely identify the Flight.

### new Flight(*segments*)

Creates a new Flight from an array of segments.

### new Flight(*flight*, *award*)

Creates a new Flight from an existing flight, by associating it with an [Award](class-award). Used as a light-weight wrapper by Award to avoid copying Flight data, by referencing the original Flight.

### .key() -> *string*

Returns a string key that can be used to uniquely identify the itinerary. The key is created by combining the flight numbers and departure dates of each segment (with successive dates encoded as the difference in days from the first date).

```javascript
flight.key() // Returns '2018-10-01:CX636:1:CX826'
```

### .dateObject() -> [*DateTime*](https://moment.github.io/luxon/docs/class/src/datetime.js~DateTime.html)

Returns the departure date of the first segment as a Luxon DateTime object (date only, without the time set).

### .departureObject() -> [*DateTime*](https://moment.github.io/luxon/docs/class/src/datetime.js~DateTime.html)

Returns a Luxon DateTime object representing the departure date and time (with time zone of the departure airport) of the first segment.

### .arrivalObject() -> [*DateTime*](https://moment.github.io/luxon/docs/class/src/datetime.js~DateTime.html)

Returns a Luxon DateTime object representing the arrival date and time (with time zone of the destination airport) of the last segment.

### .toJSON() -> *Object*

Returns a read-only JSON representation of the Flight. (See [Properties](#properties))

### .toString()

Returns a string representation of the return value of the `.toJSON()` method.

## Properties

* `segments`: *array* The list of segments in the itinerary
* `fromCity`: *string* The 3-letter IATA departure airport of the first segment.
* `toCity`: *string* The 3-letter IATA destination airport of the last segment.
* `date`: *string* The departure date of the first segment in ISO 8601 format.
* `departure`: *string* The departure time of the first segment in ISO 8601 format.
* `arrival`: *string* The arrival time fo the last segment in ISO 8601 format.
* `duration`: *number* The duration of the flight in minutes (including layovers).
* `minLayover`: *number* The duration of the shortest layover (or `null` if there are no layovers).
* `maxLayover`: *number* The duration of the longest layover (or `null` if there are no layovers).
* `stops`: *number* The total number of stops in the itinerary.
* `lagDays`: *number* The difference in days between the departure date of the first segment and the arrival date of the last segment.
* `overnight`: *boolean* True if the itinerary contains any overnight segments.

```javascript
flight.toJSON()
// Returns:
// { segments: [
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

# class *Flightplan.Segment*

A specific segment of a [`Flight`](#class-Flight). It can be uniquely identified by it's flight number and date, and has the following properties:

* `airline`: *string* 2-letter IATA code of the operator (which may be different from the flight number prefix).
* `flight`: *string* The official flight number.
* `aircraft`: *string* The 4-letter ICAO code of the aircraft (although may be an IATA code or regular description if the ICAO code cannot be found).
* `fromCity`: *string* The 3-letter IATA departure airport.
* `toCity`: *string* The 3-letter IATA destination airport.
* `date`: *string* The departure date in ISO 8601 format.
* `departure`: *string* The departure time in ISO 8601 format.
* `arrival`: *string* The arrival time in ISO 8601 format.
* `duration`: *number* The duration of the flight in minutes.
* `nextConnection`: *number* The layover time in minutes. If there is no connecting flight, will be `null`.
* `cabin`: *string* If accessed via `Award#flight.segments`, a segment will set it's `cabin` property according to the Award's `cabins` property. If accessed via `Results#flights[...].segments`, it will be `null`.
* `stops`: *number* The number of stops the segment contains.
* `lagDays`: *number* If the flight arrives on a different date than it departed, this will be the difference in days (positive or negative). In other words, adding this number of days to the departure date will give the arrival date.
* `overnight`: *boolean* True if the departure time plus duration would crossover midnight in the departure airport's time zone.

### new Segment(*attributes*)

Creates a new Segment. The *attributes* object may contain the following properties:

* `airline`: *Optional* Defaults to the first two letters of `flight`.
* `flight`: *Required*
* `aircraft`: *Optional* Defaults to `null`.
* `fromCity`: *Required*
* `toCity`: *Required*
* `date`: *Required*
* `departure`: *Required*
* `arrival`: *Required*
* `cabin`: *Optional* If defined, will be used to infer parent [Award's](class-award) `cabins` property.
* `stops`: *Optional* Defaults to `0`.

### new Segment(*segment*, *award*, *index*)

Creates a new Segment, by taking an existing Segment and associating it with an [Award](class-award) and a slot on that Award's itinerary. Used as a light-weight wrapper by Award to avoid copying Segment data, by referencing the original Segment.

### .dateObject() -> [*DateTime*](https://moment.github.io/luxon/docs/class/src/datetime.js~DateTime.html)

Returns the departure date as a Luxon DateTime object (date only, without the time set).

### .departureObject() -> [*DateTime*](https://moment.github.io/luxon/docs/class/src/datetime.js~DateTime.html)

Returns a Luxon DateTime object representing the departure date and time (with time zone of the departure airport).

### .arrivalObject() -> [*DateTime*](https://moment.github.io/luxon/docs/class/src/datetime.js~DateTime.html)

Returns a Luxon DateTime object representing the arrival date and time (with time zone of the destination airport).

### .toJSON() -> *Object*

Returns a read-only JSON representation of the Segment.

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
//   stops: 0,
//   lagDays: 2,
     overnight: true }
```

### .toString()

Returns a string representation of the return value of the `.toJSON()` method.

# class *Flightplan.Award*

A reedemable award fare, associated with a specific [`Flight`](#class-flight). It has the following properties:

* `flight`: [*Flight*](#class-flight) The Flight associated with this award.
* `engine`: *string* 2-letter IATA code of the airline website offering the award.
* `partner`: *string* Whether the award is being offered by a partner of the airline. **Note:** Airlines have different ways of determining what is a *partner* award, this property usually indicates whether the website marks this award as being *partner* or not, irrespective of what actual airline the flight is on.
* `cabins`: *array* A list of cabins (belonging to [Flightplan.cabins](cabins---object) that indicates the cabin of service on each segment of the award flight.
* `code`: *string* A fare code, the complete list of which can be found in [Engine.config.fares](fares---object). An award fare code determines the award's nominal *class* and *type* (fixed, market, saver, priority tiers, etc...).
* `quantity`: *number* The quantity at which the award is being offered.
* `exact`: *boolean* If true, the quantity offered is exactly how many seats are available. If false, there may be more available seats than reflected by `quantity`.
* `waitlisted`: *boolean* True if the award being offered is not immediately available and subject to clearing a waitlist.
* `mileageCost`: *number* If known, the cost of the award (in miles) per person. If not known, returns `null`.
* `fees`: *string* If known, the fees associated with the award. The currency is determined by the airline website. If not known, returns `null`.

### new Award(*attributes*, *flight*)

Creates a new Award. The *attributes* object may contain the following properties:

* `engine`: *Required*
* `partner`: *Optional* Defaults to whether all segments of *flight* are on the same airline as provided in `engine`.
* `cabins`: *Optional* If not provided, will be inferred from the segments on *flight*. If not all segments specify a cabin, an error will be thrown.
* `code`: *Required* Must be a valid code belonging to [Engine.config.fares](fares---object).
* `quantity`: *Required*
* `exact`: *Optional* Defaults to `false`.
* `waitlisted`: *Optional* Defaults to `false`.
* `mileageCost`: *Optional* Defaults to `null`.
* `fees`: *Optional* Defaults to `null`.

### .toJSON() -> *Object*

Returns a read-only JSON representation of the Award. The Flight is rendered as the output of [Flight#key()](#flight-key---string), since the data would otherwise be duplicated across many Award instances.

```javascript
award.toJSON()
// Returns:
// { flight: '2018-11-01:CX888',
//   engine: 'CX',
//   partner: false,
//   cabins: [ 'first' ],
//   code: 'FS',
//   quantity: 2,
//   exact: false,
//   waitlisted: false,
//   mileageCost: 110000,
//   fees: '1188.06 HKD' }
```

### .toString()

Returns a string representation of the return value of the `.toJSON()` method.

# Time Range
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