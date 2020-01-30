const fp = require("../src/index");

describe("Run parse", () => {
  test("Parse", () => {
    id = "DL";
    query = {
      partners: true,
      cabin: "business",
      quantity: 1,
      fromCity: "JFK",
      toCity: "LHR",
      departDate: "2020-03-09",
      returnDate: "2020-03-10"
    };
    html = [
      {
        name: "results",
        path: "./test/__mock__/DL-LHR-JFK-2020-03-09-1580345532131.html"
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
    // console.log(JSON.stringify(res.flights));
    // console.log("Test results are \n *************");
  });
});
