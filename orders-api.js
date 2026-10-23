(function (root) {
  'use strict';
  root.DI = root.DI || {};
  function client() {
    if (!root.DI.supabase) throw new Error(root.DI.supabaseError || 'Order saving is unavailable.');
    return root.DI.supabase;
  }
  async function call(name, args, timeoutMs = 25000) {
    const rpcPromise = client().rpc(name, args);
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Network request timed out. Please check your connection and try again.')), timeoutMs);
    });
    try {
      const response = await Promise.race([rpcPromise, timeoutPromise]);
      if (response.error) throw response.error;
      return response.data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  root.DI.orders = {
    createOrder: payload => call('create_order', {payload}),
    getOrderByToken: token => call('get_order_by_token', {token}),
    submitPaymentReference: (token, method, reference, amountMinor) =>
      call('submit_payment_reference', {token, method, reference, amount_minor: amountMinor})
  };
}(window));
