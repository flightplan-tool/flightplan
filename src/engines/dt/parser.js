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
    const segments = [];

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
      const toCity = airports
        .last()
        .text()
        .trim()
        .split(" ")[3];
      if (!originCity) {
        originCity = fromCity;
        outbound = originCity === query.fromCity;
      }

      // Get departure / arrival dates
      const strDepartDate = $(".airportinfo")
        .text()
        .trim();
      const strArrivalDate = $(".airportinfo")
        .text()
        .trim();

      const departDate = moment(strDepartDate).format("YYYY-MM-YY");
      const arrivalDate = this.parseDate(strArrivalDate, query, outbound);

      // Get departure / arrival times
      // const departTime = $(row)
      //   .find(".trip-time.pr0-sm-down")
      //   .first()
      //   .text()
      //   .trim();
      // const arrivalTime = $(row)
      //   .find(".trip-time.pl0-sm-down")
      //   .first()
      //   .text()
      //   .trim();
      const departTime = "01:00";
      const arrivalTime = "19:00";

      //TODO update flight nunmber
      const airlineAndFlight = $(row)
        .find(".upsellpopupanchor.ng-star-inserted")
        .first()
        .text()
        .trim()
        .split(" ")[0];
      const airline = airlineAndFlight.substr(0, 2);
      const flightNumber = airlineAndFlight.substr(2);
      // console.log("airline " + airline);
      // const flightNumberArr = $(row)
      //   .find(".upsellpopupanchor")
      //   .text()
      //   .trim()
      //   .split(" ");
      // const flightNumber = flightNumberArr[flightNumberArr.length - 1];
      // const flightNumber = "102";

      // Type of plane
      const aircraft = "-";
      const lagDays = 1; //TODO utils.daysBetween(departDate, arrivalDate);

      // Add segment
      const segment = new Segment({
        aircraft: aircraft,
        airline: airline,
        flight: `${airline}${flightNumber}`,
        fromCity,
        toCity,
        date: departDate,
        departure: departTime,
        arrival: arrivalTime,
        lagDays,
        //TODO
        cabin: cabins.business
      });
      // console.log("Segment created is " + segment);
      segments.push(segment);

      // $(row)
      //   .find("div.SegmentContainer")
      //   .each((_, x) => {
      //     // Create segment for each parsed item
      //   });

      // Get cabins / quantity for award
      const flight = new Flight(segments);
      $(row)
        .find(".farecellitem")
        .each((_, x) => {
          const seatsLeftStr = $(x)
            .find(".seatLeft")
            .text()
            .trim();
          const seatsLeft = seatsLeftStr ? parseInt(seatsLeftStr) : 1;
          const cabin = "economy"; //this.parseCabin(x);
          const fare = this.findFare(cabin);
          // findFare object {"code":"C","cabin":"business","saver":true,"name":"Business / Club"}
          // findFare object {"code":"W","cabin":"premium","saver":true,"name":"Premium Economy"}
          // findFare object {"code":"W","cabin":"premium","saver":true,"name":"Premium Economy"}
          // console.log(`fare is ${JSON.stringify(cabin)}`);
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
