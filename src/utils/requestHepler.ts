export function getRequestIdentity(req) {
  console.log(req);
  return {
    "ip": req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    "platform": req.headers['sec-ch-ua-platform'],
    "browser": req.headers['sec-ch-ua'],
    "isMobile": req.headers['sec-ch-ua-mobile'] === '?1' ? true : false,
    "userAgent": req.headers['user-agent'],
  }
}