export function getRequestIdentity(req) {
  const ipList = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',');

  return {
    "clientIP": ipList[0].trim(),
    "platform": req.headers['sec-ch-ua-platform'],
    "browser": req.headers['sec-ch-ua'],
    "isMobile": req.headers['sec-ch-ua-mobile'] === '?1' ? true : false,
    "userAgent": req.headers['user-agent'],
    "ipList": req.headers['x-forwarded-for'] || req.connection.remoteAddress,
  }
}