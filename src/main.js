const Apify = require("apify");
const url = require("url");
const { handleStart, handleList, handleDetail } = require("./routes");
const { getInitialRequests } = require("./tools");

const {
  utils: { log },
} = Apify;

Apify.main(async () => {
  const input = await Apify.getInput();
  const proxyConfiguration = await Apify.createProxyConfiguration({
    groups: ["GOOGLE_SERP"],
  });
  const initialRequests = getInitialRequests(input);
  const requestList = await Apify.openRequestList(
    "initial-requests",
    initialRequests
  );
  const requestQueue = await Apify.openRequestQueue();
  const dataset = await Apify.openDataset();

  const { maxPagesPerQuery } = input;

  const crawler = new Apify.CheerioCrawler({
    requestList,
    requestQueue,
    proxyConfiguration,

    prepareRequestFunction: ({ request }) => {
      const parsedUrl = url.parse(request.url, true);
      request.userData.startedAt = new Date();
      log.info(
        `Querying "${parsedUrl.query.q}" page ${request.userData.page} ...`
      );
      return request;
    },

    handlePageTimeoutSecs: 60,
    requestTimeoutSecs: 180,

    handlePageFunction: async (context, request) => {
      const {
        url,
        userData: { label },
      } = context.request;

      log.info("Page opened.", { label, url });

      switch (label) {
        case "LIST":
          request.userData.finishedAt = new Date();
          const nonzeroPage = request.userData.page + 1; // Display same page numbers as Google, i.e. 1, 2, 3..
          const parsedUrl = url.parse(request.url, true);

          // We know the URL matches (otherwise we have a bug here)

          const resultsPerPage = 10;
          const { host } = parsedUrl;

          // Compose the dataset item.
          const data = {
            searchQuery: {
              term: parsedUrl.query.q,
              page: nonzeroPage,
              resultsPerPage,
            },
            url: request.url,
            hasNextPage: false,
            resultsTotal: extractTotalResults($),
            organicResults: extractOrganicResults($, host),
          };

          const searchOffset = nonzeroPage * resultsPerPage;

          // Enqueue new page. Universal "next page" selector
          const nextPageUrl = $(`a[href*="start=${searchOffset}"]`).attr(
            "href"
          );

          if (nextPageUrl) {
            data.hasNextPage = true;
            if (
              request.userData.page < maxPagesPerQuery - 1 &&
              maxPagesPerQuery
            ) {
              const nextPageHref = url.format({
                ...parsedUrl,
                search: undefined,
                query: {
                  ...parsedUrl.query,
                  start: `${searchOffset}`,
                },
              });
              await requestQueue.addRequest(
                createSerpRequest(nextPageHref, request.userData.page + 1)
              );
            }
          }
          await dataset.pushData(data);

        case "DETAIL":
          return handleDetail(context);
        default:
          return handleList(context);
      }
    },
  });

  log.info("Starting the crawl.");
  await crawler.run();
  log.info("Crawl finished.");
});
