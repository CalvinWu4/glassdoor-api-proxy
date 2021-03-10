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
    const cacheHit = await GLASSDOOR.get(company);
    const cacheDuration = 777600; // 9 days in seconds

    if (cacheHit && JSON.parse(cacheHit).status === 200) {
      const cacheResponse = new Response(cacheHit);

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
      const data = JSON.stringify({headers: headers, status, json});

      // Only cache successfully found responses from inDoors
      if (status === 200 && json.response.employers.length > 0 && company.startsWith("'") && company.endsWith("'")) {
        try {
          GLASSDOOR.put(company, data, {expirationTtl: cacheDuration});
        }
        catch(err) {
          // KV put limit exceeded for the day
        }
      }

      return new Response(data);
    }
  }
}
