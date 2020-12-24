const https = require('https');
const cfnResp = require('cfn-response');

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
      params.headers = Object.assign(
        {},
        params.headers,
        heads
      );
    }
    const req = https.request(params, resp => {
      const chunks = [];
      resp.on('data', chunk => {
        chunks.push(chunk);
      });
      resp.on('end', () => {
        let final;
        try {
          const str = Buffer.concat(chunks).toString();
          final = JSON.parse(str);
        } catch (err) {
          return rej(err);
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
    if (data) {
      req.write(data);
    }
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
  if (!resp.body) {
    throw new Error('Bad Request');
  }
  const items = resp.body.items;
  const sub = items.find(item => item.name === name);
  if (sub) {
    return sub;
  }
  const lastKey = resp.body.lastKey;
  if (!lastKey) {
    throw new Error('Bad Request');
  }
  return sendRequest(custId, name, lastKey);
});

const findSub = evt => {
  const str = evt.ResourceProperties.Subscription;
  const sub = JSON.parse(str);
  return findByName(sub.customerId, sub.name);
};

exports.handler = (evt, ctx) => {
  const reqType = evt.RequestType;
  switch (reqType) {
    case 'Create':
    case 'Update': {
      const str = evt.ResourceProperties.Subscription;
      return sendRequest('POST', '/subscriptions', {
        'X-API-Key': process.env.API_KEY
      }, str)
        .then(resp => {
          const id = resp.body && resp.body.id;
          if (!id) {
            return cfnResp.send(evt, ctx, cfnResp.FAILED, {});
          }
          return cfnResp.send(evt, ctx, cfnResp.SUCCESS, {
            Id: id
          });
        })
        .catch(err => {
          console.error(err);
          const id = err.body && err.body.id;
          if (err.status === 409 && id) {
            return cfnResp.send(evt, ctx, cfnResp.SUCCESS, {
              Id: id
            });
          }
          return cfnResp.send(evt, ctx, cfnResp.FAILED, {});
        });
    }
    case 'Delete': {
      return findSub(evt)
        .then(found => {
          const id = found.id;
          return sendRequest('PATCH', `/subscriptions/${id}`, {
            'X-API-Key': process.env.API_KEY
          }, JSON.stringify({ status: 'CANCELED' }));
        })
        .then(resp => {
          const id = resp.body && resp.body.id;
          if (!id) {
            return cfnResp.send(evt, ctx, cfnResp.FAILED, {});
          }
          return cfnResp.send(evt, ctx, cfnResp.SUCCESS, {
            Id: id
          });
        })
        .catch(err => {
          console.error(err);
          return cfnResp.send(evt, ctx, cfnResp.FAILED, {});
        });
    }
    default: {
      return findSub(evt)
        .then(found => {
          const id = found.id;
          if (!id) {
            return cfnResp.send(evt, ctx, cfnResp.FAILED, {});
          }
          return cfnResp.send(evt, ctx, cfnResp.SUCCESS, {
            Id: id
          });
        })
        .catch(err => {
          console.error(err);
          return cfnResp.send(evt, ctx, cfnResp.FAILED, {});
        });
    }
  }
};