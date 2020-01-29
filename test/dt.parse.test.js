const fp = require("../src/index");

// id = "SQ";
// query = {
//   partners: true,
//   cabin: "business",
//   quantity: 1,
//   fromCity: "SFO",
//   toCity: "SIN",
//   departDate: "2019-09-18",
//   returnDate: "2019-09-25"
// };
// html = [
//   {
//     name: "results",
//     path: "./test/__mock__/SQ-SFO-SIN-2019-09-18-RT1JP-5ebd.html"
//   },
//   {
//     name: "partners1",
//     path: "test/__mock__/SQ-SFO-SIN-2019-09-18-RT1JP-5ebd-1.html"
//   }
// ];
describe("Run parse", () => {
  test("Parse", () => {
    id = "DT";
    query = {
      partners: true,
      cabin: "business",
      quantity: 1,
      fromCity: "JFK",
      toCity: "HKG",
      departDate: "2020-02-09",
      returnDate: "2020-02-11"
    };
    html = [
      {
        name: "results",
        path: "./test/__mock__/DT-HKG-JFK-2020-01-29-1580273858604.html"
      }
    ];
    const results = fp.Results.parse({
      engine: id,
      query: query,
      html: html
    });

    expect(results.ok).toBeTruthy();
    expect(results.error).toBeNull();

    res = results.trimContents().toJSON(true);
    // console.log("Test results are \n *************");
    // console.log(res);
    console.log(JSON.stringify(res.flights));
    // console.log("Test results are \n *************");
  });
});
