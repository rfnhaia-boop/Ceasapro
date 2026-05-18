import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://127.0.0.1:3000/api/parse-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: "CAMPEAO 28: NF E BOLETO\n(MAURO) 40Un\n" })
  });
  const data = await res.json();
  console.log(data);
}
test();
