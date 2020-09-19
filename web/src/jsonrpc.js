export async function call (rpc, method, params) {
  return fetch(rpc, {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    }),
    headers: {
      'Content-Type': 'application/json'
    },
  }).then(function(response) {
    return response.json();
  }).then(function(json) {
    return json.result;
  })
}