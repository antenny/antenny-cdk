const { isDeepStrictEqual } = require('util');
const https = require('https');

exports.handler = async evt => {
  const reqType = evt.RequestType;
  switch (reqType) {
    case 'Create': {
      return await createSub(evt);
    }
    case 'Update': {
      if (!shouldUpdate(evt)) {
        return parseEvent(evt);
      }
      return await createSub(evt);
    }
    case 'Delete': {
      return await deleteSub(evt);
    }
    default: {
      return parseEvent(evt);
    }
  }
};

const shouldUpdate = evt => {
  const oldProps = evt.OldResourceProperties;
  const newProps = evt.ResourceProperties;
  const oldSub = oldProps && oldProps.Subscription
    && JSON.parse(oldProps.Subscription);
  const newSub = newProps && newProps.Subscription
    && JSON.parse(newProps.Subscription);
  return !isDeepStrictEqual(oldSub, newSub);
};

const createSub = async evt => {
  const props = evt.ResourceProperties;
  const sub = props && props.Subscription;
  if (!sub) {
    throw new Error('Bad Request');
  }
  let resp;
  try {
    resp =  await sendRequest('POST', '/subscriptions', {
      'X-API-Key': process.env.API_KEY
    }, sub);
  } catch (err) {
    console.error(err);
    const sub = err.body;
    const id = sub && sub.id;
    const stat = sub && sub.status;
    if (err.status === 409 && id && stat !== 'CANCELED') {
      return {
        PhysicalResourceId: genPhysId(id),
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
    PhysicalResourceId: genPhysId(id),
    Data: { Id: id }
  };
};

const deleteSub = async evt => {
  const physId = evt.PhysicalResourceId;
  const id = parsePhysId(physId);
  if (!id) {
    throw new Error('Bad Request');
  }
  try {
    await sendRequest('PATCH', `/subscriptions/${id}`, {
      'X-API-Key': process.env.API_KEY
    }, JSON.stringify({ status: 'CANCELED' }));
  } catch (err) {
    if (err.status === 404) {
      return {
        PhysicalResourceId: physId,
        Data: { Id: id }
      };
    }
    throw err;
  }
  return {
    PhysicalResourceId: physId,
    Data: { Id: id }
  };
};

const parseEvent = evt => {
  const physId = evt.PhysicalResourceId;
  const id = parsePhysId(physId);
  if (!id) {
    throw new Error('Bad Request');
  }
  return {
    PhysicalResourceId: physId,
    Data: { Id: id }
  };
};

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

const genPhysId = id => `Sub_${id}`;
const parsePhysId = physId => {
  if (!physId) {
    return null;
  }
  const parts = physId.split('_');
  return parts[parts.length - 1] || null;
};