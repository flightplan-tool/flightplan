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
      let originCity = null;
      let outbound = null;

      // Get cities, and direction
      const airports = $(row).find(".flightSecFocus");
      const fromCity = airports
        .first()
        .text()
        .trim()
        .split(" ")[3];
      // const toCity = airports
      //   .last()
      //   .text()
      //   .trim()
      //   .split(" ")[3];
      // if (!originCity) {
      //   originCity = fromCity;
      //   outbound = originCity === query.fromCity;
      // }

      // Get departure / arrival dates
      const strDepartDate = $(".airportinfo")
        .text()
        .trim();

      const departDate = moment(strDepartDate).format("YYYY-MM-DD");
      // By default, Delta does not show any arrival dates
      // hence default arrivale date is the same as departure date
      const defaultArrivalDate = departDate;

      // Get departure / arrival times
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

      //TODO update flight nunmber
      const airlineAndFlight = $(row)
        .find(".upsellpopupanchor.ng-star-inserted")
        .text()
        .trim()
        .split(" ")[0];

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
      // $(row)
      //   .find("div.SegmentContainer")
      //   .each((_, x) => {
      //     // Create segment for each parsed item
      //   });

      // Get cabins / quantity for award
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
    });

    return awards;
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
    $(row)
      .find(".upsellpopupanchor.ng-star-inserted")
      .each((_, x) => {
        const numberOfLayovers = calculateNumberOfLayovers($, row);
        const toCityEl = $(row).find(".flightStopLayover")[index++];
        let toCity;
        let nextConnectionMinutes;
        ({ toCity, nextConnectionMinutes } = this.extractConnectionDetails(
          $(toCityEl).text()
        ));

        const airlineAndFlight = $(x)
          .text()
          .trim()
          .split(" ")[0];
        const airline = airlineAndFlight.substr(0, 2);
        const flightNumber = airlineAndFlight.substr(2);

        // if ("9378" == flightNumber) {
        //   console.log("******************************");
        //   console.log($(row).html());
        //   console.log("******************************");
        // }

        // Type of plane
        const aircraft = "-";

        //TODO
        // const lagDays = 0;
        let arrivalDate = defaultArrivalDate;
        if ($(row).find(".travelDate").length > 0) {
          const strArrivalDate = $(row)
            .find(".travelDate")
            .text()
            .trim();
          console.log(`strArrivalDate is ${strArrivalDate}`);
          arrivalDate = moment(strArrivalDate, "ddd D MMM").format(
            "YYYY-MM-DD"
          );
          console.log(`New arrivalDate is ${arrivalDate}`);
        }
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
          lagDays,
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
            .add("minutes", nextConnectionMinutes)
            .format("HH:mm");
          departDate = moment(departDate)
            .add("minutes", nextConnectionMinutes)
            .format("YYYY-MM-DD");
          arrivalTime = moment(arrivalTime, "hh:mm a")
            .add("hours", 1)
            .format("HH:mm");
        }
      });
    return segments;
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
  return $(row).find(".flightStopLayover").length;
}
