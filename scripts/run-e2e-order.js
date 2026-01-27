const base = 'http://localhost:3001';
async function readJson(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}
async function req(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, body: await readJson(res) };
}
const post = (p,b,t) => req('POST',p,b,t);
const patch = (p,b,t) => req('PATCH',p,b,t);
const get = (p,t) => req('GET',p,undefined,t);

(async () => {
  const cLogin = await post('/auth/login', { email: 'customer.srinagar@test.com', password: 'password123' });
  if (!cLogin.ok) throw new Error('customer login failed ' + JSON.stringify(cLogin));
  const cToken = cLogin.body.access_token;

  const pLogin = await post('/auth/login', { email: 'pharmacy.srinagar@test.com', password: 'password123' });
  if (!pLogin.ok) throw new Error('pharmacy login failed ' + JSON.stringify(pLogin));
  const pToken = pLogin.body.access_token;
  const pharmacyId = pLogin.body?.user?.id;

  const rLogin = await post('/auth/login', { email: 'rider.srinagar@test.com', password: 'password123' });
  if (!rLogin.ok) throw new Error('rider login failed ' + JSON.stringify(rLogin));
  const rToken = rLogin.body.access_token;

  const online = await patch('/rider/availability', { state: 'ONLINE' }, rToken);
  console.log('rider availability', online);

  const inv = await get('/pharmacy/inventory', pToken);
  if (!inv.ok) throw new Error('inventory fetch failed ' + JSON.stringify(inv));
  const invList = Array.isArray(inv.body) ? inv.body : (inv.body?.items || inv.body?.data || []);
  const first = invList[0];
  if (!first?.medicineId && !first?.medicine?.id) throw new Error('no inventory item');
  const medicineId = first.medicineId || first.medicine?.id;
  const medName = first.medicine?.name || first.name || 'Medicine';
  const medCategory = first.medicine?.category || first.category || 'NON_RX';
  const medPrice = Number(first.sellingPrice || first.price || first.mrp || 45);

  const orderPayload = {
    items: [{
      medicineId,
      name: medName,
      quantity: 1,
      price: medPrice,
      category: String(medCategory),
    }],
    address: 'Lal Chowk, Srinagar',
    paymentMode: 'PAY_AFTER_ACCEPT',
    pharmacyId,
  };

  const create = await post('/orders', orderPayload, cToken);
  console.log('order create', create);
  if (!create.ok) throw new Error('order create failed');
  const orderId = create.body?.order?.id || create.body?.id;

  const accept = await post(`/pharmacy/orders/${orderId}/accept`, { totalPrice: medPrice }, pToken);
  console.log('pharmacy accept', accept);

  const pay = await post('/payments/dev/pay-order', { orderId }, cToken);
  console.log('dev pay', pay);

  const ready = await post(`/pharmacy/orders/${orderId}/mark-ready`, {}, pToken);
  console.log('pharmacy ready', ready);

  const offers = await get('/notifications', rToken);
  console.log('rider notifications', offers);
})();
