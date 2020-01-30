const { cabins, profiles } = require("../../consts");

module.exports = {
  searcher: require("./searcher"),
  parser: require("./parser"),
  config: {
    name: "Mileage Plan",
    homeURL: "https://www.delta.com/",
    searchURL: "https://www.delta.com/flight-search-2/book-a-flight",
    validation: {
      minDays: 0,
      maxDays: 330
    },
    modifiable: ["departDate", "returnDate"],
    throttling: profiles.fast,
    fares: [
      { code: "A", cabin: cabins.first, saver: true, name: "First" },
      {
        code: "U",
        cabin: cabins.business,
        saver: true,
        name: "Partner Business"
      },
      { code: "W", cabin: cabins.economy, saver: true, name: "Economy" }
    ],
    loginRequired: true
  }
};
