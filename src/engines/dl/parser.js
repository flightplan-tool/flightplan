const moment = require("moment-timezone");

const Award = require("../../Award");
const Flight = require("../../Flight");
const Parser = require("../../Parser");
const Segment = require("../../Segment");
const { cabins } = require("../../consts");
const utils = require("../../utils");

// Regex patterns
const reQuantity = /only\s(\d+)\s+left\sat/i;

const cabinCodes = {
  E: cabins.economy,
  P: cabins.premium,
  B: cabins.business,
  F: cabins.first
};
module.exports = class extends Parser {
  parse(results) {
    const $ = results.$("results");

    // Return all elements that represents specific flights
    // eg. https://monosnap.com/file/gtFnd4VZXeAXddatfYBGiQzruwMAv8
    const flights = this.parseFlights($, ".flightcardContainer");

    return flights;
  }

  parseFlights($, sel) {
    // When working on a new parser, log the output and do experimentation in browser
    // console.log("#parseFlight: Sel is ");
    // console.log("*********************");
    // console.log($(sel));
    // console.log("*********************");
    const { engine, query } = this.results;

    // Iterate over flights
    const awards = [];

    $(sel).each((_, row) => {
      // Get cities, and direction
      const fromCity = this.generateCities($, row);

      // Get departure / arrival dates
      const { departDate, defaultArrivalDate } = this.generateDates($);

      // Get departure / arrival times
      const { departTime, arrivalTime } = this.generateTimes($, row);

      const segments = this.createSegmentsForRow(
        $,
        row,
        fromCity,
        departDate,
        departTime,
        arrivalTime,
        defaultArrivalDate
      );
      console.log("******************* segments creaated *******");

      // Get cabins / quantity for award
      this.generateAwards($, row, segments, engine, awards);
    });

    return awards;
  }

  generateCities($, row) {
    const airports = $(row).find(".flightSecFocus");
    const fromCity = airports
      .first()
      .text()
      .trim()
      .split(" ")[3];
    return fromCity;
  }

  generateDates($) {
    const strDepartDate = $(".airportinfo")
      .text()
      .trim();
    const departDate = moment(strDepartDate).format("YYYY-MM-DD");
    // By default, Delta does not show any arrival dates
    // hence default arrivale date is the same as departure date
    const defaultArrivalDate = departDate;
    return { departDate, defaultArrivalDate };
  }

  generateTimes($, row) {
    const departTimeStr = $(row)
      .find(".trip-time.pr0-sm-down")
      .first()
      .text()
      .trim();
    const arrivalTimeStr = $(row)
      .find(".trip-time.pl0-sm-down")
      .first()
      .text()
      .trim();
    const departTime = moment(departTimeStr, "hh:mm a").format("HH:mm");
    const arrivalTime = moment(arrivalTimeStr, "hh:mm a").format("HH:mm");
    return { departTime, arrivalTime };
  }

  generateAwards($, row, segments, engine, awards) {
    $(row)
      .find(".farecellitem")
      .each((_, x) => {
        const flight = new Flight(segments);
        const seatsLeftStr = $(x)
          .find(".seatLeft")
          .text()
          .trim();
        const seatsLeft = seatsLeftStr ? parseInt(seatsLeftStr) : 1;
        const cabin = "economy"; //this.parseCabin(x);
        const fare = this.findFare(cabin);
        const cabins = flight.segments.map(x => cabin);
        const award = new Award(
          {
            engine,
            fare,
            cabins,
            quantity: seatsLeft,
            mileageCost: 100000
          },
          flight
        );
        // console.log("Award is " + award);
        awards.push(award);
      });
  }

  createSegmentsForRow(
    $,
    row,
    fromCity,
    departDate,
    departTime,
    arrivalTime,
    defaultArrivalDate
  ) {
    const segments = [];
    let index = 0;

    const { numberOfLayovers, averageFlightTime } = this.getFlightTime($, row);

    $(row)
      .find(".upsellpopupanchor.ng-star-inserted")
      .each((_, x) => {
        const toCityEl = $(row).find(".flightStopLayover")[index++];
        let toCity;
        let nextConnectionMinutes;
        ({ toCity, nextConnectionMinutes } = this.extractConnectionDetails(
          $(toCityEl).text()
        ));

        const { aircraft, airline, flightNumber } = this.getFlightDetails($, x);

        let arrivalDate = this.getArrivalDate(defaultArrivalDate, $, row);
        const lagDays = this.calculateLagDays(departDate, arrivalDate);

        // Add segment
        const segment = new Segment({
          aircraft: aircraft,
          airline: airline,
          flight: `${airline}${flightNumber}`,
          fromCity: fromCity,
          toCity,
          date: departDate,
          departure: departTime,
          arrival: arrivalTime,
          lagDays: lagDays,
          nextConnection: nextConnectionMinutes,
          //TODO
          cabin: cabins.business,
          stops: numberOfLayovers
        });
        console.log("Segment created is " + segment);
        segments.push(segment);
        fromCity = toCity;

        if (nextConnectionMinutes) {
          console.log("Calculating info for next segment");
          departTime = moment(arrivalTime, "hh:mm a")
            .add(nextConnectionMinutes, "minutes")
            .format("HH:mm");
          departDate = moment(departDate)
            .add(nextConnectionMinutes, "minutes")
            .format("YYYY-MM-DD");
          arrivalTime = moment(departDate)
            .add(averageFlightTime, "minutes")
            .format("HH:mm");
        }
      });
    return segments;
  }

  getArrivalDate(defaultArrivalDate, $, row) {
    let arrivalDate = defaultArrivalDate;
    if ($(row).find(".travelDate").length > 0) {
      const strArrivalDate = $(row)
        .find(".travelDate")
        .text()
        .trim();
      // console.log(`strArrivalDate is ${strArrivalDate}`);
      arrivalDate = moment(strArrivalDate, "ddd D MMM").format("YYYY-MM-DD");
      // console.log(`New arrivalDate is ${arrivalDate}`);
    }
    return arrivalDate;
  }

  getFlightTime($, row) {
    const totalJourneyDurationStr = $(row)
      .find(".totalTime")
      .text();
    const totalJourneyDuration = this.totalJourneyDuration(
      totalJourneyDurationStr
    );
    const totalLayoverTime = this.totalLayoverTime();
    const numberOfLayovers = calculateNumberOfLayovers($, row);
    // TODO: Hack! It's not easy to get individual flight times so
    // we are going to use an average. I know it's bad, but whatcha gonna do
    const averageFlightTime =
      (totalJourneyDuration - totalLayoverTime) / numberOfLayovers;
    return { numberOfLayovers, averageFlightTime };
  }

  getFlightDetails($, x) {
    const airlineAndFlight = $(x)
      .text()
      .trim()
      .split(" ")[0];
    const airline = airlineAndFlight.substr(0, 2);
    const flightNumber = airlineAndFlight.substr(2);
    // Type of plane
    const aircraft = "-";
    return { aircraft, airline, flightNumber };
  }

  /**
   *
   * @param {*} departTime
   * @param {*} arrivalTime
   */
  calculateLagDays(departDate, arrivalDate) {
    const lag = moment(arrivalDate).diff(moment(departDate), "days");
    console.log(`calculateLagDays ${lag} ${arrivalDate} ${departDate}`);
    return lag;
  }

  /**
   *
   * @param {*} toCityString "arrival airport code LHR" or "layover airport code AMS layover duration1h  25m"
   */
  extractConnectionDetails(toCityString) {
    let toCity, nextConnectionMinutes;
    let matching;
    if (
      (matching = toCityString.match(
        /layover airport code (.*) layover duration(.*)/
      ))
    ) {
      toCity = matching[1].trim();
      const nextConnection = matching[2].trim();
      let nextConnectionMoment = moment(nextConnection, "hh:mm a");
      if (!nextConnectionMoment.isValid()) {
        nextConnectionMoment = moment(nextConnection, "mm");
      }
      let nextConnectionInFormat = nextConnectionMoment.format("HH:mm");
      nextConnectionMinutes = moment
        .duration(nextConnectionInFormat)
        .asMinutes();
    } else {
      matching = toCityString.match(/arrival airport code (.*)/);
      toCity = matching[1].trim();
    }
    return { toCity, nextConnectionMinutes };
  }

  /**
   *
   * Return time in minutes
   */
  totalLayoverTime() {
    return 206;
  }

  /**
   * Total time spent on the trip
   *
   * @param {String} durationString
   */
  totalJourneyDuration(durationString) {
    let timeStr;
    const matching = durationString.match(/journey duration(.*)/);
    timeStr = matching[1].trim();
    let timeMoment = moment(timeStr, "hh:mm a");
    if (!timeMoment.isValid()) {
      timeMoment = moment(timeStr, "mm a");
    }
    const time = timeMoment.format("HH:mm");
    // console.log(`timeStr is ${timeStr} ${moment.duration(time).asMinutes()}`);
    return moment.duration(time).asMinutes();
  }

  parseDate(str, query, outbound) {
    let m = moment.utc(str, "D MMM", true);

    if (m.isValid()) {
      return outbound ? query.closestDeparture(m) : query.closestReturn(m);
    }
    return null;
  }

  parseTime(str) {
    //TODO: fix me, man!
    return "16:00";
  }

  parseQuantity(ele) {
    if (ele) {
      const str = ele.text().trim();
      const result = reQuantity.exec(str);
      if (result) {
        return parseInt(result[1]);
      }
    }
    return null;
  }

  parseCabin(ele) {
    const displayCodes = {
      "coach-fare": cabins.economy,
      "business-fare": cabins.business,
      "first-fare": cabins.first
    };

    for (var cabinClass in displayCodes) {
      if (ele.attribs.class.indexOf(cabinClass) !== -1) {
        return displayCodes[cabinClass];
      }
    }
  }
};
function calculateNumberOfLayovers($, row) {
  const isNonStop = $(row)
    .find(".fareIconBadge")
    .text()
    .match("Nonstop");
  if (isNonStop) {
    return 0;
  }
  return $(row).find(".flightStopLayover").length - 1;
}
