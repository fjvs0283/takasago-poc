const queryString = require('query-string');

exports.getInitialRequests = ({ queries }) => {
  return queries
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => !!item)
    .map((queryOrUrl) => {
      const qs = { q: queryOrUrl };
      return exports.createSerpRequest(
        `http://www.google.com/search?${queryString.stringify(qs)}`,
        0
      );
    });
};

exports.createSerpRequest = (url, page) => {
  if (url.startsWith("https://")) url = url.replace("https://", "http://");

  return {
    url,
    userData: {
      label: 'LIST',
      page,
    },
  };
};

exports.extractOrganicResults = ($) => {
  const searchResults = [];

  $(".g .rc").each((index, el) => {
    // HOTFIX: Google is A/B testing a new dropdown, which causes invalid results.
    // For now, just remove it.
    $(el).find("div.action-menu").remove();

    const siteLinks = [];

    const $oldSiteLinksSel = $(el).find("ul li");
    const $newSiteLinksSel = $(el).find(".St3GK a");
    if ($oldSiteLinksSel.length > 0) {
      $oldSiteLinksSel.each((i, siteLinkEl) => {
        siteLinks.push({
          title: $(siteLinkEl).find("h3").text(),
          url: $(siteLinkEl).find("h3 a").attr("href"),
          description: $(siteLinkEl).find("div").text(),
        });
      });
    } else {
      $newSiteLinksSel.each((i, siteLinkEl) => {
        siteLinks.push({
          title: $(siteLinkEl).text(),
          url: $(siteLinkEl).attr("href"),
          // Seems Google removed decription in the new layout, let's keep it for now though
          description:
            $(siteLinkEl)
              .parent("div")
              .parent("h3")
              .parent("div")
              .find("> div")
              .toArray()
              .map((d) => $(d).text())
              .join(" ") || null,
        });
      });
    }

    const productInfo = {};
    const productInfoText = $(el).find(".dhIWPd").text();
    if (productInfoText) {
      const ratingMatch = productInfoText.match(/Rating: ([0-9.]+)/);
      if (ratingMatch) {
        productInfo.rating = Number(ratingMatch[1]);
      }
      const numberOfReviewsMatch = productInfoText.match(/([0-9,]+) reviews/);
      if (numberOfReviewsMatch) {
        productInfo.numberOfReviews = Number(
          numberOfReviewsMatch[1].replace(/,/g, "")
        );
      }

      const priceMatch = productInfoText.match(/\$([0-9.,]+)/);
      if (priceMatch) {
        productInfo.price = Number(priceMatch[1].replace(/,/g, ""));
      }
    }

    const searchResult = {
      title: $(el).find("h3").eq(0).text(),
      url: $(el).find("a").attr("href"),
      displayedUrl: $(el).find("cite").eq(0).text(),
      description: $(el).find(".IsZvec").text(),
      siteLinks,
      productInfo,
    };
    searchResults.push(searchResult);
  });

  console.log(searchResults);

  return searchResults;
};

exports.extractTotalResults = ($) => {
  const wholeString = $("#resultStats").text() || $("#result-stats").text();
  // Remove text in brackets, get numbers as an array of strings from text "Přibližný počet výsledků: 6 730 000 000 (0,30 s)"
  const numberStrings = wholeString
    .split("(")
    .shift()
    .match(/(\d+(\.|,|\s))+/g);
  // Find the number with highest length (to filter page number values)
  const numberString = numberStrings
    ? numberStrings
        .sort((a, b) => b.length - a.length)
        .shift()
        .replace(/[^\d]/g, "")
    : 0;
  return Number(numberString);
};
