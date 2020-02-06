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
    waitUntil: "networkidle0",
    modifiable: ["departDate", "returnDate"],
    throttling: profiles.fast,
    /**
     * I don't fully understand how these fare codes work,
     * so these are largerly placeholder
     *     https://thepointsguy.co.uk/guide/ba-fare-classes-explained/
     * */
    fares: [
      { code: "O", cabin: cabins.first, saver: true, name: "First" },
      {
        code: "CS",
        cabin: cabins.business,
        name: "Upper Class",
        saver: true
      },
      {
        code: "C1",
        cabin: cabins.business,
        name: "Delta One",
        saver: true
      },
      {
        code: "W",
        cabin: cabins.premium,
        name: "Premium",
        saver: true
      },
      {
        code: "WS",
        cabin: cabins.premium,
        name: "Premium Select",
        saver: true
      },
      {
        code: "YS",
        cabin: cabins.economy,
        name: "Main",
        saver: true
      },
      {
        code: "S",
        cabin: cabins.economy,
        name: "Comfort+",
        saver: true
      },
      {
        code: "Y2",
        cabin: cabins.economy,
        name: "Economy Delight",
        saver: true
      },
      {
        code: "Y3",
        cabin: cabins.economy,
        name: "Economy",
        saver: true
      },
      {
        code: "N",
        cabin: cabins.economy,
        name: "Basic Cabin",
        saver: true
      },
      {
        code: "Y5",
        cabin: cabins.economy,
        name: "Economy Classic",
        saver: true
      }
    ],
    loginRequired: true
  }
};
