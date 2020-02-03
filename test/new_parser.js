const fp = require("../src/index");
fp.Results;

id = "SQ";
html = [
  {
    name: "results",
    path: "./test/__mock__/SQ-SFO-SIN-2019-09-18-RT1JP-5ebd.html"
  },
  {
    name: "partners1",
    path: "test/__mock__/SQ-SFO-SIN-2019-09-18-RT1JP-5ebd-1.html"
  }
];
json = [
  [
    {
      name: "airports",
      path: "./test/__mock__/NH-HKG-HND-2019-09-18-OW1Y-3507.json"
    }
  ]
];
query = {
  partners: true,
  cabin: "business",
  quantity: 1,
  fromCity: "SFO",
  toCity: "SIN",
  departDate: "2019-09-18",
  returnDate: "2019-09-25"
};
results = fp.Results.parse({
  engine: id,
  query: query,
  html: html
});

engines = require("../src/engines");
Results = require("../src/Results");
id = "dt";
engine = Results._findEngine(id);
config = {
  name: "Mileage Plan",
  homeURL: "https://www.delta.com/",
  searchURL: "https://www.delta.com/flight-search-2/book-a-flight",
  waitUntil: "networkidle0",
  validation: { minDays: 0, maxDays: 330 },
  modifiable: ["departDate", "returnDate"],
  throttling: {
    delayBetweenRequests: ["00:05", "00:20"],
    requestsPerHour: 90,
    restPeriod: ["20:00", "40:00"]
  },
  fares: [
    { code: "A", cabin: "first", saver: true, name: "First" },
    { code: "U", cabin: "business", saver: true, name: "Partner Business" },
    { code: "W", cabin: "economy", saver: true, name: "Economy" }
  ]
};
DTParser = require(`../src/engines/${id}/parser`);
parser = new DTParser(engine, config);
