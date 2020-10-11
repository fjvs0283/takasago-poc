const Apify = require('apify');
const { utils: { log } } = Apify;
const { createSerpRequest, extractOrganicResults, extractTotalResults } = require('./tools');

const domain = 'google.com';


exports.handleStart = async ({ request, $ }) => {
    // Handle Start URLs
};

exports.handleList = async ({ request, $ }) => {

    request.userData.finishedAt = new Date();
    const nonzeroPage = request.userData.page + 1; // Display same page numbers as Google, i.e. 1, 2, 3..
    const parsedUrl = url.parse(request.url, true);

    // We know the URL matches (otherwise we have a bug here)
    const matches = new RegExp(`^(http|https)://(www.){0,1}((${domain.join(')|(')}))/search?.*$`, 'i').exec(request.url);
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
        organicResults: extractOrganicResults($, host)
    };

    const searchOffset = nonzeroPage * resultsPerPage;

    // Enqueue new page. Universal "next page" selector
    const nextPageUrl = $(`a[href*="start=${searchOffset}"]`).attr('href');

    if (nextPageUrl) {
        data.hasNextPage = true;
        if (request.userData.page < maxPagesPerQuery - 1 && maxPagesPerQuery) {
            const nextPageHref = url.format({
                ...parsedUrl,
                search: undefined,
                query: {
                    ...parsedUrl.query,
                    start: `${searchOffset}`,
                },
            });
            await requestQueue.addRequest(createSerpRequest(nextPageHref, request.userData.page + 1));
        } 
    }
    await dataset.pushData(data);
};

exports.handleDetail = async ({ request, $ }) => {
    // Handle details
};
