const moment = require("moment-timezone");

const Award = require("../../Award");
const Flight = require("../../Flight");
const Parser = require("../../Parser");
const Segment = require("../../Segment");
const { cabins } = require("../../consts");
const utils = require("../../utils");

// Regex patterns
const reQuantity = /only\s(\d+)\s+left\sat/i;

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
    console.log("Sel is ");
    console.log("*********************");
    console.log($(sel));
    console.log("*********************");
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
      const strDepartDateTime = $(row)
        .find(".trip-time.pr0-sm-down")
        .first()
        .text();
      const strArrivalDateTime = $(row)
        .find(".trip-time.pl0-sm-down")
        .last()
        .text();

      //TODO
      const strDepartDateTime1 = Date();
      const strArrivalDateTime1 = Date();
      const departDate = this.parseDate(strDepartDateTime1, query, outbound);
      const arrivalDate = this.parseDate(strArrivalDateTime1, query, outbound);

      // Get departure / arrival times
      const departTime = strDepartDateTime; //this.parseTime(strDepartDateTime);
      const arrivalTime = strArrivalDateTime; //this.parseTime(strArrivalDateTime);

      //TODO update flight nunmber
      const airline = "AZ";
      const flightNumberArr = $(row)
        .find(".upsellpopupanchor")
        .text()
        .trim()
        .split(" ");
      // const flightNumber = flightNumberArr[flightNumberArr.length - 1];
      const flightNumber = "102";

      // Type of plane
      const aircraft = "Boeing Placeholder";

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
        lagDays: utils.daysBetween(departDate, arrivalDate)
      });
      console.log("Segment created is " + segment);
      segments.push(segment);

      // $(row)
      //   .find("div.SegmentContainer")
      //   .each((_, x) => {
      //     // Create segment for each parsed item
      //   });

      // Get cabins / quantity for award
      $(row)
        .find(".lowest-fare.has-price")
        .each((_, x) => {
          const flight = new Flight(segments);
          const seatsLeft = $(x).find(".SeatsRemainingDiv");
          const quantity =
            this.parseQuantity(seatsLeft) || Math.max(query.quantity, 7);
          const cabin = this.parseCabin(x);
          const fare = this.findFare(cabin);
          const cabins = flight.segments.map(x => cabin);

          awards.push(
            new Award(
              {
                engine,
                fare,
                cabins,
                quantity
              },
              flight
            )
          );
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
