const https = require('https');

const sendRequest = (meth, path, heads, body) => {
  return new Promise((res, rej) => {
    const data = body || null;
    const params = {
      host: 'api.antenny.io',
      port: 443,
      method: meth,
      path: path
    };
    if (data) {
      params.headers = {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      };
    }
    if (heads) {
      params.headers = Object.assign({}, params.headers, heads);
    }
    const req = https.request(params, resp => {
      const chunks = [];
      resp.on('data', chunk => {
        chunks.push(chunk);
      });
      resp.on('end', () => {
        let final = null;
        if (chunks.length > 0) {
          try {
            const str = Buffer.concat(chunks).toString();
            final = JSON.parse(str);
          } catch (err) {
            return rej(err);
          }
        }
        if (resp.statusCode < 200 || resp.statusCode >= 300) {
          const err = new Error('Bad Status');
          err.status = resp.statusCode;
          err.body = final;
          return rej(err);
        }
        res({ status: resp.statusCode, body: final });
      });
    });
    req.on('error', err => rej(err));
    if (data) { req.write(data); }
    req.end();
  });
};

const findByName = (custId, name, startKey) => sendRequest(
  'GET',
  `/customers/${custId}/subscriptions${
    startKey ? '/?startKey=' + startKey : ''
  }`,
  { 'X-API-Key': process.env.API_KEY }
).then(resp => {
  if (!resp.body) { throw new Error('Bad Request'); }
  const items = resp.body.items;
  const sub = items.find(item => item.name === name);
  if (sub) { return sub; }
  const lastKey = resp.body.lastKey;
  if (!lastKey) { throw new Error('Bad Request'); }
  return sendRequest(custId, name, lastKey);
});

const findSub = evt => {
  const str = evt.ResourceProperties.Subscription;
  const sub = JSON.parse(str);
  return findByName(sub.customerId, sub.name);
};

exports.handler = async evt => {
  const physId = evt.PhysicalResourceId;
  const reqType = evt.RequestType;
  switch (reqType) {
    case 'Create':
    case 'Update': {
      const str = evt.ResourceProperties.Subscription;
      let resp;
      try {
        resp =  await sendRequest('POST', '/subscriptions', {
          'X-API-Key': process.env.API_KEY
        }, str);
      } catch (err) {
        console.error(err);
        const sub = err.body;
        const id = sub && sub.id;
        const stat = sub && sub.status;
        if (err.status === 409 && id && stat !== 'CANCELED') {
          return {
            PhysicalResourceId: physId,
            Data: { Id: id }
          };
        }
        throw err;
      }
      const id = resp.body && resp.body.id;
      if (!id) {
        throw new Error('Bad Response');
      }
      return {
        PhysicalResourceId: physId,
        Data: { Id: id }
      };
    }
    case 'Delete': {
      const found = await findSub(evt);
      const id = found.id;
      const resp = await sendRequest('PATCH', `/subscriptions/${id}`, {
        'X-API-Key': process.env.API_KEY
      }, JSON.stringify({ status: 'CANCELED' }));
      const cancelId = resp.body && resp.body.id;
      if (!cancelId) { throw new Error('Bad Response'); }
      return {
        PhysicalResourceId: physId,
        Data: { Id: cancelId }
      };
    }
    default: {
      const found = await findSub(evt);
      const id = found.id;
      if (!id || found.status === 'CANCELED') {
        throw new Error('Bad Response');
      }
      return {
        PhysicalResourceId: physId,
        Data: { Id: id }
      };
    }
  }
};