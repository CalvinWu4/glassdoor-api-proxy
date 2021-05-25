addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Respond to the request
 * @param {Request} request
 */
async function handleRequest(request) {
  const searchParams = new URL(request.url).searchParams;
  const company = searchParams.get('company');

  if (!company) {
    return new Response('Missing query parameters', { status: 400 });
  }
  else {
    let cacheHit = await GLASSDOOR.get(company.toLowerCase());
    const cacheDuration = 777600; // 9 days in seconds

    if (cacheHit && JSON.parse(cacheHit).status === 200) {
      const cacheResponse = new Response(cacheHit, { headers: { 'content-type': 'application/json' } });

      return cacheResponse;
    }
    else {
      const url = `https://api.glassdoor.com/api/api.htm?v=1&format=json&t.p=${PARTNER_ID}&t.k=${PARTNER_KEY}&action=employers&q=${company}`;
      let response = await fetch(url);
      const currentDate = new Date();
      const expireDate = new Date(currentDate.getTime() + cacheDuration * 1000);
      const headers = {
        'date': response.headers.get('date'),
        'expires': `${expireDate.toGMTString()}`,
        'cache-control': `max-age:${cacheDuration}`
      };
      const status = response.status;
      const json = await response.clone().json();
      const employers = json.response.employers;
      const data = JSON.stringify({headers: headers, status, json});

      // Only cache successful responses that have at least one employer with 500+ ratings
      if (status === 200 && employers.length > 0 && employers.some(employer => employer.numberOfRatings >= 500)
        && company.startsWith("'") && company.endsWith("'")) {  // To make sure it comes from inDoors
        try {
          GLASSDOOR.put(company.toLowerCase(), data, {expirationTtl: cacheDuration}); // Cache lowercase
        }
        catch(err) {
          // KV put limit exceeded for the day
        }
      }
      const init = {
          headers: { 'content-type': 'application/json' },
      }

      return new Response(data, { headers: { 'content-type': 'application/json' } });
    }
  }
}
