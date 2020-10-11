const Apify = require('apify');
const url = require('url');
const { handleStart, handleList, handleDetail } = require('./routes');
const { getInitialRequests } = require('./tools');

const { utils: { log } } = Apify;

Apify.main(async () => {
    const input = await Apify.getInput();
    const proxyConfiguration = await Apify.createProxyConfiguration({ groups: ['GOOGLE_SERP'],});
    const initialRequests = getInitialRequests(input);
    const requestList = await Apify.openRequestList('initial-requests', initialRequests);
    const requestQueue = await Apify.openRequestQueue();
    const dataset = await Apify.openDataset();

    const crawler = new Apify.CheerioCrawler({
        requestList,
        requestQueue,
        proxyConfiguration,
        maxPagesPerQuery,

        prepareRequestFunction: ({ request }) => {
            const parsedUrl = url.parse(request.url, true);
            request.userData.startedAt = new Date();
            log.info(`Querying "${parsedUrl.query.q}" page ${request.userData.page} ...`);
            return request;
        },

        handlePageTimeoutSecs: 60,
        requestTimeoutSecs: 180,

        handlePageFunction: async (context) => {
            
            const { url, userData: { label } } = context.request;
            
            log.info('Page opened.', { label, url });
            
            switch (label) {
                case 'LIST':
                    return handleList(context);
                case 'DETAIL':
                    return handleDetail(context);
                default:
                    return handleList(context);
            }
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
});
